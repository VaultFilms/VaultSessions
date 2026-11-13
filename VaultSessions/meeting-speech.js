'use strict';
const speechToggle=document.querySelector('#speech-enabled');
const speechStatus=document.querySelector('#speech-status');
const speechNext=document.querySelector('#speech-next');
let speechNotice='';
const speechPlayback=new RoundtableSpeechPlayback.Playback({
 request:message=>request(message),
 onChange:({provider,state,busy})=>{
  speechNext.hidden=!busy;
  const keys={starting:'speechStarting',speaking:'speechSpeaking',paused:'speechPaused',unavailable:'speechUnavailable',stopFailed:'speechStopFailed',unsupported:'speechUnsupported'};
  if(state==='unsupported')speechNotice=VaultI18n.t('speechUnsupported',{0:providers[provider].name});
  else if(busy)speechNotice='';
  speechStatus.textContent=keys[state]?VaultI18n.t(keys[state],{0:providers[provider].name}):speechNotice;
  speechStatus.dataset.speechState=state;
  syncControls();
 }
});
async function readOfficialReply(provider,result,context){
 if(!speechPlayback.enabled)return;
 const ownTab=isSidePanel?(await chrome.tabs.query({active:true,currentWindow:true}))[0]:await chrome.tabs.getCurrent();
 return speechPlayback.play(provider,result.speech?{...result,speech:{...result.speech,returnTabId:ownTab?.id}}:result,context);
}
speechToggle.addEventListener('change',()=>{speechNotice='';speechStatus.textContent='';speechPlayback.setEnabled(speechToggle.checked);});
speechNext.addEventListener('click',()=>speechPlayback.next());
window.addEventListener('pagehide',()=>{const flight=speechPlayback.active;if(flight)void request({type:'ROUNDTABLE_SPEECH',...flight,action:'stop'}).catch(()=>{});});
