'use strict';
(() => {
  const old=globalThis.__roundtablePageReader;
  const previous=old?.dispose();
  const ignored=['chatgpt.com','chat.openai.com','gemini.google.com','claude.ai'];
  if(!['http:','https:'].includes(location.protocol)||ignored.some(h=>location.hostname===h||location.hostname.endsWith('.'+h)))return;
  const route=()=>{const u=new URL(location.href);if(!/^#(?:\/|!)/.test(u.hash))u.hash='';return u.href;};
  let key=route(),visit=previous?.key===key?previous.visit:crypto.randomUUID(),cached=previous?.key===key?previous.cached:null;
  const documentId=previous?.documentId||crypto.randomUUID();
  let active=false,interval=null,observer=null,quiet=null,maximum=null,started=0,capturing=false;
  function cancel(){observer?.disconnect();observer=null;clearTimeout(quiet);clearTimeout(maximum);quiet=maximum=null;capturing=false;}
  function stop(){active=false;clearInterval(interval);interval=null;cancel();}
  function checkRoute(){const next=route();if(next===key)return;cancel();key=next;visit=crypto.randomUUID();cached=null;void announce();}
  async function send(message){try{return await chrome.runtime.sendMessage(message);}catch{stop();return {ok:false};}}
  async function deliver(){if(cached)await send({...cached,navigationUrl:location.href});}
  function extract(){
    const root=[document.querySelector('main'),document.querySelector('[role="main"]'),document.querySelector('article'),document.body].find(e=>e&&e.getClientRects().length);
    if(!root)return {text:'',truncated:false};
    const skip='script,style,noscript,template,iframe,svg,canvas,input,textarea,select,form,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[hidden],[aria-hidden="true"]';
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),visibility=new WeakMap();const parts=[];let length=0,node,count=0,truncated=false;
    while((node=walker.nextNode())&&count++<30000){const parent=node.parentElement;if(!parent||parent.closest(skip))continue;
      let visible=visibility.get(parent);if(visible===undefined){visible=parent.getClientRects().length>0&&getComputedStyle(parent).visibility!=='hidden';visibility.set(parent,visible);}if(!visible)continue;
      const text=node.textContent.replace(/\s+/g,' ').trim();if(!text)continue;
      if(length+text.length+1>8000){parts.push(text.slice(0,Math.max(0,7999-length)));truncated=true;break;}parts.push(text);length+=text.length+1;
    }
    if(count>=30000)truncated=true;return {text:parts.join('\n').slice(0,8000),truncated};
  }
  function finish(force=false){
    if(!active||!capturing)return;
    if(route()!==key){checkRoute();return;}
    const value=extract();if(!value.text&&!force&&Date.now()-started<12000){clearTimeout(quiet);quiet=setTimeout(()=>finish(),700);return;}
    cancel();cached={type:'ROUNDTABLE_PAGE_SNAPSHOT',navigationUrl:location.href,documentId,visit,title:document.title.slice(0,240),...value};void deliver();
  }
  function activate(){
    active=true;if(!interval)interval=setInterval(checkRoute,500);
    const next=route();if(next!==key){cancel();key=next;visit=crypto.randomUUID();cached=null;}
    if(cached){void deliver();return;}if(capturing)return;
    capturing=true;started=Date.now();
    const schedule=()=>{clearTimeout(quiet);quiet=setTimeout(()=>finish(),700);};
    observer=new MutationObserver(schedule);if(document.body)observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    maximum=setTimeout(()=>finish(true),12000);schedule();
  }
  async function announce(){const result=await send({type:'ROUNDTABLE_PAGE_READY'});if(result?.enabled)activate();else stop();}
  const listener=(message,sender,respond)=>{if(sender.id!==chrome.runtime.id)return;if(message?.type==='ROUNDTABLE_PAGE_START'){activate();respond({ok:true});}else if(message?.type==='ROUNDTABLE_PAGE_STOP'){stop();respond({ok:true});}};
  chrome.runtime.onMessage.addListener(listener);
  const unload=()=>stop();window.addEventListener('pagehide',unload);
  globalThis.__roundtablePageReader={dispose(){stop();try{chrome.runtime.onMessage.removeListener(listener);}catch{}window.removeEventListener('pagehide',unload);return {key,visit,cached,documentId};}};
  void announce();
})();
