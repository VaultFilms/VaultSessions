"use strict";
(() => {
  const allowed = new Set(['role','contenteditable','disabled','aria-disabled','aria-hidden','aria-busy','aria-expanded','data-is-streaming','type']);
  const structural = /^(?:id|class|data-testid|data-message-author-role|data-markdown-text-style|data-user-message-bubble|data-web-image-tile)$/;
  function visible(node) {return !!(node.getClientRects().length && getComputedStyle(node).visibility!=='hidden' && getComputedStyle(node).display!=='none');}
  function html(node) {
    const inert=document.implementation.createHTMLDocument('');
    let remaining=180, truncated=false;
    function copy(source,depth){
      if(remaining--<=0||depth>7){truncated=true;return inert.createComment('truncated');}
      if(source.nodeType!==1)return inert.createComment('content omitted');
      if(['SCRIPT','STYLE','NOSCRIPT','IFRAME','OBJECT','EMBED'].includes(source.tagName))return inert.createComment('omitted');
      const out=inert.createElement(source.tagName.toLowerCase());
      for(const attr of source.attributes){
        if((allowed.has(attr.name)||structural.test(attr.name))&&/^[a-zA-Z0-9_ :.,#=\[\]"'()-]{0,200}$/.test(attr.value))out.setAttribute(attr.name,attr.value);
      }
      if(!['INPUT','TEXTAREA'].includes(source.tagName)){
        for(const child of source.childNodes){if(remaining<=0){truncated=true;break;}if(child.nodeType===1)out.append(copy(child,depth+1));else if(child.nodeType===3&&child.textContent.trim())out.append(inert.createComment('text omitted'));}
      }
      return out;
    }
    return {html:copy(node,0).outerHTML?.slice(0,12000)||'',truncated};
  }
  function inspect(provider,selectors,state){
    let budget=40000;
    const checks=[];
    for(const [name,value] of Object.entries(selectors)){
      const queries=Array.isArray(value)?value:[value];
      for(const selector of queries){
        try{
          const nodes=[...document.querySelectorAll(selector)];
          checks.push({name,selector,matches:nodes.length,visible:nodes.filter(visible).length,elements:nodes.slice(-2).map(node=>{
            const scope=node.parentElement||node;const sample=html(scope);const snippet=sample.html.slice(0,Math.max(0,budget));budget-=snippet.length;
            return {tag:node.tagName,visible:visible(node),disabled:!!node.disabled||node.getAttribute('aria-disabled')==='true',...(node.tagName==='IMG'?{complete:node.complete,width:node.naturalWidth,height:node.naturalHeight}:{}),html:snippet,truncated:sample.truncated||snippet.length<sample.html.length};
          })});
        }catch{checks.push({name,selector,matches:0,visible:0,elements:[],error:'Invalid selector'});}
      }
    }
    const report={schema:1,provider,capturedAt:new Date().toISOString(),state:{phase:state?.phase||'idle',kind:state?.kind||'text',busy:!!state?.busy,generating:!!state?.generating,visibility:document.visibilityState},checks,candidates:{editors:document.querySelectorAll('[contenteditable="true"],textarea').length,buttons:document.querySelectorAll('button').length,images:document.querySelectorAll('img,canvas').length},truncated:budget<=0};
    // Keep the same bounded report small enough to share with its maintenance context.
    for(const limit of [700,350,150,0]){if(JSON.stringify(report).length<=14000)break;report.truncated=true;for(const check of report.checks)for(const element of check.elements||[]){if(element.html.length>limit){element.html=element.html.slice(0,limit);element.truncated=true;}}}
    return report;
  }
  globalThis.VaultInspectorDOM={inspect};
})();
