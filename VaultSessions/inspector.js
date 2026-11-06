"use strict";
(() => {
  const t=key=>VaultI18n.t(key);
  let records=[];
  const dialog=document.createElement('dialog');dialog.className='brief-dialog';dialog.setAttribute('aria-labelledby','brief-dialog-title');
  function dialogHeader(parent,title,id){const header=document.createElement('header'),heading=document.createElement('h2'),close=document.createElement('button');heading.id=id;heading.textContent=title;close.type='button';close.className='brief-close';close.textContent='×';close.dataset.i18nAria='devRecordClose';close.setAttribute('aria-label',t('devRecordClose'));close.addEventListener('click',()=>parent.close());header.append(heading,close);parent.append(header);}
  dialogHeader(dialog,'Document Brief','brief-dialog-title');
  const hint=document.createElement('p');hint.className='brief-hint';hint.dataset.i18n='briefSessionHint';hint.textContent=t('briefSessionHint');
  const list=document.createElement('div');list.className='brief-list';dialog.append(hint,list);document.body.append(dialog);
  const time=record=>new Intl.DateTimeFormat(VaultI18n.locale,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(record.date));
  const title=record=>record.kind==='inspection'?`Inspector · ${record.speaker}`:record.title;
  function detail(body,label,text){const section=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.dataset.i18n=label;summary.textContent=t(label);pre.textContent=text;section.append(summary,pre);body.append(section);}
  function copyButton(row,record){const copy=document.createElement('button');copy.type='button';copy.className='summary-copy';copy.dataset.i18n='copySummary';copy.textContent=t('copySummary');copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(record.text);copy.dataset.i18n='copiedSummary';copy.textContent=t('copiedSummary');}catch{setStatus('error',t('copyFailed'),{inLog:false});}});row.entry.append(copy);}
  function display(record,replay=false,existing=null){
    const row=existing||addEntry(record.kind!=='inspection'?'assistant':'system','',record.kind!=='inspection'?Object.keys(providers).find(id=>providers[id].name===record.speaker):undefined);
    row.entry.dataset.type=record.kind;row.entry.dataset.recordId=record.id;
    row.entry.querySelector('strong').textContent=record.kind==='inspection'?title(record):record.speaker;
    row.meta.dataset.i18n=replay?'briefRedisplayed':record.kind==='inspection'?'devRecordInspection':record.kind==='handoff'?'handoffLabel':'summaryLabel';row.meta.textContent=t(row.meta.dataset.i18n);
    row.body.replaceChildren();
    if(record.kind!=='inspection'){RoundtableLinks.render(row.body,record.text);}
    else{
      row.entry.classList.add('dev-record');
      const report=JSON.parse(record.text),intro=document.createElement('p');intro.className='dev-record-note';intro.textContent=time(record)+' · '+t('inspectionPrivate');row.body.append(intro);
      if(record.sharedWith||record.shareErrors){const shared=document.createElement('p');shared.className='dev-record-note';shared.textContent=t('inspectionShared')+': '+((record.sharedWith||[]).join(', ')||'—')+((record.shareErrors||[]).length?' · '+t('inspectionShareFailed')+': '+record.shareErrors.join(' / '):'');row.body.append(shared);}
      const state=document.createElement('p');state.className='dev-record-result';state.textContent=`${t('inspectionState')}: ${report.state.phase} · ${report.state.visibility}`;row.body.append(state);
      const table=document.createElement('table');table.className='dev-record-table';const caption=document.createElement('caption');caption.textContent=t('devRecordMatches');table.append(caption);
      const labels={editor:'devEditor',send:'devSend',reply:'devReply',image:'devImage',stop:'inspectionStop',user:'inspectionUser'};
      for(const name of Object.keys(labels)){const checks=report.checks.filter(check=>check.name===name),tr=document.createElement('tr'),th=document.createElement('th'),td=document.createElement('td');th.scope='row';th.textContent=t(labels[name]);td.textContent=checks.map(check=>check.matches).join(' / ');tr.append(th,td);table.append(tr);}
      row.body.append(table);
      const html=report.checks.flatMap(check=>check.elements.map(element=>element.html)).filter(Boolean);
      detail(row.body,'devRecordDOM',[...new Set(html)].join(''));
      detail(row.body,'devRecordDetails',record.text);
    }
    // Each record has one copy button, including rows restored after a view switch.
    for(const button of row.entry.querySelectorAll('.summary-copy'))button.remove();copyButton(row,record);
    if(!existing)scrollToLatest();return row;
  }
  function add(record){
    const next=VaultDocumentRecords.clean([...records,record]);
    if(!next.some(item=>item.id===record.id))throw Error(t('briefTooLarge'));
    records=next;window.dispatchEvent(new Event('vaultsessions-documents-changed'));return record;
  }
  function renderList(){
    list.replaceChildren();
    if(!records.length){const empty=document.createElement('p');empty.className='brief-hint';empty.textContent=t('briefEmpty');list.append(empty);}
    for(const record of [...records].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))){const item=document.createElement('button'),text=document.createElement('span'),name=document.createElement('strong'),meta=document.createElement('small'),arrow=document.createElement('span');item.type='button';item.className='brief-record';name.textContent=title(record);meta.textContent=`${t(record.kind==='inspection'?'devRecordInspection':record.kind==='handoff'?'handoffLabel':'summaryLabel')} · ${time(record)}`;text.append(name,meta);arrow.textContent='›';arrow.setAttribute('aria-hidden','true');item.append(text,arrow);item.addEventListener('click',()=>{dialog.close();display(record,true);});list.append(item);}
  }
  document.querySelector('#open-document-brief').addEventListener('click',()=>{renderList();if(!dialog.open)dialog.showModal();list.scrollTop=list.scrollHeight;});
  const inspector=document.createElement('dialog');inspector.className='brief-dialog inspector-dialog';inspector.setAttribute('aria-labelledby','inspector-dialog-title');dialogHeader(inspector,'Inspector','inspector-dialog-title');
  const controls=document.createElement('div');controls.className='inspector-controls';const label=document.createElement('label');label.htmlFor='inspector-target';label.dataset.i18n='devInspectorTarget';label.textContent=t('devInspectorTarget');const select=document.createElement('select');select.id='inspector-target';const notice=document.createElement('p');notice.className='note';notice.dataset.i18n='inspectionConsent';notice.textContent=t('inspectionConsent');const progress=document.createElement('p');progress.className='note';progress.setAttribute('role','status');const run=document.createElement('button');run.type='button';run.className='inspector-run';run.dataset.i18n='devInspectorRun';run.textContent=t('devInspectorRun');run.disabled=true;controls.append(label,select,notice,progress,run);inspector.append(controls);document.body.append(inspector);
  const idle=()=>!controller.running&&!summaryBusy&&!isConnecting()&&!meetingRestoring&&meetingActive;
  const available=()=>Object.keys(providers).filter(id=>targets[id]&&providerAvailable(id)&&!pendingDepartures.has(id));
  select.addEventListener('change',()=>run.disabled=!idle()||!available().includes(select.value));
  document.querySelector('#open-inspector').addEventListener('click',()=>{
    select.replaceChildren();const ids=available(),placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=t(ids.length?'devInspectorChoose':'devInspectorNoAI');placeholder.disabled=true;placeholder.selected=true;select.append(placeholder);for(const id of ids){const option=document.createElement('option');option.value=id;option.textContent=providers[id].name;select.append(option);}run.disabled=true;progress.textContent=idle()?'':t('inspectionWait');if(!inspector.open)inspector.showModal();
  });
  run.addEventListener('click',async()=>{
    const selected=select.value;if(!idle()||!available().includes(selected))return;
    summaryBusy=true;syncControls();window.dispatchEvent(new Event('roundtable-summary-state'));run.disabled=true;select.disabled=true;
    try{
      await ensureMeetingAccess();
      const participants=Object.keys(providers).filter(id=>targets[id]);
      const ownTab=isSidePanel?(await chrome.tabs.query({active:true,currentWindow:true}))[0]:await chrome.tabs.getCurrent();
      progress.textContent=t('inspectionReading');
      const result=await request({type:'ROUNDTABLE_INSPECT',provider:selected,...targets[selected]});
      if(!result.report||result.report.provider!==selected)throw Error(t('inspectionInvalid'));
      const report={...result.report,appVersion:VERSION,contextVersion:VaultInspectorContext.version};
      const record=add({id:crypto.randomUUID(),kind:'inspection',speaker:providers[selected].name,date:report.capturedAt,title:'Inspector · '+providers[selected].name,text:JSON.stringify(report)});
      inspector.close();const row=display(record);
      const sharingStatus=document.createElement('p');sharingStatus.className='dev-record-note';row.body.append(sharingStatus);
      const shared=[],failed=[];
      for(const id of participants){
        sharingStatus.textContent=t('inspectionContext')+' · '+providers[id].name;
        try{
          const delivered=await request({type:'ROUNDTABLE_INSPECTOR_SHARE',provider:id,...targets[id],report:record.text,recordId:record.id,requestId:crypto.randomUUID(),returnTabId:ownTab?.id,guardText:t('inputGuardNotice')});
          targets[id]={tabId:delivered.tabId,conversationUrl:delivered.url};renderConnection();shared.push(providers[id].name);
        }catch(error){failed.push(providers[id].name+': '+uiText(error.message));}
      }
      sharingStatus.textContent=t('inspectionShared')+': '+(shared.join(', ')||'—')+(failed.length?' · '+t('inspectionShareFailed')+': '+failed.join(' / '):'');
      record.sharedWith=shared;record.shareErrors=failed;
      records=VaultDocumentRecords.clean(records.map(item=>item.id===record.id?record:item));window.dispatchEvent(new Event('vaultsessions-documents-changed'));
    }catch(error){progress.textContent=uiText(error.message);}
    finally{summaryBusy=false;select.disabled=false;syncControls();window.dispatchEvent(new Event('roundtable-summary-state'));run.disabled=!idle()||!available().includes(select.value);automaticInvitations?.schedule();}
  });
  const inspectorHint=document.createElement('button');inspectorHint.type='button';inspectorHint.className='inspector-error-hint';inspectorHint.textContent='Inspector';inspectorHint.hidden=true;
  inspectorHint.addEventListener('click',()=>document.querySelector('#open-inspector').click());
  status.after(inspectorHint);
  const updateHint=()=>{inspectorHint.hidden=status.dataset.state!=='error'||status.hidden;};
  new MutationObserver(updateHint).observe(status,{attributes:true,attributeFilter:['data-state','hidden'],childList:true});updateHint();
  globalThis.VaultDocuments={
    export:()=>VaultDocumentRecords.clean(records),
    restore:saved=>{records=VaultDocumentRecords.clean(saved);},
    restoreRow:(row,id)=>{const record=records.find(item=>item.id===id);if(record)display(record,false,row);},
    addHandoff:(text,speaker)=>add({id:crypto.randomUUID(),kind:'handoff',speaker,date:new Date().toISOString(),title:text.split('\n').map(line=>line.replace(/^[#*\s-]+/,'').trim()).find(Boolean)?.slice(0,100)||t('handoffLabel'),text}),
    addSummary:(text,speaker)=>add({id:crypto.randomUUID(),kind:'summary',speaker,date:new Date().toISOString(),title:text.split('\n').map(line=>line.replace(/^[#*\s-]+/,'').trim()).find(Boolean)?.slice(0,100)||t('summaryLabel'),text})
  };
  window.addEventListener('vaultsessions-language',()=>{if(dialog.open)renderList();});
})();
