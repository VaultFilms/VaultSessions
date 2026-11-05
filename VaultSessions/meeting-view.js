'use strict';
(() => {
  const switchButton=document.querySelector('#switch-view');
  switchButton.textContent=VaultI18n.t(isSidePanel?'fullscreen':'sidebar');
  switchButton.title=VaultI18n.t('switchHint');
  const bodyText=node=>!node?'':node.nodeType===3?node.textContent:node.tagName==='A'?`[${node.textContent}](${node.getAttribute('href')})`:[...node.childNodes].map(bodyText).join('');
  function imageState(row){
    if(row.dataset.type!=='image-generation')return {};
    let imageTask;try{imageTask=JSON.parse(row.dataset.imageTask);}catch{return {};}
    return {imageTask,generatedImages:[...row.querySelectorAll('.generated-image-gallery img')].map((img,index)=>({dataUrl:img.src,width:img.width,height:img.height,name:`generated-image-${index+1}.${img.src.startsWith('data:image/webp;')?'webp':'png'}`}))};
  }
  function snapshot(){const saved={version:1,rows:[...log.querySelectorAll('.entry')].slice(-500).map(row=>({
    ...imageState(row),type:row.dataset.type,role:row.classList.contains('assistant')?'assistant':row.classList.contains('user')?'user':'system',
    provider:Object.keys(providers).find(id=>providers[id].name===row.querySelector('strong')?.textContent),
    text:row.dataset.type==='image-generation'?'':bodyText(row.querySelector('.entry-body')),meta:row.querySelector('.entry-state')?.textContent||'',timestamp:Number(row.dataset.time)||null
  })),history:controller.history.slice(-500),serial:controller.serial,draft:input.value,settings:{language:language.value,maxSpeeches:document.querySelector('#max-speeches').value,maxQueries:document.querySelector('#max-queries').value}};
    // Keep recent previews within the existing snapshot budget; original links remain for older images.
    let imageBudget=1600000;
    for(const row of [...saved.rows].reverse())if(row.generatedImages){
      row.generatedImages=row.generatedImages.filter(img=>{if(img.dataUrl.length>imageBudget)return false;imageBudget-=img.dataUrl.length;return true;});
    }
    return saved;
  }
  function restore(saved){
    if(!saved||!Array.isArray(saved.rows)||!Array.isArray(saved.history))return;
    for(const row of saved.rows){
      if(!['user','assistant','system'].includes(row.role)||typeof row.text!=='string'||(row.role==='assistant'&&!providers[row.provider]))continue;
      const entry=addEntry(row.role,row.text,row.provider);
      if(row.timestamp){entry.entry.dataset.time=String(row.timestamp);const time=entry.entry.querySelector('time');time.dateTime=new Date(row.timestamp).toISOString();time.textContent=new Intl.DateTimeFormat(VaultI18n.locale,{hour:'numeric',minute:'2-digit'}).format(row.timestamp);}else entry.entry.querySelector('time')?.remove();
      if(row.role==='assistant')RoundtableLinks.render(entry.body,row.text);
      if(row.type==='image-generation'&&row.imageTask)restoreImageJobRow(entry,row.imageTask,row.generatedImages);
      if(row.type==='summary'){entry.entry.dataset.type='summary';setTimeout(()=>window.dispatchEvent(new CustomEvent('roundtable-summary-restore',{detail:entry})),0);}
      entry.meta.textContent=/回答中|送信中|進行中|送信待ち|Responding|Sending|In progress|Queued/.test(row.meta)?VaultI18n.t('previousDisplay'):uiText(row.meta);
    }
    controller.history=saved.history;controller.serial=saved.serial||0;
    const settings=saved.settings||{};
    if([...language.options].some(option=>option.value===settings.language)){language.value=settings.language;language.dataset.restored=settings.language;window.dispatchEvent(new CustomEvent('vaultsessions-restore-language',{detail:settings.language}));}
    if(+settings.maxSpeeches>=1&&+settings.maxSpeeches<=100)document.querySelector('#max-speeches').value=settings.maxSpeeches;
    if(+settings.maxQueries>=1&&+settings.maxQueries<=300)document.querySelector('#max-queries').value=settings.maxQueries;
    if(typeof saved.draft==='string')input.value=saved.draft;
    requestAnimationFrame(()=>log.scrollTop=log.scrollHeight);
  }
  let timer,closing=false,saving=Promise.resolve();
  async function save(){
    if(!meetingActive||meetingRestoring||closing||!globalThis.chrome?.runtime?.id)return;
    const current=snapshot();
    saving=saving.catch(()=>{}).then(()=>request({type:'ROUNDTABLE_SESSION',operation:'save',snapshot:current,busy:(controller.running || summaryBusy)||isConnecting()}));
    try{await saving;}catch(error){if(!closing){if(error.code==='SESSION_MOVED'){meetingActive=false;syncControls();}setStatus('error',error.message,{inLog:false});}}
  }
  async function initialize(){
    try{
      if(globalThis.chrome?.runtime?.id){
        await request({type:'ROUNDTABLE_HELLO'});
        // Import legacy experiment logs when reloading the same HTTP meeting tab.
        let bootstrap;
        if(location.origin==='http://127.0.0.1:8766')try{bootstrap=JSON.parse(sessionStorage.getItem('roundtable-experiment-log-v1')||'null');}catch{}
        const result=await request({type:'ROUNDTABLE_SESSION',operation:'load',acquire:true,bootstrap});
        restore(result.snapshot);meetingActive=result.active!==false;
        if(result.blocked&&isSidePanel){setStatus('ready','全画面で使用中です。全画面の「サイドバーへ」から戻してください。',{inLog:false});window.close();}
        if(!meetingActive)setStatus('error','別の会議画面で回答を回収中です。終了後にこの画面を再読み込みしてください。',{inLog:false});
      }
    }catch(error){meetingActive=false;setStatus('error',error.message,{inLog:false});}
    finally{meetingRestoring=false;syncControls();automaticInvitations?.schedule(0);}
  }
  window.addEventListener('roundtable-sidebar-error',event=>setStatus('error',event.detail,{inLog:false}));
  window.addEventListener('roundtable-resume',()=>{closing=false;viewSwitching=false;});
  window.addEventListener('roundtable-park',event=>{
    const active=meetingActive&&!closing;const saved=active?snapshot():null;
    closing=true;meetingActive=false;controller.stop();automaticInvitations?.dispose();syncControls();
    window.postMessage({channel:'roundtable-unified-web',id:event.detail.id,message:{type:'ROUNDTABLE_WEB_PARK_RESULT',active,snapshot:saved}},'*');
  });
  switchButton.addEventListener('click',async()=>{
    if((controller.running || summaryBusy)||isConnecting()||imageLoading||viewSwitching)return;
    viewSwitching=true;syncControls();
    try{await ensureMeetingAccess();}catch(error){viewSwitching=false;syncControls();setStatus('error',error.message,{inLog:false});return;}
    setStatus('sending',VaultI18n.t('switchingView'),{inLog:false});
    const current=snapshot();closing=true;meetingActive=false;syncControls();
    try{
      await saving.catch(()=>{});
      // Reuse the sidebar host tab for fullscreen rather than opening an extra tab.
      const sourceTab=isSidePanel?(await chrome.tabs.query({active:true,currentWindow:true}))[0]:null;
      const result=await request({type:'ROUNDTABLE_SWITCH',view:isSidePanel?'web':'sidepanel',snapshot:current,sourceTabId:sourceTab?.id});
      automaticInvitations?.dispose();
      for(const id of Object.keys(targets))delete targets[id];renderParticipants();syncControls();
      setStatus('ready',result.opened?'会議を切り替えました。切り替え先で続けてください。':'ログを保存しました。拡張アイコンを押してサイドバーを開いてください。',{inLog:false});
      if(isSidePanel&&typeof window.close==='function')window.close();
    }catch(error){closing=false;viewSwitching=false;meetingActive=true;syncControls();setStatus('error',error.message,{inLog:false});}
  });
  new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(save,150);}).observe(log,{subtree:true,childList:true,characterData:true});
  form.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(save,150);});
  document.querySelector('#discussion-settings').addEventListener('change',()=>void save());
  // Persist busy state immediately at turn start and end so another view cannot acquire an active meeting.
  const onEvent=controller.onEvent;
  controller.onEvent=event=>{onEvent(event);if(['started','idle'].includes(event.type))void save();};
  window.addEventListener('focus',async()=>{
    if(meetingRestoring||closing||!globalThis.chrome?.runtime?.id)return;
    try{const result=await request({type:'ROUNDTABLE_SESSION',operation:'load'});if(result.active===false){meetingActive=false;automaticInvitations?.dispose();syncControls();}}catch{}
  });
  const heartbeat=setInterval(()=>{if(meetingActive&&!meetingRestoring&&!closing)request({type:'ROUNDTABLE_SESSION',operation:'touch',busy:(controller.running || summaryBusy)||isConnecting()}).catch(()=>{});},10000);
  window.addEventListener('pagehide',()=>clearInterval(heartbeat));
  window.addEventListener('pagehide',()=>{if(meetingActive&&!meetingRestoring&&!closing){void save().then(()=>request({type:'ROUNDTABLE_SESSION',operation:'release'})).catch(()=>{});}});
  globalThis.chrome?.runtime?.onMessage?.addListener(message=>{if(message?.type==='ROUNDTABLE_VIEW_RESUME'&&isSidePanel)location.reload();});
  window.addEventListener('roundtable-summary-state',()=>void save());
  window.addEventListener('roundtable-before-localhost',async event=>{
    try{
      if(controller.running||summaryBusy||isConnecting()||imageLoading)throw Error(VaultI18n.t('localhostWait'));
      await ensureMeetingAccess();await saving.catch(()=>{});
      await request({type:'ROUNDTABLE_SESSION',operation:'save',snapshot:snapshot(),busy:false});
      event.detail.resolve();
    }catch(error){event.detail.reject(error);}
  });
  void initialize();
})();
