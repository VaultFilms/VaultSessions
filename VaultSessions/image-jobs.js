'use strict';
// Image generation is independent of the discussion loop; late results never advance that loop.
(function(root) {
  class Jobs {
    constructor({status,collect,recover=async()=>({idle:false}),onEvent=()=>{},canPoll=()=>true,setTimer=(...args)=>setTimeout(...args),clearTimer=id=>clearTimeout(id),now=Date.now}) {
      Object.assign(this,{status,collect,recover,onEvent,canPoll,setTimer,clearTimer,now});
      this.tasks=new Map();this.timer=null;this.polling=false;this.closed=false;
    }
    isBusy(provider) { return [...this.tasks.values()].some(task=>task.provider===provider); }
    add(task) {
      if (this.tasks.has(task.requestId)) return;
      if (!task || !['chatgpt','gemini','claude'].includes(task.provider) || !Number.isInteger(task.tabId) || typeof task.requestId!=='string' ||
        !/^[a-zA-Z0-9-]{1,80}$/.test(task.requestId) || !(task.provider==='chatgpt'?/^https:\/\/chatgpt\.com\/c\/[^/?#]+\/?$/:task.provider==='gemini'?/^https:\/\/gemini\.google\.com\/(?:u\/\d+\/)?app\/[^/?#]+\/?$/:/^https:\/\/claude\.ai\/chat\/[^/?#]+\/?$/).test(task.conversationUrl)) throw Error('Invalid image task.');
      const item={...task,startedAt:Number.isFinite(task.startedAt)?task.startedAt:this.now()};
      this.tasks.set(item.requestId,item);this.onEvent({type:'waiting',task:item});this.schedule();
    }
    schedule() {if(!this.closed&&!this.timer&&this.tasks.size)this.timer=this.setTimer(()=>{this.timer=null;void this.poll();},1500);}
    async poll() {
      if(this.closed||this.polling)return;
      if(!this.canPoll()){this.schedule();return;}
      this.polling=true;
      try {
        for(const task of this.tasks.values()) {
          if(this.closed)break;
          if(task.failed){
            try {
              const state=await this.recover(task);
              if(!this.closed&&state?.idle){this.tasks.delete(task.requestId);this.onEvent({type:'recovered',task,disconnected:state.disconnected===true});}
            }catch{} // A missing reply is not proof that the provider is ready.
            continue;
          }
          try {
            if(this.now()-task.startedAt>20*60*1000)throw Error('Image generation timed out. Check the official chat.');
            const state=await this.status(task);
            if(this.closed)break;
            if(!state?.ok || state.phase==='error')throw Error(state?.error||'Image generation was interrupted.');
            if(state.phase!=='complete')continue;
            const result=await this.collect(task);
            if(this.closed)break;
            if(result?.ok&&result.pending)continue;
            if(!result?.ok || !result.images?.length)throw Error(result?.error||'Unable to retrieve the generated image.');
            this.tasks.delete(task.requestId);
            this.onEvent({type:'complete',task,images:result.images,text:result.text||''});
          } catch(error) {
            if(this.closed)break;
            // A local timeout does not prove the provider has stopped. Resume only after an idle check.
            task.failed=true;this.onEvent({type:'error',task,error:error.message});
          }
        }
      } finally {this.polling=false;this.schedule();}
    }
    forget(provider) {for(const [key,task]of this.tasks)if(task.provider===provider)this.tasks.delete(key);}
    dispose() {this.closed=true;this.clearTimer(this.timer);this.timer=null;}
  }
  const api={Jobs};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RoundtableImageJobs=api;
})(globalThis);
