'use strict';
if (((location.protocol === 'file:' && location.pathname.endsWith('/meeting.html')) || location.href === 'http://127.0.0.1:8766/meeting.html')) {
  const parks=new Map();
  // Forward a trusted click directly; do not await postMessage or storage first.
  if(typeof document!=='undefined')document.addEventListener('click',event=>{
    if(event.isTrusted&&event.target?.closest?.('#register-local-page')){
      try{Promise.resolve(chrome.runtime.sendMessage({type:'ROUNDTABLE_REGISTER_FILE'})).then(result=>{
        window.postMessage({channel:'roundtable-unified-extension',command:'registration-result',ok:!!result?.ok,error:result?.error},'*');
      },error=>window.postMessage({channel:'roundtable-unified-extension',command:'registration-result',ok:false,error:error.message},'*'));}
      catch(error){window.postMessage({channel:'roundtable-unified-extension',command:'registration-result',ok:false,error:error.message},'*');}
      return;
    }
    const button=event.target?.closest?.('#switch-view');
    if(!event.isTrusted||!button||button.disabled)return;
    event.preventDefault();event.stopImmediatePropagation();
    const label=button.textContent;button.disabled=true;button.textContent='サイドバーを開いています…';
    let opening;
    try{opening=chrome.runtime.sendMessage({type:'ROUNDTABLE_OPEN_SIDEBAR'});}catch(error){opening=Promise.reject(error);}
    Promise.resolve(opening).then(result=>{
      if(!result?.ok)throw Error(result?.error||'拡張管理画面で本体を再読み込みし、この会議ページを再読み込みしてください。');
    }).catch(error=>{
      button.disabled=false;button.textContent=label;
      window.postMessage({channel:'roundtable-unified-extension',command:'sidebar-error',error:error.message},'*');
    });
  },true);

  window.addEventListener('message', async event => {
    if (event.source !== window || (event.origin !== 'null' && event.origin !== location.origin) || event.data?.channel !== 'roundtable-unified-web') return;
    const {id,message} = event.data;
    if(message?.type==='ROUNDTABLE_WEB_PARK_RESULT'&&parks.has(id)){const done=parks.get(id);parks.delete(id);done(message);return;}
    if(message?.type==='ROUNDTABLE_REGISTER_FILE')return;
    if (typeof id !== 'string' || !/^ROUNDTABLE_/.test(message?.type || '')) return;
    let result;
    try { result = await chrome.runtime.sendMessage(message); }
    catch { result = {ok:false,error:'AI Roundtable拡張との接続が切れました。会議ページを再読み込みしてください。'}; }
    window.postMessage({channel:'roundtable-unified-extension',id,result},'*');
  });
  chrome.runtime.onMessage.addListener((message,sender,respond) => {
    if(message?.type==='ROUNDTABLE_WEB_PARK'){
      const id=crypto.randomUUID();const timer=setTimeout(()=>{parks.delete(id);respond({active:false});},2000);
      parks.set(id,result=>{clearTimeout(timer);respond(result);});
      window.postMessage({channel:'roundtable-unified-extension',command:'park',id},'*');return true;
    }
    if(message?.type === 'ROUNDTABLE_WEB_CHANGED')window.postMessage({channel:'roundtable-unified-extension',event:true},'*');
  });
}
