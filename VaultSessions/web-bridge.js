'use strict';
// Forward through the same-page content script because regular web pages lack extension APIs.
if (((location.protocol === 'file:' && location.pathname.endsWith('/meeting.html')) || location.href === 'http://127.0.0.1:8766/meeting.html')) {
  const pending = new Map(), changed = new Set();
  let registrationTimer;
  document.addEventListener('DOMContentLoaded',()=>{
    if(location.protocol!=='file:')return;
    const register=document.createElement('button');register.id='register-local-page';register.dataset.i18n='registerFileButton';register.textContent=VaultI18n.t('registerFileButton');
    document.querySelector('.app-header').after(register);
    const registrationStatus=document.createElement('p');registrationStatus.id='registration-status';registrationStatus.setAttribute('role','status');register.after(registrationStatus);
    register.addEventListener('click',()=>{
      clearTimeout(registrationTimer);register.disabled=true;
      registrationStatus.textContent=VaultI18n.t('registerWorking');
      registrationTimer=setTimeout(()=>{register.disabled=false;registrationStatus.textContent=VaultI18n.t('registerUnavailable');},5000);
    });
    void call({type:'ROUNDTABLE_FILE_INFO'}).then(info=>{if(info?.registered){register.hidden=true;registrationStatus.hidden=true;}}).catch(()=>{});
    const help=document.createElement('dialog');help.className='localhost-help';help.setAttribute('aria-labelledby','localhost-help-title');
    const title=document.createElement('h2');title.id='localhost-help-title';title.dataset.i18n='localhostHelpTitle';
    const opener=document.createElement('button');opener.type='button';opener.className='localhost-help-open';opener.textContent='?';opener.dataset.i18nAria='localhostHelpTitle';opener.dataset.i18nTitle='localhostHelpTitle';
    document.querySelector('.header-actions').prepend(opener);
    const close=document.createElement('button');close.type='button';close.className='localhost-help-close';close.textContent='×';close.dataset.i18nAria='closeHelp';
    opener.addEventListener('click',()=>help.showModal());close.addEventListener('click',()=>help.close());
    help.addEventListener('click',event=>{if(event.target!==help)return;const r=help.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)help.close();});
    const text=document.createElement('p');text.dataset.i18n='localhostHelpText';
    const mac=document.createElement('p');mac.dataset.i18n='localhostHelpMac';
    const windows=document.createElement('p');windows.dataset.i18n='localhostHelpWindows';
    const note=document.createElement('p');note.dataset.i18n='localhostHelpNote';
    const link=document.createElement('button');link.type='button';link.dataset.i18n='localhostCheckOpen';
    const result=document.createElement('p');result.setAttribute('role','status');result.setAttribute('aria-live','polite');
    link.addEventListener('click',async()=>{
      link.disabled=true;result.textContent=VaultI18n.t('localhostChecking');
      try{
        await new Promise((resolve,reject)=>window.dispatchEvent(new CustomEvent('roundtable-before-localhost',{detail:{resolve,reject}})));
        const checked=await call({type:'ROUNDTABLE_CHECK_LOCALHOST'});
        if(!checked?.ok)throw Error(VaultI18n.t('localhostNotReady'));
        location.assign('http://127.0.0.1:8766/meeting.html');
      }catch(error){result.textContent=error.message;link.disabled=false;}
    });
    help.append(close,title,text,mac,windows,note,link,result);document.body.append(help);
    globalThis.VaultI18n?.apply(opener.parentElement);
    globalThis.VaultI18n?.apply(help);
  });
  window.addEventListener('message', event => {
    if (event.source !== window || (event.origin !== 'null' && event.origin !== location.origin) || event.data?.channel !== 'roundtable-unified-extension') return;
    const data = event.data;
    if(data.command==='registration-result'){
      clearTimeout(registrationTimer);
      const button=document.querySelector('#register-local-page'),status=document.querySelector('#registration-status');
      if(button)button.disabled=false;
      if(status)status.textContent=data.ok?VaultI18n.t('registerDone'):(data.error||VaultI18n.t('registerUnavailable'));
      if(data.ok)setTimeout(()=>location.reload(),400);
      return;
    }
    if(data.command==='sidebar-error'){window.dispatchEvent(new CustomEvent('roundtable-sidebar-error',{detail:data.error}));return;}
    if(data.command==='park'){window.dispatchEvent(new CustomEvent('roundtable-park',{detail:{id:data.id}}));return;}
    if (data.event) { for (const listener of changed) listener(0, {status:'complete'}, {}); return; }
    const item = pending.get(data.id);
    if (item) { pending.delete(data.id); clearTimeout(item.timer); item.resolve(data.result); }
  });
  const call = message => new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => { pending.delete(id); reject(Error('AI Roundtable拡張に接続できません。拡張を読み込み、このページを再読み込みしてください。')); }, 28000);
    pending.set(id, {resolve, timer});
    window.postMessage({channel:'roundtable-unified-web', id, message}, '*');
  });
  const event = {addListener: listener => changed.add(listener), removeListener: listener => changed.delete(listener)};
  window.chrome = {
    runtime: {id:'roundtable-local-web',sendMessage:call,reload:()=>location.reload()},
    tabs: {getCurrent:()=>call({type:'ROUNDTABLE_WEB_TAB'}),onUpdated:event,onCreated:{addListener(){},removeListener(){}},onRemoved:{addListener(){},removeListener(){}}},
    permissions: {request:()=>Promise.resolve(true)}
  };
  window.addEventListener('focus',()=>{for(const listener of changed)listener(0,{status:'complete'},{});});
}
