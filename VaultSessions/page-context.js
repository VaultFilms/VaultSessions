'use strict';
(function(root) {
  const AI_HOSTS = ['chatgpt.com','chat.openai.com','gemini.google.com','claude.ai'];
  function allowed(url) {
    try { const parsed=new URL(url);return ['http:','https:'].includes(parsed.protocol)&&!AI_HOSTS.some(host=>parsed.hostname===host||parsed.hostname.endsWith('.'+host)); } catch { return false; }
  }
  function publicURL(url) {const parsed=new URL(url);parsed.username='';parsed.password='';parsed.search='';parsed.hash='';return parsed.href.slice(0,2048);}
  class Coordinator {
    constructor(chrome, {setTimer = (fn,ms)=>setTimeout(fn,ms), clearTimer = timer=>clearTimeout(timer)} = {}) {
      this.chrome=chrome;this.clients=new Set();this.sources=new Map();
      this.pendingCaptures=new Map();this.setTimer=setTimer;this.clearTimer=clearTimer;
      chrome.runtime.onConnect.addListener(port=>this.connect(port));
      chrome.runtime.onMessage.addListener((message,sender,respond)=>{
        if(!['ROUNDTABLE_PAGE_READY','ROUNDTABLE_PAGE_SNAPSHOT'].includes(message?.type))return;
        this.receive(message,sender).then(respond,()=>respond({ok:false}));return true;
      });
      chrome.tabs.onActivated.addListener(info=>{void chrome.tabs.get(info.tabId).then(tab=>this.select(tab),()=>{});});
      chrome.tabs.onUpdated.addListener((_id,change,tab)=>{
        if(tab.active&&(change.url||change.status==='complete'))void this.select(tab);
        else if(tab.active&&change.status==='loading'&&allowed(tab.url)&&this.enabled(tab.windowId).length)this.beginPending(tab);
      });
      chrome.tabs.onRemoved.addListener(tabId=>{for(const [windowId,id]of this.sources)if(id===tabId){this.clearPending(windowId);this.sources.delete(windowId);this.notify(windowId,{type:'PAGE_UNAVAILABLE',reason:'資料のタブが閉じられました。'});}});
    }
    enabled(windowId) {return [...this.clients].filter(client=>client.enabled&&client.windowId===windowId);}
    post(client,message) {try{client.port.postMessage(message);}catch{this.clients.delete(client);}}
    notify(windowId,message) {for(const client of this.enabled(windowId))this.post(client,message);}
    connect(port) {
      if(port.name!=='ROUNDTABLE_PAGE_CONTEXT'||port.sender?.id!==this.chrome.runtime.id||port.sender?.url!==this.chrome.runtime.getURL('meeting.html?view=sidepanel'))return;
      const client={port,enabled:false,windowId:null};this.clients.add(client);
      port.onDisconnect.addListener(()=>{this.clients.delete(client);if(!this.enabled(client.windowId).length)this.suspend(client.windowId);});
      port.onMessage.addListener(message=>{void this.command(client,message).catch(()=>this.post(client,{type:'PAGE_UNAVAILABLE',reason:'ページの自動取得を開始できませんでした。'}));});
    }
    async command(client,message) {
      if(message?.type==='START'){
        if(!Number.isInteger(message.windowId))return;
        await this.chrome.windows.get(message.windowId);client.windowId=message.windowId;
        const pref=await this.chrome.storage.local.get('roundtableAutoPage');client.enabled=pref.roundtableAutoPage!==false;
      }else if(message?.type==='SET_ENABLED'&&Number.isInteger(client.windowId)&&typeof message.enabled==='boolean'){
        client.enabled=message.enabled;await this.chrome.storage.local.set({roundtableAutoPage:client.enabled});
      }else return;
      if(!this.clients.has(client))return;
      this.post(client,{type:'PAGE_PREF',enabled:client.enabled});
      if(client.enabled){const [tab]=await this.chrome.tabs.query({windowId:client.windowId,active:true});if(tab)await this.select(tab);}
      else{if(!this.enabled(client.windowId).length)this.suspend(client.windowId);this.post(client,{type:'PAGE_DISABLED'});}
    }
    clearPending(windowId) {
      const pending=this.pendingCaptures.get(windowId);
      if(pending)this.clearTimer(pending.timer);
      this.pendingCaptures.delete(windowId);
    }
    beginPending(tab) {
      const old=this.pendingCaptures.get(tab.windowId);
      if(old?.tabId!==tab.id||old?.url!==tab.url){
        this.clearPending(tab.windowId);
        const pending={tabId:tab.id,url:tab.url};
        pending.timer=this.setTimer(()=>{
          if(this.pendingCaptures.get(tab.windowId)!==pending)return;
          this.pendingCaptures.delete(tab.windowId);
          if(this.sources.get(tab.windowId)===tab.id)this.notify(tab.windowId,{type:'PAGE_UNAVAILABLE',reason:'ページ資料を取得できませんでした。資料なしで会議を続けられます。'});
        },15000);
        pending.timer?.unref?.();
        this.pendingCaptures.set(tab.windowId,pending);
      }
      this.notify(tab.windowId,{type:'PAGE_PENDING'});
    }
    suspend(windowId) {
      this.clearPending(windowId);
      const id=this.sources.get(windowId);this.sources.delete(windowId);
      if(Number.isInteger(id))void this.chrome.tabs.sendMessage(id,{type:'ROUNDTABLE_PAGE_STOP'}).catch(()=>{});
    }
    async select(tab) {
      if(!this.enabled(tab.windowId).length)return;
      // Keep the previous browsing page as reference when an AI tab is foregrounded.
      if(tab.url&&AI_HOSTS.some(host=>{try{const h=new URL(tab.url).hostname;return h===host||h.endsWith('.'+host);}catch{return false;}}))return;
      if(!allowed(tab.url)){this.suspend(tab.windowId);this.notify(tab.windowId,{type:'PAGE_UNAVAILABLE',reason:'このページは自動取得の対象外です。'});return;}
      const previous=this.sources.get(tab.windowId);
      if(previous!==tab.id)this.suspend(tab.windowId);
      this.sources.set(tab.windowId,tab.id);this.beginPending(tab);
      try {
        let ready;
        try{ready=await this.chrome.tabs.sendMessage(tab.id,{type:'ROUNDTABLE_PAGE_START'});}catch{}
        if(!ready?.ok){await this.chrome.scripting.executeScript({target:{tabId:tab.id},files:['content-page.js']});await this.chrome.tabs.sendMessage(tab.id,{type:'ROUNDTABLE_PAGE_START'});}
      }catch{if(this.sources.get(tab.windowId)===tab.id){this.clearPending(tab.windowId);this.notify(tab.windowId,{type:'PAGE_UNAVAILABLE',reason:'このページの本文を取得できません。サイトアクセス権限を確認してください。'});}}
    }
    async receive(message,sender) {
      if(sender.id!==this.chrome.runtime.id||sender.frameId!==0||!sender.tab||!allowed(sender.url))return {ok:false};
      const tab=await this.chrome.tabs.get(sender.tab.id);
      if(!allowed(tab.url)||!this.enabled(tab.windowId).length)return {ok:true,enabled:false};
      // During SPA navigation, accept a stale sender URL only when its origin matches the current tab.
      if(new URL(sender.url).origin!==new URL(tab.url).origin)return {ok:false};
      if(message.type==='ROUNDTABLE_PAGE_READY'){
        if(!tab.active&&this.sources.get(tab.windowId)!==tab.id)return {ok:true,enabled:false};
        if(this.sources.get(tab.windowId)!==tab.id)this.suspend(tab.windowId);this.sources.set(tab.windowId,tab.id);this.beginPending(tab);return {ok:true,enabled:true};
      }
      if(this.sources.get(tab.windowId)!==tab.id||message.navigationUrl!==tab.url)return {ok:false};
      if(typeof message.visit!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(message.visit)||typeof message.text!=='string'||message.text.length>8000||typeof message.title!=='string'||message.title.length>240)return {ok:false};
      if(!message.text.trim()){this.clearPending(tab.windowId);this.notify(tab.windowId,{type:'PAGE_UNAVAILABLE',reason:'このページには取得できる本文がありません。'});return {ok:true};}
      const documentId=sender.documentId||message.documentId;if(typeof documentId!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(documentId))return {ok:false};
      this.clearPending(tab.windowId);
      this.notify(tab.windowId,{type:'PAGE_MATERIAL',material:{id:`${tab.id}:${documentId}:${message.visit}`,url:publicURL(tab.url),title:message.title,text:message.text,truncated:!!message.truncated,capturedAt:Date.now()}});
      return {ok:true};
    }
  }
  const api={Coordinator,allowed,publicURL};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RoundtablePages=api;
})(globalThis);
