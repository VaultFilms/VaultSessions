'use strict';
(function(root){
 class Playback {
  constructor({request,onChange=()=>{},sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=Date.now}){Object.assign(this,{request,onChange,sleep,now});this.enabled=false;this.active=null;}
  get busy(){return !!this.active;}
  setEnabled(enabled){this.enabled=!!enabled;if(!enabled&&this.active)this.active.stop=true;}
  next(){if(this.active)this.active.stop=true;}
  async play(provider,result,{cancelled=()=>false}={}){
   if(!this.enabled||!result?.speech||cancelled())return;
   if(this.active)throw Error('Read-aloud is already active.');
   const flight={provider,...result.speech,stop:false};this.active=flight;
   const call=action=>this.request({type:'ROUNDTABLE_SPEECH',...flight,action});
   const update=state=>this.onChange({provider,state,busy:true});
   try{
    update('starting');
    let state=await call('start'),started=this.now();
    if(state.state==='unsupported'){this.onChange({provider,state:'unsupported',busy:false});return;}
    while(this.active===flight){
     if(flight.stop||cancelled()){
      let stopped=await call('stop').catch(()=>({ok:false,state:'unavailable'}));
      for(let attempt=0;attempt<8&&stopped.ok&&['speaking','starting'].includes(stopped.state);attempt++){
       await this.sleep(200);stopped=await call('status').catch(()=>({ok:false,state:'unavailable'}));
      }
      if(cancelled()||flight.unconfirmed||stopped.ok&&['stopped','complete','paused','unsupported'].includes(stopped.state))return;
      update('stopFailed');flight.unconfirmed=true;flight.stop=false;
     }else if(state.ok&&state.state==='complete')return;
     else update(flight.unconfirmed?'stopFailed':!state.ok||this.now()-started>300000?'unavailable':state.state||'unavailable');
     await this.sleep(350);
     if(!flight.stop&&!cancelled())state=await call('status').catch(()=>({ok:false,state:'unavailable'}));
    }
   }catch(error){
    // A failed start may still have reached the site. Require an explicit continuation.
    update('unavailable');
    while(!flight.stop&&!cancelled())await this.sleep(350);
    await call('stop').catch(()=>{});
   }finally{
    if(this.active===flight)this.active=null;
    this.onChange({provider,state:'idle',busy:false});
   }
  }
 }
 const api={Playback};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RoundtableSpeechPlayback=api;
})(globalThis);
