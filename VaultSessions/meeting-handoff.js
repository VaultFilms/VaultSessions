"use strict";
(() => {
 const button=document.querySelector('#create-handoff'),mode=document.querySelector('#meeting-mode');
 const t=key=>VaultI18n.t(key);
 const blocked=()=>summaryBusy||controller.running||isConnecting()||meetingRestoring||!meetingActive;
 const sync=()=>{button.hidden=mode.value!=='dev';button.disabled=blocked();};
 new MutationObserver(sync).observe(document.querySelector('#send'),{attributes:true,attributeFilter:['disabled']});
 mode.addEventListener('change',sync);window.addEventListener('vaultsessions-restore-mode',sync);window.addEventListener('roundtable-summary-state',sync);sync();
 const dialog=document.createElement('dialog');dialog.className='brief-dialog';dialog.id='handoff-topics';dialog.setAttribute('aria-labelledby','handoff-topics-title');
 const header=document.createElement('header'),heading=document.createElement('h2'),close=document.createElement('button');heading.id='handoff-topics-title';heading.dataset.i18n='handoffChooseTopic';heading.textContent=t('handoffChooseTopic');close.type='button';close.className='brief-close';close.textContent='×';close.dataset.i18nAria='devRecordClose';close.setAttribute('aria-label',t('devRecordClose'));header.append(heading,close);
 const notice=document.createElement('p');notice.className='brief-hint';notice.setAttribute('role','status');
 const list=document.createElement('div');list.className='brief-list';dialog.append(header,notice,list);document.body.append(dialog);
 let selecting=false,resolveSelection;
 function cancel(){if(selecting)dialog.close();}
 close.addEventListener('click',cancel);
 dialog.addEventListener('cancel',event=>{if(!selecting)event.preventDefault();});
 dialog.addEventListener('close',()=>{if(dialog.open)return;const resolve=resolveSelection;resolveSelection=null;selecting=false;resolve?.(null);});
 function choose(topics){
  selecting=true;close.disabled=false;list.replaceChildren();
  notice.textContent=t(topics.length?'handoffSelectHint':'handoffNoTopics');
  for(const topic of topics){
   const item=document.createElement('button'),text=document.createElement('span'),title=document.createElement('strong'),description=document.createElement('small'),arrow=document.createElement('span');
   item.type='button';item.className='brief-record';title.textContent=topic.title;description.textContent=topic.description;arrow.textContent='›';arrow.setAttribute('aria-hidden','true');text.append(title,description);item.append(text,arrow);
   item.addEventListener('click',()=>{const resolve=resolveSelection;resolveSelection=null;selecting=false;dialog.close();resolve?.(topic);});list.append(item);
  }
  return new Promise(resolve=>{resolveSelection=resolve;});
 }
 button.addEventListener('click',async()=>{
  if(blocked()||mode.value!=='dev')return;
  summaryBusy=true;syncControls();sync();window.dispatchEvent(new Event('roundtable-summary-state'));
  let row;
  try{
   await ensureMeetingAccess();
   const available=Object.keys(providers).filter(id=>providerAvailable(id)&&!connecting.has(id)&&!pendingDepartures.has(id));
   if(!available.length)throw Error(t('summaryNoAI'));
   const rows=[...log.querySelectorAll('.entry')].map(entry=>({type:entry.dataset.type,failed:entry.classList.contains('failed')||entry.classList.contains('pending'),role:entry.classList.contains('user')?'user':entry.classList.contains('assistant')?'assistant':'system',speaker:entry.querySelector('strong')?.textContent,text:entry.querySelector('.entry-body')?.textContent||''}));
   const documents=VaultDocuments.export(),meetingLanguage=language.value;
   const discovery=RoundtableHandoff.topicsPrompt(rows,documents,meetingLanguage);
   const id=available[Math.floor(Math.random()*available.length)];
   list.replaceChildren();notice.textContent=providers[id].name+' · '+t('handoffFindingTopics');selecting=false;close.disabled=true;dialog.showModal();
   // Discovery is a separate request, never a meeting turn or a saved handoff.
   const result=await exchange(id,discovery,{silent:true});
   const topics=RoundtableHandoff.parseTopics(result.text);
   const target={...targets[id]};
   const selected=await choose(topics);
   if(!selected)return;
   await ensureMeetingAccess();
   if(!providerAvailable(id)||targets[id]?.tabId!==target.tabId||targets[id]?.conversationUrl!==target.conversationUrl)throw Error(t('handoffAIChanged'));
   const prompt=RoundtableHandoff.prompt(rows,documents,meetingLanguage,selected);
   row=addEntry('assistant',t('handoffCreating'),id);row.entry.dataset.type='handoff';row.meta.textContent=t('handoffLabel');
   const generated=await exchange(id,prompt,{silent:true});
   if(!generated.text?.trim())throw Error(t('summaryEmpty'));
   const record=VaultDocuments.addHandoff(generated.text,providers[id].name);
   VaultDocuments.restoreRow(row,record.id);scrollToLatest();
  }catch(error){if(dialog.open)dialog.close();if(row)row.entry.remove();setStatus('error',t(error.message));}
  finally{selecting=false;resolveSelection=null;summaryBusy=false;syncControls();sync();window.dispatchEvent(new Event('roundtable-summary-state'));automaticInvitations?.schedule();}
 });
})();
