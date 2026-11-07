'use strict';
(function(root) {
  const DEFAULT_PAGE_CHARS = 25000;
  const MIN_PAGE_CHARS = 1000;
  const MAX_PAGE_CHARS = 50000;
  const REQUEST_OVERHEAD = 25000;

  function limits(value) {
    const pageChars = Number.isInteger(value) && value >= MIN_PAGE_CHARS && value <= MAX_PAGE_CHARS
      ? value : DEFAULT_PAGE_CHARS;
    return {
      pageChars,
      captureChars: Math.ceil(pageChars * 6 / 5),
      requestChars: pageChars + REQUEST_OVERHEAD
    };
  }

  const AI_HOSTS = ['chatgpt.com','chat.openai.com','gemini.google.com','claude.ai'];
  function allowed(url) {
    try { const parsed=new URL(url);return ['http:','https:'].includes(parsed.protocol)&&!AI_HOSTS.some(host=>parsed.hostname===host||parsed.hostname.endsWith('.'+host)); } catch { return false; }
  }
  function publicURL(url) {const parsed=new URL(url);parsed.username='';parsed.password='';parsed.search='';parsed.hash='';return parsed.href.slice(0,2048);}
  // This function runs in the selected tab only when the user attaches it.
  function readPage(maxChars) {
    function extract(){
      const root=[document.querySelector('main'),document.querySelector('[role="main"]'),document.querySelector('article'),document.body].find(e=>e&&e.getClientRects().length);
      if(!root)return {text:'',truncated:false};
      const skip='script,style,noscript,template,iframe,svg,canvas,input,textarea,select,form,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[hidden],[aria-hidden="true"]';
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),visibility=new WeakMap();const parts=[];let length=0,node,count=0,truncated=false;
      while((node=walker.nextNode())&&count++<30000){const parent=node.parentElement;if(!parent||parent.closest(skip))continue;
        let visible=visibility.get(parent);if(visible===undefined){visible=parent.getClientRects().length>0&&getComputedStyle(parent).visibility!=='hidden';visibility.set(parent,visible);}if(!visible)continue;
        const text=node.textContent.replace(/\s+/g,' ').trim();if(!text)continue;
        const separator = parts.length ? 1 : 0;
        const remaining = maxChars - length - separator;
        if (text.length > remaining) {
          if (remaining > 0) parts.push(text.slice(0,remaining));
          truncated = true;
          break;
        }
        parts.push(text);
        length += text.length + separator;
      }
      if(count>=30000)truncated=true;return {text:parts.join('\n'),truncated};
    }
    return {url:location.href,title:document.title.slice(0,240),...extract()};
  }
  async function capture(chrome, windowId, pageChars) {
    if (!Number.isInteger(windowId)) throw Error('Invalid browser window.');
    const [tab] = await chrome.tabs.query({windowId,active:true});
    if (!Number.isInteger(tab?.id) || !allowed(tab.url)) throw Error('This page cannot be attached.');
    const maxChars = limits(pageChars).captureChars;
    const [frame] = await chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},func:readPage,args:[maxChars]});
    const page = frame?.result;
    const [current] = await chrome.tabs.query({windowId,active:true});
    if (current?.id !== tab.id || current.url !== tab.url || page?.url !== tab.url) throw Error('The active page changed during capture.');
    if (typeof page.text !== 'string' || !page.text.trim() || page.text.length > maxChars || typeof page.title !== 'string') throw Error('This page has no readable text.');
    return {id:crypto.randomUUID(),url:publicURL(page.url),title:page.title.slice(0,240),text:page.text,truncated:!!page.truncated};
  }
  const api={capture,allowed,publicURL,limits,MAX_PAGE_CHARS};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RoundtablePages=api;
})(globalThis);
