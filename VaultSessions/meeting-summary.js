'use strict';
(()=>{
 const summarize=document.querySelector('#summarize');
 function decorate(entry){
  entry.entry.dataset.type='summary';entry.meta.textContent=VaultI18n.t('summaryLabel');
  const copy=document.createElement('button');copy.type='button';copy.className='summary-copy';copy.dataset.i18n='copySummary';copy.textContent=VaultI18n.t('copySummary');
  copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(entry.body.textContent);copy.dataset.i18n='copiedSummary';copy.textContent=VaultI18n.t('copiedSummary');}catch{setStatus('error',VaultI18n.t('copyFailed'));}});
  entry.entry.append(copy);
 }
 window.addEventListener('roundtable-summary-restore',event=>decorate(event.detail));
 const sync=()=>summarize.disabled=summaryBusy||controller.running||isConnecting()||meetingRestoring||!meetingActive;
 new MutationObserver(sync).observe(document.querySelector('#send'),{attributes:true,attributeFilter:['disabled']});sync();
 summarize.addEventListener('click',async()=>{
  if(summaryBusy||controller.running||isConnecting()||meetingRestoring)return;
  summaryBusy=true;syncControls();sync();
  let resultRow;
  try{
   await ensureMeetingAccess();
   const available=Object.keys(providers).filter(id=>providerAvailable(id)&&!connecting.has(id)&&!pendingDepartures.has(id));
   if(!available.length)throw Error(VaultI18n.t('summaryNoAI'));
   const rows=[...log.querySelectorAll('.entry')].map(row=>({type:row.dataset.type||((row.classList.contains('failed')||row.classList.contains('pending'))?'summary':undefined),role:row.classList.contains('user')?'user':row.classList.contains('assistant')?'assistant':'system',speaker:row.querySelector('strong')?.textContent,text:row.querySelector('.entry-body')?.textContent||''}));
   const text=RoundtableSummary.prompt(rows,language.value),id=available[Math.floor(Math.random()*available.length)];
   summaryBusy=true;syncControls();sync();window.dispatchEvent(new Event('roundtable-summary-state'));
   resultRow=addEntry('assistant',VaultI18n.t('summarizing'),id);resultRow.entry.dataset.type='summary';resultRow.meta.textContent=VaultI18n.t('summaryLabel');
   const result=await exchange(id,text);
   if(!result.text?.trim())throw Error(VaultI18n.t('summaryEmpty'));
   const savedDocument=VaultDocuments.addSummary(result.text,providers[id].name);
   resultRow.entry.dataset.recordId=savedDocument.id;
   RoundtableLinks.render(resultRow.body,result.text);decorate(resultRow);
   // Clear the display and regular history only after a successful summary response.
   for(const row of [...log.querySelectorAll('.entry')])if(row!==resultRow.entry&&!(row.dataset.type==='image-generation'&&row.dataset.imageTask&&imageJobs?.tasks.has(JSON.parse(row.dataset.imageTask).requestId)))row.remove();
   controller.history=[];controller.seen.clear();runRows.clear();
   scrollToLatest();setStatus('success',VaultI18n.t('summaryDone'));
  }catch(error){if(resultRow){resultRow.entry.remove();if(!log.querySelector('.entry'))empty.hidden=false;}setStatus('error',error.message);}
  finally{summaryBusy=false;syncControls();sync();window.dispatchEvent(new Event('roundtable-summary-state'));automaticInvitations?.schedule();}
 });
})();
