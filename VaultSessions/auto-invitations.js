'use strict';
(function(root) {
  class Coordinator {
    constructor({discover, invite, getTarget, removeTarget, canConnect, onState, setTimer=(fn,ms)=>setTimeout(fn,ms), clearTimer=timer=>clearTimeout(timer)}) {
      Object.assign(this,{discover,invite,getTarget,removeTarget,canConnect,onState,setTimer,clearTimer});
      this.paused=new Set();this.attempted=new Map();this.scanning=false;this.dirty=false;this.closed=false;this.timer=null;this.retries=0;
    }
    schedule(delay=400) {
      if(this.closed)return;
      this.dirty=true;this.clearTimer(this.timer);
      this.timer=this.setTimer(()=>{this.timer=null;void this.scan();},delay);
    }
    changed(tabId) {
      this.retries=0;
      if(Number.isInteger(tabId))for(const [id,key]of this.attempted)if(key.startsWith(tabId+':'))this.attempted.delete(id);
      this.schedule();
    }
    pause(id) {this.paused.add(id);this.onState(id,{state:'paused'});}
    resume(id) {this.paused.delete(id);this.attempted.delete(id);}
    async scan() {
      if(this.closed)return;
      if(this.scanning||!this.canConnect()){this.dirty=true;return;}
      this.scanning=true;this.dirty=false;let waiting=false;
      try {
        const states=await this.discover();
        if(this.closed)return;
        for(const status of states) {
          if(this.closed)break;
          if(!this.canConnect()){this.dirty=true;break;}
          const id=status.provider;
          if(this.paused.has(id)){this.onState(id,{state:'paused'});continue;}
          const target=this.getTarget(id);
          if(target&&(status.candidates||[]).some(tab=>tab.tabId===target.tabId))continue;
          if(target)this.removeTarget(id);
          if(status.state==='ready') {
            const key=`${status.tabId}:${status.url}`;
            if(this.attempted.get(id)===key)continue;
            this.attempted.set(id,key);
            await this.invite(id,status.tabId);
          } else {
            this.onState(id,status);
            if(status.state==='waiting')waiting=true;
          }
        }
      } catch(error) {this.onState(null,{state:'error',error:error.message});}
      finally {
        this.scanning=false;
        if(this.dirty)this.schedule();
        else if(waiting&&this.retries<4)this.schedule([1000,2500,5000,10000][this.retries++]);
      }
    }
    dispose(){this.closed=true;this.clearTimer(this.timer);}
  }
  const api={Coordinator};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RoundtableAutoInvitations=api;
})(globalThis);
