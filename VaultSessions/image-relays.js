'use strict';
// Each recipient consumes its own FIFO. Replies never become discussion contributions.
(function(root) {
  const Generated = typeof module !== 'undefined' && module.exports ? require('./generated-images.js') : root.RoundtableGeneratedImages;
  const Images = typeof module !== 'undefined' && module.exports ? require('./image-utils.js') : root.RoundtableImages;
  const providers = ['chatgpt', 'gemini', 'claude'];
  const same = (a, b) => !!a && !!b && a.tabId === b.tabId && a.conversationUrl === b.conversationUrl;
  function attachment(image) {
    const type = image.dataUrl.slice(5, image.dataUrl.indexOf(';'));
    const body = image.dataUrl.slice(image.dataUrl.indexOf(',') + 1);
    return Images.validate([{name:image.name, type, dataUrl:image.dataUrl,
      size:body.length / 4 * 3 - (body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0)}])[0];
  }
  function clean(snapshot = {}) {
    if (!Array.isArray(snapshot.tasks || []) || !Array.isArray(snapshot.flights || []) || !Array.isArray(snapshot.seen || [])) throw Error('Invalid image relay state.');
    const target = value => {
      if (!value || !providers.includes(value.provider) || !Number.isInteger(value.tabId) || typeof value.conversationUrl !== 'string' ||
        !(value.provider === 'chatgpt' ? /^https:\/\/chatgpt\.com\/c\/[^/?#]+\/?$/ : value.provider === 'gemini' ? /^https:\/\/gemini\.google\.com\/(?:u\/\d+\/)?app\/[^/?#]+\/?$/ : /^https:\/\/claude\.ai\/chat\/[^/?#]+\/?$/).test(value.conversationUrl)) throw Error('Invalid image relay target.');
      return {provider:value.provider,tabId:value.tabId,conversationUrl:value.conversationUrl};
    };
    const id = value => {if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{1,120}$/.test(value)) throw Error('Invalid image relay ID.'); return value;};
    return {
      tasks:(snapshot.tasks || []).map(task => ({imageId:id(task.imageId),source:providers.includes(task.source) ? task.source : (()=>{throw Error('Invalid image relay source.');})(),
        image:Generated.clean([task.image])[0],pendingTargets:task.pendingTargets.map(target).filter(item=>item.provider!==task.source)})),
      flights:(snapshot.flights || []).map(flight => ({...target(flight),imageId:id(flight.imageId),requestId:id(flight.requestId),
        phase:flight.phase==='waiting'?'waiting':'uncertain',notified:flight.notified===true})),
      seen:(snapshot.seen || []).map(id)
    };
  }
  class Queue {
    constructor({getTarget,canSend=()=>true,canProcess=()=>true,send,status,idle,onChange=()=>{},onError=()=>{},
      setTimer=(...args)=>setTimeout(...args),clearTimer=id=>clearTimeout(id),now=Date.now,uuid=()=>crypto.randomUUID()}) {
      Object.assign(this,{getTarget,canSend,canProcess,send,status,idle,onChange,onError,setTimer,clearTimer,now,uuid});
      this.tasks=[];this.flights=new Map();this.seen=new Set();this.retryAt=new Map();this.timer=null;this.polling=false;this.closed=false;
    }
    isBusy(provider) {return this.flights.has(provider);}
    get busy() {return this.flights.size>0;}
    changed() {if(!this.closed)this.onChange();this.schedule();}
    enqueue(task, images, targets) {
      if(this.closed || this.seen.has(task.requestId))return;
      const previews=Generated.clean(images);previews.forEach(attachment);
      const recipients=Object.entries(targets).filter(([provider,value])=>providers.includes(provider)&&provider!==task.provider&&value)
        .map(([provider,value])=>({provider,tabId:value.tabId,conversationUrl:value.conversationUrl}));
      this.seen.add(task.requestId);
      for(const [index,image] of previews.entries())if(recipients.length)this.tasks.push({imageId:task.requestId+'-'+(index+1),source:task.provider,image,pendingTargets:recipients.map(item=>({...item}))});
      this.changed();void this.poll();
    }
    export() {return clean({tasks:this.tasks,flights:[...this.flights.values()],seen:[...this.seen]});}
    restore(snapshot) {
      const state=clean(snapshot);this.tasks=state.tasks;this.flights=new Map(state.flights.map(item=>[item.provider,item]));this.seen=new Set(state.seen);this.changed();
    }
    schedule() {if(!this.closed&&!this.timer&&(this.tasks.length||this.flights.size))this.timer=this.setTimer(()=>{this.timer=null;void this.poll();},1000);}
    async poll() {
      if(this.closed||this.polling)return;
      if(!this.canProcess()){this.schedule();return;}
      this.polling=true;
      try {
        await Promise.all([...this.flights.values()].map(async flight=>{
          if(flight.phase==='sending')return;
          if(this.getTarget(flight.provider)&&!same(this.getTarget(flight.provider),flight)){this.forget(flight.provider);return;}
          try {
            const state=await this.status(flight);
            if(this.closed||this.flights.get(flight.provider)!==flight)return;
            if(state?.ok&&state.phase==='complete'){
              // A receipt-confirmed delivery may have outlived its meeting view.
              this.delivered(flight);this.flights.delete(flight.provider);this.changed();return;
            }
            if(!state?.ok||state.phase==='error') {
              if(flight.phase==='uncertain') {this.error(flight,Error(state?.error||'Image delivery is uncertain. Check the official chat.'));return;}
              const ready=await this.idle(flight);
              if(this.closed||this.flights.get(flight.provider)!==flight)return;
              if(ready?.idle){this.flights.delete(flight.provider);this.changed();}
            }
          }catch(error){this.error(flight,error);}
        }));
        if(this.closed||!this.canProcess())return;
        for(const provider of providers) {
          if(this.flights.has(provider)||!this.canSend(provider)||(this.retryAt.get(provider)||0)>this.now())continue;
          const task=this.tasks.find(task=>task.pendingTargets.some(item=>item.provider===provider));
          if(!task)continue;
          const target=task.pendingTargets.find(item=>item.provider===provider);
          if(!this.getTarget(provider))continue;
          if(!same(this.getTarget(provider),target)){
            task.pendingTargets=task.pendingTargets.filter(item=>item!==target);this.tasks=this.tasks.filter(item=>item.pendingTargets.length);this.changed();continue;
          }
          const flight={...target,imageId:task.imageId,requestId:this.uuid(),phase:'sending'};
          this.flights.set(provider,flight);this.changed();void this.deliver(task,flight);
        }
      }finally{this.polling=false;this.schedule();}
    }
    delivered(flight) {
      const task=this.tasks.find(item=>item.imageId===flight.imageId);
      if(task)task.pendingTargets=task.pendingTargets.filter(item=>item.provider!==flight.provider);
      this.tasks=this.tasks.filter(item=>item.pendingTargets.length);
    }
    async deliver(task,flight) {
      try {
        const result=await this.send(flight,attachment(task.image),task.source);
        if(this.closed||this.flights.get(flight.provider)!==flight)return;
        if(result?.ok){this.delivered(flight);flight.phase='waiting';this.retryAt.delete(flight.provider);}
        else if(result?.uncertain){flight.phase='uncertain';this.error(flight,Error(result.error||'Image delivery is uncertain. Check the official chat.'));}
        else {this.flights.delete(flight.provider);this.retryAt.set(flight.provider,this.now()+5000);if(!result?.retry)this.onError(flight,Error(result?.error||'Unable to relay the generated image.'));}
      }catch(error){if(!this.closed&&this.flights.get(flight.provider)===flight){flight.phase='uncertain';this.error(flight,error);}}
      this.changed();
    }
    error(flight,error) {if(!this.closed&&!flight.notified){flight.notified=true;this.onError(flight,error);}}
    forget(provider) {
      for(const task of this.tasks)task.pendingTargets=task.pendingTargets.filter(item=>item.provider!==provider);
      this.tasks=this.tasks.filter(item=>item.pendingTargets.length);this.flights.delete(provider);this.retryAt.delete(provider);this.changed();
    }
    dispose() {this.closed=true;this.clearTimer(this.timer);this.timer=null;}
  }
  const api={Queue,clean,attachment,same};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RoundtableImageRelays=api;
})(globalThis);
