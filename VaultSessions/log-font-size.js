'use strict';
(() => {
  const log=document.querySelector('#meeting-log');
  const smaller=document.querySelector('#log-font-smaller');
  const larger=document.querySelector('#log-font-larger');
  const reset=document.querySelector('#log-font-reset');
  let step=0,revision=0,writes=Promise.resolve();
  function apply(next){
    next=Math.max(-2,Math.min(6,next));
    if(next!==step){
      const bounds=log.getBoundingClientRect();
      const bottom=log.scrollHeight-log.clientHeight-log.scrollTop<=4;
      const anchor=[...log.querySelectorAll('.entry')].find(row=>row.getBoundingClientRect().bottom>bounds.top);
      const offset=anchor?anchor.getBoundingClientRect().top-bounds.top:0;
      // Disable browser scroll anchoring while applying our utterance-based correction.
      const anchoring=log.style.overflowAnchor;
      log.style.overflowAnchor='none';
      log.style.setProperty('--log-font-scale',String(1+next*0.125));
      if(bottom)log.scrollTop=log.scrollHeight;
      else if(anchor)log.scrollTop+=anchor.getBoundingClientRect().top-log.getBoundingClientRect().top-offset;
      log.style.overflowAnchor=anchoring;
      step=next;
    }
    smaller.disabled=step===-2;larger.disabled=step===6;reset.disabled=step===0;
  }
  function change(next){
    revision++;apply(next);
    const value=step;
    writes=writes.catch(()=>{}).then(()=>request({type:'ROUNDTABLE_LOG_FONT',operation:'save',step:value}));
    writes.catch(()=>setStatus('error',VaultI18n.t('logTextSaveError'),{inLog:false}));
  }
  async function load(){
    const previous=revision;
    try{
      await writes.catch(()=>{});
      const result=await request({type:'ROUNDTABLE_LOG_FONT',operation:'load'});
      if(previous===revision&&Number.isInteger(result.step))apply(result.step);
    }catch{} // The meeting's connection error UI already handles an unavailable extension.
  }
  smaller.addEventListener('click',()=>change(step-1));
  larger.addEventListener('click',()=>change(step+1));
  reset.addEventListener('click',()=>change(0));
  window.addEventListener('focus',()=>void load());
  apply(0);void load();
})();
