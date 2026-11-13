'use strict';
(function(root){
  const documents=root.VaultDocumentRecords||(typeof require==='function'?require('./document-records.js'):null);
  const relays=root.RoundtableImageRelays||(typeof require==='function'?require('./image-relays.js'):null);
  const rich=root.RoundtableRichText||(typeof require==='function'?require('./rich-text.js'):null);
  const KEY='roundtableMeetingSessionV1';
  function imageState(row){
    if(row.type!=='image-generation')return {};
    const task=row.imageTask;
    if(!task||!['chatgpt','gemini','claude','grok'].includes(task.provider)||!Number.isInteger(task.tabId)||!Number.isFinite(task.startedAt)||typeof task.requestId!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(task.requestId)||typeof task.conversationUrl!=='string'||!(task.provider==='grok'?/^https:\/\/grok\.com\/c\/[^/?#]+\/?$/:task.provider==='chatgpt'?/^https:\/\/chatgpt\.com\/c\/[^/?#]+\/?$/:task.provider==='gemini'?/^https:\/\/gemini\.google\.com\/(?:u\/\d+\/)?app\/[^/?#]+\/?$/:/^https:\/\/claude\.ai\/chat\/[^/?#]+\/?$/).test(task.conversationUrl))throw Error('Invalid image-generation task.');
    const images=row.generatedImages||[];
    if(!Array.isArray(images)||images.length>4)throw Error('Invalid generated-image previews.');
    const generatedImages=images.map(img=>{
      if(!img||typeof img.dataUrl!=='string'||img.dataUrl.length>380000||!/^data:image\/(?:webp|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(img.dataUrl)||!Number.isInteger(img.width)||!Number.isInteger(img.height)||img.width<1||img.height<1||img.width>1600||img.height>1600)throw Error('Invalid generated-image preview.');
      return {dataUrl:img.dataUrl,width:img.width,height:img.height,name:typeof img.name==='string'?img.name.slice(0,100):'generated-image.webp'};
    });
    return {imageTask:{provider:task.provider,tabId:task.tabId,requestId:task.requestId,conversationUrl:task.conversationUrl,startedAt:task.startedAt,topic:typeof task.topic==='string'?task.topic.slice(0,1000):'',failed:task.failed===true,resolved:task.resolved===true,state:['complete','error','abandoned'].includes(task.state)?task.state:'waiting'},generatedImages};
  }
  function clean(snapshot){
    if(!snapshot||snapshot.version!==1||!Array.isArray(snapshot.rows)||!Array.isArray(snapshot.history))throw Error('会議ログの形式が不正です。');
    if(JSON.stringify(snapshot).length>3000000)throw Error('一時ログの容量上限を超えました。');
    const rows=snapshot.rows.slice(-500).filter(row=>['user','assistant','system'].includes(row.role)&&typeof row.text==='string'&&row.text.length<=50000&&typeof row.meta==='string'&&(row.role!=='assistant'||['chatgpt','gemini','claude','grok'].includes(row.provider))).map(row=>{const {role,text,meta,provider,timestamp,type}=row;const richText=role==='assistant'?rich?.clean(row.richText):null;return {role,text,meta,provider,...(richText?{richText}:{}),...(typeof row.recordId==='string'?{recordId:row.recordId.slice(0,80)}:{}),...imageState(row),...(['summary','handoff','image-generation','inspection'].includes(type)?{type}:{}),...(Number.isFinite(timestamp)&&timestamp>0?{timestamp}:{})};});
    const history=snapshot.history.slice(-500).filter(item=>!['summary','handoff','inspection'].includes(item.type)&&typeof item.text==='string'&&item.text.length<=50000&&['Human','ChatGPT','Gemini','Claude','Grok'].includes(item.speaker)).map((item,index)=>({seq:index+1,text:item.text,speaker:item.speaker,runId:Number.isInteger(item.runId)?item.runId:0}));
    return {version:1,rows,history,...(snapshot.imageRelays?{imageRelays:relays.clean(snapshot.imageRelays)}:{}),...(snapshot.documents?{documents:documents.clean(snapshot.documents)}:{}),serial:Number.isInteger(snapshot.serial)?snapshot.serial:0,settings:snapshot.settings&&typeof snapshot.settings==='object'?snapshot.settings:{},draft:typeof snapshot.draft==='string'?snapshot.draft.slice(0,20000):''};
  }
  class Store{
    constructor(storage){this.storage=storage;this.tail=Promise.resolve();}
    run(operation,persist=true){const next=this.tail.then(async()=>{const data=(await this.storage.get(KEY))[KEY]||{owner:null,snapshot:null,busy:false};const result=await operation(data);if(persist)await this.storage.set({[KEY]:data});return result;});this.tail=next.catch(()=>{});return next;}
    handle(message){
      if(typeof message.clientId!=='string'||!/^[a-f0-9-]{36}$/.test(message.clientId))return Promise.reject(Error('会議画面のIDが不正です。'));
      return this.run(data=>{
        const owns=data.owner===message.clientId;
        if(message.operation==='load'){
          if(message.view==='sidepanel'&&data.mode==='web')return {ok:true,snapshot:data.snapshot,active:false,blocked:true,mode:'web'};
          if(message.acquire&&message.view==='web'&&(!data.mode||!data.busy)){data.mode='web';data.owner=null;data.busy=false;}
          if(message.acquire&&message.view==='sidepanel'&&!data.mode)data.mode='sidepanel';
          if(message.acquire&&(!data.owner||!data.busy||Date.now()-(data.updatedAt||0)>60000)){data.owner=message.clientId;data.busy=false;data.updatedAt=Date.now();}
          if(!data.snapshot&&message.bootstrap)data.snapshot=clean(message.bootstrap);
          return {ok:true,snapshot:data.snapshot,active:data.owner===message.clientId,mode:data.mode};
        }
        if(!owns)throw Object.assign(Error('会議は別の画面へ移動しました。切り替え先の画面で続けてください。'),{code:'SESSION_MOVED'});
        data.updatedAt=Date.now();
        if(message.operation==='save'){data.snapshot=clean(message.snapshot);data.busy=message.busy===true;}
        else if(message.operation==='handoff'){if(data.busy)throw Error('回答の回収が終わってから切り替えてください。');data.snapshot=clean(message.snapshot);data.owner=null;data.busy=false;if(['web','sidepanel'].includes(message.view))data.mode=message.view;}
        else if(message.operation==='touch'){data.busy=message.busy===true;}
        else if(message.operation==='release'){data.owner=null;data.busy=false;}
        else throw Error('会議保存の操作が不正です。');
        return {ok:true};
      });
    }
    sidebarOpened(snapshot){return this.run(data=>{if(snapshot)data.snapshot=clean(snapshot);if(data.mode==='web'||snapshot){data.owner=null;data.busy=false;}data.mode='sidepanel';return {ok:true};});}
    verify(clientId){return this.run(data=>{if(data.owner&&data.owner!==clientId)throw Error('会議は別の画面で操作中です。そちらで続けてください。');return true;},false);}
  }
  const api={Store,clean};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RoundtableSession=api;
})(typeof globalThis!=='undefined'?globalThis:this);
