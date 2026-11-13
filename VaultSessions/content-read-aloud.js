'use strict';
// Drive the official site's player; never synthesize or fetch audio in VaultSessions.
(function(root){
 const START=/^(read aloud|listen|読み上げ|読み上げる|音声で聞く|聞く|écouter|lire à voix haute|vorlesen|anhören|leer en voz alta|escuchar|leggi ad alta voce|ascolta|bacakan|dengarkan|ler em voz alta|ouvir|ज़ोर से पढ़ें|सुनें)$/i;
 const PAUSE=/^(pause|pause reading|pause reading aloud|stop reading|stop reading aloud|stop listening|stop audio|stop playback|一時停止|読み上げを停止|読み上げを一時停止|mettre en pause|pause de la lecture|pausieren|anhalten|pausar|pausa|jeda|रोकें)$/i;
 const RESUME=/^(resume|resume reading|play|再開|再生|reprendre|fortsetzen|reanudar|riprendi|lanjutkan|retomar|जारी रखें)$/i;
 const label=b=>(b?.getAttribute('aria-label')||b?.getAttribute('title')||b?.textContent||'').trim();
 const usable=b=>b?.isConnected&&!b.disabled&&b.getAttribute('aria-disabled')!=='true';
 function create({provider,getJob,users,replies,userText,url,now=Date.now,doc=document}){
  let playback,pendingStart;
  function current(requestId){
   const job=getJob();
   if(!job||job.requestId!==requestId||job.phase!=='complete'||job.imageRelay||!job.receipt||job.url!==url())throw Error('The completed response is no longer current.');
   const list=users(),user=list.findLast(node=>userText(node).includes(job.receipt));
   if(!user||user!==list.at(-1))throw Error('The official conversation changed.');
   const reply=replies().filter(node=>user.compareDocumentPosition(node)&4).at(-1);
   if(!reply?.isConnected)throw Error('The completed response is no longer visible.');
   return {job,user,reply};
  }
  // Attributes and icon IDs are primary. Translated names are a legacy fallback only.
  function identity(node,state){
   const icons=new Set();
   for(const icon of node.querySelectorAll('mat-icon[data-mat-icon-name],mat-icon[fonticon]'))icons.add(icon.getAttribute('data-mat-icon-name')||icon.getAttribute('fonticon'));
   for(const use of node.querySelectorAll('svg use')){
    const ref=use.getAttribute('href')||use.getAttribute('xlink:href')||'';
    const match=/#icon-(?:xs|sm|md|lg|xl)-([\w-]+)$/.exec(ref);if(match)icons.add(match[1]);
   }
   const has=name=>icons.has(name);
   if(provider==='claude'&&node.getAttribute('data-testid')==='action-bar-read-aloud'){
    const value={idle:'idle',playing:'speaking',paused:'paused',loading:'starting',buffering:'starting'}[node.getAttribute('data-state')];
    return {role:'speech',value};
   }
   if(provider==='gemini'&&(node.matches('button.tts-button')||node.getAttribute('data-test-id')==='tts-button')){
    const value=node.querySelector('mat-spinner,[role="progressbar"]')?'starting':has('pause')?'speaking':has('play_arrow')?'idle':undefined;
    return {role:'speech',value};
   }
   if(provider==='chatgpt'){
    // Verified official speaker glyph; aria-pressed alone also occurs on unrelated controls.
    const speaker=[...node.querySelectorAll('svg[viewBox="0 0 20 20"] path')].some(path=>(path.getAttribute('d')||'').startsWith('M9.75122 4.09203C9.75122 3.61482'));
    if((speaker||state?.button===node)&&node.hasAttribute('aria-pressed'))return {role:'speech',value:node.getAttribute('aria-pressed')==='true'?'speaking':'idle'};
   }
   if(provider==='grok'){
    if(node.matches('[role="menuitem"]')&&(has('speaker-waves')||has('stop')))return {role:'speech',value:has('stop')?'speaking':'idle'};
    if(node.closest('[data-testid="composer-read-aloud-bar"]'))return {role:'player',value:has('pause')?'speaking':has('play')?'paused':has('stop')||has('close')?'stop':undefined};
    if(has('ellipsis'))return {role:'more'};
   }
   if(provider==='gemini'&&has('more_horiz'))return {role:'more'};
   return null;
  }
  function controlState(node,state){
   const info=identity(node,state);
   if(info?.value)return info.value;
   if(info?.role==='more')return null;
   if(PAUSE.test(label(node)))return 'speaking';
   if(RESUME.test(label(node)))return 'paused';
   if(START.test(label(node)))return node.getAttribute('aria-pressed')==='true'?'speaking':'idle';
   if(/^(Stop|停止)$/i.test(label(node)))return 'stop';
   if(provider==='gemini'&&/^(Processing|処理中|準備中)$/i.test(label(node)))return 'starting';
   return null;
  }
  function speechControl(nodes){
   const candidates=[...nodes].filter(usable);
   return candidates.find(node=>identity(node)?.role==='speech')||candidates.find(node=>!identity(node)&&(START.test(label(node))||RESUME.test(label(node))));
  }
  function moreControl(nodes){
   const candidates=[...nodes].filter(usable);
   return candidates.find(node=>identity(node)?.role==='more')||candidates.find(node=>!identity(node)&&/^(more actions|その他の操作|Show more options|その他のオプション|その他)$/i.test(label(node)));
  }
  function scopeFor(reply){
   if(provider==='gemini')return reply.closest('model-response');
   let scope=reply,fallback=null;
   for(let i=0;scope&&i<10;i++,scope=scope.parentElement){
    // Stop before a container with other assistant replies. Never select an older answer.
    if(replies().filter(node=>scope.contains(node)).length>1)break;
    const buttons=[...scope.querySelectorAll('button')];
    if(buttons.some(node=>identity(node)?.role==='speech'||provider==='grok'&&identity(node)?.role==='more'))return scope;
    if(!fallback&&(speechControl(buttons)||provider==='grok'&&moreControl(buttons)))fallback=scope;
   }
   return fallback;
  }
  function buttons(state){return [...(state.scope?.querySelectorAll('button')||[])].filter(usable);}
  function geminiPlayer(state){
   if(provider!=='gemini'||!state.geminiMenu)return null;
   const candidates=[...doc.querySelectorAll('tts-control-v2 .response-tts-container')];
   const player=state.geminiKey?candidates.find(node=>node.getAttribute('data-test-draft-id')===state.geminiKey):candidates.find(node=>!node.classList.contains('hidden'));
   if(!player)return null;
   const control=player.querySelector('button.tts-button');
   if(!state.geminiKey&&control&&['speaking','starting'].includes(controlState(control,state))){
    state.geminiKey=player.getAttribute('data-test-draft-id');state.geminiPlayer=player;
   }
   return control;
  }
  const pending=state=>{const button=geminiPlayer(state);return !!button&&controlState(button,state)==='starting';};
  function playerButtons(state){
   const local=buttons(state);
   // ChatGPT/Grok may place the active player outside the answer action bar.
   let globals=[...doc.querySelectorAll('[data-testid="composer-read-aloud-bar"] button, [data-testid="audio-player"] button')].filter(usable);
   if(!globals.length)globals=[...doc.querySelectorAll('[aria-label="Audio player"] button, [aria-label="Read aloud player"] button')].filter(usable);
   return [...new Set([...local,...globals,geminiPlayer(state)].filter(usable))];
  }
  function status(state){
   current(state.requestId);
   if(!state.scope?.isConnected)return {ok:false,state:'unavailable'};
   if(pending(state))return {ok:true,state:now()-state.created>30000?'unavailable':'starting'};
   const active=playerButtons(state).find(b=>controlState(b,state)==='speaking');
   if(active){state.started=true;state.quietSince=null;return {ok:true,state:'speaking'};}
   if(state.media.some(media=>!media.paused&&!media.ended)){state.started=true;state.quietSince=null;return {ok:true,state:'speaking'};}
   const paused=playerButtons(state).some(b=>controlState(b,state)==='paused');
   if(paused)return {ok:true,state:'paused'};
   if(state.started&&(playerButtons(state).some(b=>controlState(b,state)==='idle'||provider==='grok'&&(identity(b,state)?.role==='more'||moreControl([b])))||state.geminiPlayer&&(!state.geminiPlayer.isConnected||state.geminiPlayer.classList.contains('hidden')))){
    state.quietSince??=now();return {ok:true,state:now()-state.quietSince>=1000?'complete':'speaking'};
   }
   return {ok:true,state:now()-state.created>12000?'unavailable':'starting'};
  }
  async function handle(message){
   try{
    if(!['start','status','stop'].includes(message.action))throw Error('Invalid playback action.');
    const binding=current(message.requestId);
    if(pendingStart?.requestId===message.requestId){
     if(message.action==='stop')pendingStart.cancelled=true;
     return {ok:true,state:pendingStart.cancelled?'stopped':'starting'};
    }
    if(message.action==='start'){
     if(pendingStart)return {ok:false,state:'unavailable'};
     const attempt={requestId:message.requestId,cancelled:false};pendingStart=attempt;
     try {
     if(playback?.requestId===message.requestId)return status(playback); // Idempotent polling never clicks twice.
     if(playback&&playback.job!==binding.job)playback=null;
     if(playback&&['speaking','paused','starting'].includes(status(playback).state))throw Error('Another response is still being read.');
     const scope=scopeFor(binding.reply);
     if(!scope)return {ok:true,state:'unsupported'};
     const local=[...scope.querySelectorAll('button')];
     let button=local.filter(usable).find(node=>identity(node)?.role==='speech');
     if(!button&&!local.some(node=>usable(node)&&identity(node)?.role==='more'))button=speechControl(local);
     let geminiMenu=false,resumeExisting=false,closeMenu;
     if(!button&&provider==='gemini'){
      const more=moreControl(scope.querySelectorAll('button'));
      if(more){
       const menu=()=>[...scope.querySelectorAll('gem-menu[role="menu"][data-test-id="more-menu-button"]')].find(node=>node.getAttribute('data-visible')==='true');
       if(!menu()&&doc.querySelector('[role="menu"][data-visible="true"]'))return {ok:true,state:'unsupported'};
       if(!menu())more.click();
       for(let i=0;i<20&&!button;i++){
        await new Promise(resolve=>setTimeout(resolve,50));current(message.requestId);
        if(attempt.cancelled){if(menu())more.click();return {ok:true,state:'stopped'};}
        button=[...(menu()?.querySelectorAll('[role="menuitem"][data-test-id="tts-button"]')||[])].find(usable);
       }
       geminiMenu=!!button;
       if(!button&&menu())more.click();
      }
     }
     if(!button&&provider==='grok'){
      const more=moreControl(scope.querySelectorAll('button'));
      if(more){
       const ownedMenu=()=>doc.getElementById(more.getAttribute('aria-controls'))||[...doc.querySelectorAll('[role="menu"]')].find(node=>node.getAttribute('aria-labelledby')===more.id);
       if(doc.querySelector('[role="menu"]')&&!ownedMenu())return {ok:true,state:'unsupported'};
       if(!ownedMenu())more.click();
       for(let i=0;i<20&&!button;i++){
        await new Promise(resolve=>setTimeout(resolve,50));current(message.requestId);
        if(attempt.cancelled){if(ownedMenu())more.click();return {ok:true,state:'stopped'};}
        const menu=ownedMenu();
        const items=[...(menu?.querySelectorAll('[role="menuitem"]')||[])];
        button=speechControl(items)||items.find(item=>!identity(item)&&PAUSE.test(label(item)));
        resumeExisting=!!button&&controlState(button)==='speaking';closeMenu=()=>more.click();
       }
       if(!button)more.click();
      }
     }
     if(!button)return {ok:true,state:'unsupported'};
     if(attempt.cancelled)return {ok:true,state:'stopped'};
     current(message.requestId);
     playback={...binding,scope,requestId:message.requestId,created:now(),started:false,media:[],geminiMenu,button};
     const prior=new Set(doc.querySelectorAll('audio'));
     if(resumeExisting){const resume=playerButtons(playback).find(item=>controlState(item,playback)==='paused');resume?.click();closeMenu?.();}
     else if(!['speaking','starting'].includes(controlState(button,playback)))button.click();
     playback.media=[...doc.querySelectorAll('audio')].filter(m=>!prior.has(m));
     return status(playback);
     }finally{if(pendingStart===attempt)pendingStart=null;}
    }
    if(!playback||playback.requestId!==message.requestId)return {ok:true,state:'complete'};
    if(message.action==='stop'||playback.stopRequested){
     playback.stopRequested=true;
     if(pending(playback)||playback.geminiMenu&&!playback.started&&!playback.geminiKey&&now()-playback.created<30000)return {ok:true,state:'starting'};
     const active=playerButtons(playback).find(b=>controlState(b,playback)==='stop')||playerButtons(playback).find(b=>controlState(b,playback)==='speaking');
     if(active)active.click();
     playback.media.forEach(media=>{if(!media.paused)media.pause();});
     const state=status(playback);
     const playing=playerButtons(playback).some(b=>controlState(b,playback)==='speaking')||playback.media.some(media=>!media.paused&&!media.ended);
     if(!playing){playback=null;return {ok:true,state:'stopped'};}
     return state;
    }
    return status(playback);
   }catch(error){return {ok:false,state:'unavailable',error:error.message};}
  }
  return {handle};
 }
 const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RoundtableSpeech=api;
})(globalThis);
