'use strict';
(() => {
  const rows = new Map();
  const originalLink = (row, task) => {
    const link=document.createElement('a');link.href=task.conversationUrl;link.target='_blank';link.rel='noopener noreferrer';
    link.dataset.i18n='imageJobOpen';link.textContent=VaultI18n.t('imageJobOpen');row.body.append(link);
  };
  function render(row,task,state,images=[]){
    row.entry.dataset.type='image-generation';row.entry.dataset.imageTask=JSON.stringify({...task,state});
    row.entry.dataset.state=state;row.entry.classList.remove('pending');row.pending=false;
    row.body.removeAttribute('role');row.body.replaceChildren();
    const label=document.createElement('p');label.dataset.i18n=state==='complete'?'imageJobComplete':state==='error'?'imageJobFailed':'imageJobWaiting';label.textContent=VaultI18n.t(label.dataset.i18n);row.body.append(label);
    if(task.topic){const topic=document.createElement('p');topic.className='image-job-topic';topic.textContent=task.topic;row.body.append(topic);}
    if(images.length){
      const gallery=document.createElement('div');gallery.className='generated-image-gallery';
      RoundtableGeneratedImages.clean(images).forEach((image,index)=>{
        const figure=document.createElement('figure'),img=document.createElement('img'),download=document.createElement('a');
        img.src=image.dataUrl;img.alt=VaultI18n.t('imageJobAlt',{number:index+1});img.width=image.width;img.height=image.height;
        download.href=image.dataUrl;download.download=image.name;download.dataset.i18n='imageJobDownload';download.textContent=VaultI18n.t('imageJobDownload');
        figure.append(img,download);gallery.append(figure);
      });row.body.append(gallery);
      const note=document.createElement('p');note.className='note';note.dataset.i18n='imageJobPreview';note.textContent=VaultI18n.t('imageJobPreview');row.body.append(note);
    }
    originalLink(row,task);
    row.meta.dataset.i18n=state==='complete'?'imageJobComplete':state==='error'?'imageJobFailed':'imageJobGenerating';row.meta.textContent=VaultI18n.t(row.meta.dataset.i18n);
  }
  imageJobs = new RoundtableImageJobs.Jobs({
    canPoll:()=>meetingActive&&!meetingRestoring,
    status:task=>request({type:'ROUNDTABLE_STATUS',provider:task.provider,tabId:task.tabId,requestId:task.requestId,backgroundImage:true}),
    recover:task=>request({type:'ROUNDTABLE_IMAGE_IDLE',provider:task.provider,tabId:task.tabId,requestId:task.requestId,conversationUrl:task.conversationUrl}),
    collect:task=>request({type:'ROUNDTABLE_IMAGE_RESULT',provider:task.provider,tabId:task.tabId,requestId:task.requestId}),
    onEvent:event=>{
      const row=rows.get(event.task.requestId);if(!row)return;
      if(event.type==='recovered'){
        row.entry.dataset.imageTask=JSON.stringify({...event.task,state:'error',resolved:true});
        if(targets[event.task.provider]?.tabId===event.task.tabId){
          if(event.disconnected)delete targets[event.task.provider];
          else providerStatus(event.task.provider,'success',VaultI18n.t('message_048'));
        }
      }else if(event.type==='text-complete'){
        delete row.entry.dataset.type;
        delete row.entry.dataset.imageTask;
        row.entry.dataset.state='complete';
        renderResponse(row.body,event.text,event.richText);
        row.meta.dataset.i18n='message_058';
        row.meta.textContent=VaultI18n.t('message_058');
        if(targets[event.task.provider]?.tabId===event.task.tabId){
          providerStatus(event.task.provider,'success',VaultI18n.t('message_048'));
        }
        rows.delete(event.task.requestId);
      }else if(event.type==='complete'){
        render(row,event.task,'complete',event.images);
        imageRelays?.enqueue(event.task,event.images,targets);
        if(targets[event.task.provider]?.tabId===event.task.tabId){
          providerStatus(event.task.provider,'success',VaultI18n.t('imageJobComplete'));
        }
      }else if(event.type==='error'){
        render(row,{...event.task,error:event.error},'error');
        providerStatus(event.task.provider,'error',VaultI18n.t('imageJobFailed'));
      }else{
        render(row,event.task,event.task.failed?'error':'waiting');
        if(!event.task.failed && targets[event.task.provider]?.tabId===event.task.tabId){
          providerStatus(event.task.provider,'sending',VaultI18n.t('imageJobGenerating'));
        }
      }
      const provider = event.task.provider;
      if (!imageJobs.isBusy(provider) && status.dataset.state === 'error' &&
          status.textContent === VaultI18n.t('imageJobBusy',{name:providers[provider].name})) {
        setStatus('ready',VaultI18n.t('message_048'),{inLog:false});
      }
      renderParticipants();automaticInvitations?.schedule();
    }
  });
  window.addEventListener('roundtable-image-job',event=>{
    const {task,row,images}=event.detail;rows.set(task.requestId,row);
    if(images?.length){render(row,task,'complete',images);imageRelays?.enqueue(task,images,targets);renderParticipants();}
    else imageJobs.add(task);
  });
  globalThis.restoreImageJobRow=(row,task,images)=>{
    if(!task||!['chatgpt','gemini','claude'].includes(task.provider))return;
    rows.set(task.requestId,row);
    if(task.resolved)render(row,task,'error');
    else if(task.state==='complete')render(row,task,'complete',images||[]);
    else imageJobs.add(task);
  };
  window.addEventListener('pagehide',()=>imageJobs.dispose());
  window.addEventListener('roundtable-park',()=>imageJobs.dispose());
})();
