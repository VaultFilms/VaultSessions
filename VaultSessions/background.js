"use strict";
importScripts('page-context.js');
importScripts('image-utils.js');
importScripts('meeting-state.js');
const meetingSessions = new RoundtableSession.Store(chrome.storage.session);
const LOCALHOST_URL='http://127.0.0.1:8766/meeting.html';
let WEB_URL = null, filePageReady=false;
const isMeetingURL=url=>url===WEB_URL||url===LOCALHOST_URL;
const filePageStore=chrome.storage.local||chrome.storage.session;
const filePageLoaded=filePageStore.get('roundtableFilePage').then(data=>{WEB_URL=data.roundtableFilePage||null;filePageReady=true;});
const localMeetingSender=sender=>sender.id===chrome.runtime.id&&sender.frameId===0&&Number.isInteger(sender.tab?.id)&&/^file:\/\/\/.*\/meeting\.html$/.test(sender.url||'');
const webSender = sender => sender.id === chrome.runtime.id && isMeetingURL(sender.url) && sender.frameId === 0 && Number.isInteger(sender.tab?.id);

if (chrome.runtime.onConnect) new RoundtablePages.Coordinator(chrome);

const VERSION = '0.13.1';
const BRIDGE_VERSION = '0.5.1';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const PROVIDERS = {
  chatgpt: { foreground: true, bridgeVersion: '0.8.6', name: 'ChatGPT', pattern: 'https://chatgpt.com/*', prefix: 'ROUNDTABLE_CHATGPT' },
  gemini: { foreground: true, bridgeVersion: '0.8.3', name: 'Gemini', pattern: 'https://gemini.google.com/*', prefix: 'ROUNDTABLE_GEMINI' },
  claude: { foreground: true, bridgeVersion: '0.9.6', name: 'Claude', pattern: 'https://claude.ai/*', prefix: 'ROUNDTABLE_CLAUDE' }
};
const cleanURL = url => url?.split(/[?#]/)[0];
const sending = new Set();
let currentView = null;
async function applyViewMode(mode){
  const next=mode||'sidepanel';
  if(currentView===next)return;
  currentView=next;
  // Disable only this extension entry; leave other extensions and their sidebars untouched.
  await chrome.sidePanel?.setOptions?.({path:'meeting.html?view=sidepanel',enabled:false});
}
const viewModeReady=meetingSessions.run(data=>data.mode||'sidepanel',false).then(applyViewMode).catch(()=>{currentView='sidepanel';});
let parkingSidebar=null;
function activateSidebar(){
  if(parkingSidebar)return parkingSidebar;
  parkingSidebar=(async()=>{
    const tabs=(await chrome.tabs.query({url:['file:///*','http://127.0.0.1/*']})).filter(tab=>isMeetingURL(tab.url));
    let snapshot;
    for(const tab of tabs){
      try{const result=await chrome.tabs.sendMessage(tab.id,{type:'ROUNDTABLE_WEB_PARK'});if(result?.active&&result.snapshot)snapshot=result.snapshot;}catch{}
    }
    await meetingSessions.sidebarOpened(snapshot);
    await applyViewMode('sidepanel');
    // Navigate only meeting pages to the new-tab page; leave official AI tabs and other sidebars untouched.
    await Promise.all(tabs.map(tab=>chrome.tabs.update(tab.id,{url:'chrome://newtab/'}).catch(()=>{})));
  })().finally(()=>{parkingSidebar=null;});
  return parkingSidebar;
}
chrome.sidePanel?.onOpened?.addListener(info=>{if(info.path?.split('?')[0]==='meeting.html')return activateSidebar().catch(()=>{});});
// Prepare tab-specific panels without opening them or enabling a window-wide panel.
const sidebarTabs = new Set();
const preparedSidebarTabs = new Set();
function prepareTabSidebar(tabId){
  if(!Number.isInteger(tabId))return Promise.resolve();
  return chrome.sidePanel.setOptions({tabId,path:'meeting.html?view=sidepanel',enabled:true})
    .then(()=>preparedSidebarTabs.add(tabId));
}
async function prepareSidebarTabs(){
  for(const tab of await chrome.tabs.query({}))await prepareTabSidebar(tab.id).catch(()=>{});
}
chrome.runtime.onInstalled?.addListener(()=>void prepareSidebarTabs());
chrome.runtime.onStartup?.addListener(()=>void prepareSidebarTabs());
chrome.tabs.onCreated?.addListener(tab=>void prepareTabSidebar(tab.id).catch(()=>{}));
chrome.tabs.onUpdated?.addListener((tabId)=>{if(!preparedSidebarTabs.has(tabId))void prepareTabSidebar(tabId).catch(()=>{});});
function openTabSidebar(tabId){
  if(!Number.isInteger(tabId))throw Error('サイドバーを開くタブが見つかりません。');
  // Preserve the user gesture on cold starts: issue configuration first, without awaiting before open.
  if(!preparedSidebarTabs.has(tabId))void prepareTabSidebar(tabId).catch(()=>{});
  const opening=chrome.sidePanel.open({tabId});
  return Promise.resolve(opening).then(async()=>{
    sidebarTabs.add(tabId);
    const saved=(await chrome.storage.session.get('roundtableSidebarTabs')).roundtableSidebarTabs||[];
    await chrome.storage.session.set({roundtableSidebarTabs:[...new Set([...saved,tabId])]});
  });
}
async function closeOwnSidebar(){
  if(!chrome.sidePanel?.close)return;
  const saved=(await chrome.storage.session.get('roundtableSidebarTabs')).roundtableSidebarTabs||[];
  for(const tabId of new Set([...saved,...sidebarTabs])){
    try{await chrome.sidePanel.close({tabId});}catch{}
  }
}
async function focusWebMeeting(sourceTabId){
  if(Number.isInteger(sourceTabId)){
    // Reuse the tab instead of closing it, so Back can return to the original site.
    await chrome.tabs.get(sourceTabId);
    await chrome.tabs.update(sourceTabId,{url:WEB_URL,active:true});
    return;
  }
  const tabs=(await chrome.tabs.query({url:['file:///*','http://127.0.0.1/*']})).filter(tab=>isMeetingURL(tab.url));
  if(tabs.length){await chrome.tabs.update(tabs[0].id,{active:true});if(Number.isInteger(tabs[0].windowId))await chrome.windows.update(tabs[0].windowId,{focused:true});}
  else await chrome.tabs.create({url:WEB_URL});
}
function openMeetingFromAction(tab){
  if(chrome.sidePanel?.open&&Number.isInteger(tab?.id))return openTabSidebar(tab.id).catch(error=>console.error('VaultSessions sidebar:',error));
  return chrome.tabs.create({url:chrome.runtime.getURL('meeting.html')});
}
// Open on the same user-gesture stack, without waiting for viewModeReady even on the first click.
chrome.action.onClicked.addListener(openMeetingFromAction);

async function discoverProviders() {
  return Promise.all(Object.entries(PROVIDERS).map(async ([provider, config]) => {
    const tabs=(await chrome.tabs.query({url:config.pattern})).filter(tab=>tab.url?.startsWith(config.pattern.replace('*','')));
    const candidates=tabs.map(tab=>({tabId:tab.id,url:cleanURL(tab.url),title:tab.title||config.name,windowId:tab.windowId}));
    if(!tabs.length)return {provider,state:'absent',candidates};
    if(!await chrome.permissions.contains({origins:[config.pattern]}))return {provider,state:'error',code:'SITE_ACCESS',error:config.name+'へのアクセス許可が必要です。',candidates};
    if(tabs.length>1)return {provider,state:'choose',candidates};
    const tab=tabs[0];
    if(tab.status==='loading'||tab.discarded)return {provider,state:'waiting',candidates};
    let hello;try{hello=await chrome.tabs.sendMessage(tab.id,{type:config.prefix+'_HELLO'},{frameId:0});}catch{}
    if(!hello||hello.version!==config.bridgeVersion)return {provider,state:'waiting',targetTabId:tab.id,error:config.name+'の公式タブを再読み込みしてください。',candidates};
    if(!hello.ready||hello.busy)return {provider,state:'waiting',candidates};
    return {provider,state:'ready',tabId:tab.id,url:hello.url||cleanURL(tab.url),candidates};
  }));
}

async function deliver(provider, tabId, message) {
  try {
    const result = await chrome.tabs.sendMessage(tabId, message, { frameId: 0 });
    return result || { ok: false, error: `${provider.name}から結果を取得できませんでした。` };
  } catch {
    throw new Error(`${provider.name}との通信が切れました。送信済みの可能性もあります。公式タブで確認してください。更新後は公式タブと会議ページの再読み込みが必要です。`);
  }
}
async function locate(provider, message, reload = false) {
  const bridgeVersion = provider.bridgeVersion || BRIDGE_VERSION;
  if (!await chrome.permissions.contains({ origins: [provider.pattern] })) {
    const error = new Error(`${provider.name}公式サイトへのアクセスが許可されていません。下の許可ボタンで、このサイトへのアクセスを許可してください。`);
    error.code = 'SITE_ACCESS';
    throw error;
  }
  // Validate returned hosts in addition to applying the Chrome URL filter.
  const tabs = (await chrome.tabs.query({ url: provider.pattern })).filter(tab => tab.url?.startsWith(provider.pattern.replace('*', '')));
  if (!tabs.length) throw new Error(`${provider.name}のタブを開き、ログインしてください。`);
  const chosenId = message.tabId ?? message.selectedTabId;
  if (chosenId != null && !Number.isInteger(chosenId)) throw new Error('接続先タブの指定が不正です。');
  if (chosenId == null && tabs.length > 1) {
    const error = new Error(`${provider.name}のタブを${tabs.length}個検出しました。下の一覧から接続先を選んでください。`);
    if (message.type === 'ROUNDTABLE_CONNECT') {
      error.code = 'CHOOSE_TAB';
      error.candidates = tabs.map(tab => ({ tabId: tab.id, title: tab.title || provider.name, url: cleanURL(tab.url), windowId: tab.windowId, active: !!tab.active }));
      throw error;
    }
    throw new Error(`誤送信を防ぐため、${provider.name}のタブを1つだけにしてください。`);
  }
  const tab = chosenId == null ? tabs[0] : tabs.find(tab => tab.id === chosenId);
  if (!tab) throw new Error(`${provider.name}の接続先タブが見つかりません。選び直してください。`);
  if (message.tabId != null && (tab.id !== message.tabId || cleanURL(tab.url) !== message.conversationUrl)) {
    throw new Error(`${provider.name}のタブまたは会話が切り替わっています。元の会話へ戻してください。別の会話で始める場合は退席してから招待し直してください。`);
  }
  if (reload) {
    // Reload only the tab selected by the recovery action; do not send any message.
    await chrome.tabs.reload(tab.id);
    const until = Date.now() + 20000;
    while (Date.now() < until) {
      await pause(300);
      let current;
      try { current = await chrome.tabs.get(tab.id); } catch { break; }
      if (!current.url?.startsWith(provider.pattern.replace('*', ''))) break;
      if (current.status === 'loading') continue;
      try {
        const ready = await chrome.tabs.sendMessage(tab.id, { type: `${provider.prefix}_HELLO` }, { frameId: 0 });
        if (ready?.version === bridgeVersion && ready.ready !== false) return { tab: current, hello: ready };
      } catch { /* Wait for page and content-script initialization. */ }
    }
  } else if (tab.discarded || tab.status === 'loading') {
    throw new Error(`${provider.name}のタブを開き、読み込み完了後に実行してください。`);
  }
  let hello;
  try { hello = await chrome.tabs.sendMessage(tab.id, { type: `${provider.prefix}_HELLO` }, { frameId: 0 }); }
  catch { /* Offer recovery for the selected tab even when it does not respond. */ }
  if (reload && hello?.version === bridgeVersion && hello.ready === false) {
    throw new Error(`${provider.name}の連携スクリプトは動作していますが、入力欄が見つかりません。公式タブでログインと通常のチャット画面を確認してください。`);
  }
  if (hello?.version !== bridgeVersion) {
    const error = new Error(`${provider.name}の連携スクリプトが未更新、または応答していません（応答版: ${hello?.version || '応答なし'} / 必要版: ${bridgeVersion} / タブ: ${tab.id}）。下のボタンで、このタブを直接再読み込みして接続をやり直せます。文章はまだ送信していません。`);
    error.code = 'BRIDGE_UNAVAILABLE'; error.targetTabId = tab.id; error.targetURL = cleanURL(tab.url);
    throw error;
  }
  return { tab, hello };
}

async function inputGuard(tabId, requestId, lock) {
  const result = await chrome.tabs.sendMessage(tabId, { type: 'ROUNDTABLE_INPUT_GUARD', requestId, lock }, { frameId: 0 });
  if (lock && (!result?.guarded || result.version !== '0.7.4')) throw new Error('誤入力防止スクリプトが未更新です。拡張本体と3社の公式タブを再読み込みしてください。文章はまだ送信していません。');
}
async function releaseInput(tabId, requestId) {
  try { await inputGuard(tabId, requestId, false); } catch { /* Closed tabs need no recovery */ }
}
async function activateProvider(tab) {
  await chrome.tabs.update(tab.id, { active: true });
  if (Number.isInteger(tab.windowId)) await chrome.windows.update(tab.windowId, { focused: true });
}
async function returnToMeeting(provider, sourceTabId, meetingTabId) {
  if (!Number.isInteger(meetingTabId)) return;
  try {
    const source = await chrome.tabs.get(sourceTabId);
    const meeting = await chrome.tabs.get(meetingTabId);
    if (!source.active || !source.url?.startsWith(provider.pattern.replace('*', ''))) return;
    if (!isMeetingURL(meeting.url) && cleanURL(meeting.url) !== chrome.runtime.getURL('meeting.html')) return;
    // Do not steal focus if the user has moved to another tab or window.
    if (Number.isInteger(source.windowId) && !(await chrome.windows.get(source.windowId)).focused) return;
    await chrome.tabs.update(meetingTabId, { active: true });
    if (Number.isInteger(meeting.windowId)) await chrome.windows.update(meeting.windowId, { focused: true });
  } catch { /* Do not discard a response if its tab has closed. */ }
}

function savedRoleURL(providerId, url) {
  const path = new URL(url).pathname;
  return providerId === 'chatgpt' ? /^\/c\/(?!local-chatgpt(?::|%3a))[^/]+\/?$/i.test(path)
    : providerId === 'gemini' ? /^\/app\/[^/]+\/?$/.test(path) : /^\/chat\/[^/]+\/?$/.test(path);
}
let roleWrites = Promise.resolve();
function roleState(providerId, provider, message, verifiedRecovery = false) {
  const operation = roleWrites.then(async () => {
    if ((!['begin', 'complete', 'failed', 'reset'].includes(message.operation) && !(verifiedRecovery && message.operation === 'adopt'))
      || !Number.isInteger(message.tabId) || typeof message.conversationUrl !== 'string'
      || !message.conversationUrl.startsWith(provider.pattern.replace('*', ''))) throw new Error('Role状態の指定が不正です。');
    const tab = await chrome.tabs.get(message.tabId);
    if (!tab.url?.startsWith(provider.pattern.replace('*', ''))) throw new Error('Roleの対象タブが見つかりません。');
    const data = (await chrome.storage.session.get('roundtableRoles')).roundtableRoles || { ready: {}, pending: {} };
    const tabKey = `${providerId}:${message.tabId}`;
    const urlKey = `${providerId}:${cleanURL(message.conversationUrl)}`;
    if (message.operation === 'adopt') {
      if (cleanURL(tab.url) !== message.conversationUrl || !savedRoleURL(providerId, message.conversationUrl)) throw new Error('Role復旧時の会話が一致しません。');
      data.ready[urlKey] = providerId === 'claude' ? 1 : 2;
      delete data.pending[tabKey];
    } else if (message.operation === 'reset') {
      // Explicit recovery: retain completed role records.
      delete data.pending[tabKey];
    } else if (message.operation === 'begin') {
      if (cleanURL(tab.url) !== message.conversationUrl) throw new Error('Role設定前に会話が切り替わりました。招待し直してください。');
      if (data.ready[urlKey] === message.revision) return { ok: true, state: 'ready' };
      if (data.pending[tabKey]) throw Object.assign(new Error('Roleの送信が未完了、または結果が不明です。公式タブを確認し、カードのRole再設定を押してください。自動再送はしません。'), { code: 'ROLE_UNCERTAIN' });
      // Also prevent different meeting pages from sending to the same conversation concurrently.
      if (Object.values(data.pending).some(record => record.provider === providerId && record.url === message.conversationUrl)) throw new Error('同じ会話のRoleを別の会議ページで設定中です。完了を待ってください。');
      if (typeof message.requestId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(message.requestId) || ![1, 2].includes(message.revision)) throw new Error('Role送信IDが不正です。');
      data.pending[tabKey] = { provider: providerId, requestId: message.requestId, url: message.conversationUrl, revision: message.revision, state: 'pending' };
    } else {
      const pending = data.pending[tabKey];
      if (!pending || pending.requestId !== message.requestId) throw new Error('Roleの処理IDが一致しません。');
      if (message.operation === 'failed') pending.state = 'failed';
      else {
        if (typeof message.finalUrl !== 'string' || !message.finalUrl.startsWith(provider.pattern.replace('*', ''))
          || cleanURL(tab.url) !== message.finalUrl) throw new Error('Role完了時の会話が一致しません。');
        if (!savedRoleURL(providerId, message.finalUrl)) throw new Error('Role送信後の正式な会話URLを確認できませんでした。公式タブを確認してください。');
        data.ready[`${providerId}:${message.finalUrl}`] = pending.revision;
        delete data.pending[tabKey];
      }
    }
    await chrome.storage.session.set({ roundtableRoles: data });
    return { ok: true, state: message.operation === 'begin' ? 'claimed' : ['complete', 'adopt'].includes(message.operation) ? 'ready' : message.operation };
  });
  roleWrites = operation.catch(() => {});
  return operation;
}

function handleMeetingMessage(message, sender, respond) {
  if(!filePageReady){filePageLoaded.then(()=>handleMeetingMessage(message,sender,respond),error=>respond({ok:false,error:error.message}));return true;}
  if(message?.type==='ROUNDTABLE_REGISTER_FILE'&&localMeetingSender(sender)){
    filePageStore.set({roundtableFilePage:sender.url}).then(()=>{WEB_URL=sender.url;respond({ok:true});},error=>respond({ok:false,error:error.message}));return true;
  }
  if(message?.type==='ROUNDTABLE_FILE_INFO'&&localMeetingSender(sender)){respond({ok:true,registered:sender.url===WEB_URL});return;}

  if (!webSender(sender) && (sender.id !== chrome.runtime.id || ![
    chrome.runtime.getURL('meeting.html'),
    chrome.runtime.getURL('meeting.html?view=sidepanel')
  ].includes(sender.url))) return;
  if(message?.type==='ROUNDTABLE_LOG_FONT'){
    const key='vaultsessionsLogFontStep';
    if(message.operation==='save'){
      if(!Number.isInteger(message.step)||message.step < -2||message.step > 6){respond({ok:false,error:'Invalid log font size.'});return;}
      chrome.storage.local.set({[key]:message.step}).then(()=>respond({ok:true,step:message.step}),error=>respond({ok:false,error:error.message}));
    }else chrome.storage.local.get(key).then(data=>respond({ok:true,step:Number.isInteger(data[key])?Math.max(-2,Math.min(6,data[key])):0}),error=>respond({ok:false,error:error.message}));
    return true;
  }
  if(message?.type==='ROUNDTABLE_CHECK_LOCALHOST'){
    fetch(LOCALHOST_URL,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(4000)})
      .then(async response=>{if(!response.ok||!(await response.text()).includes('name="roundtable-ui" content="unified"'))throw Error('invalid');respond({ok:true,url:LOCALHOST_URL});})
      .catch(()=>respond({ok:false,code:'LOCALHOST_NOT_READY',error:'Localhost meeting is not ready.'}));return true;
  }
  if(message?.type==='ROUNDTABLE_OPEN_SIDEBAR'&&webSender(sender)){
    // The content script forwards a real click and scopes the panel to that tab.
    let opening;
    try{opening=openTabSidebar(sender.tab.id);}
    catch(error){respond({ok:false,error:error.message});return;}
    Promise.resolve(opening).then(()=>activateSidebar()).then(()=>respond({ok:true}),error=>respond({ok:false,error:'サイドバーを開けませんでした: '+error.message}));
    return true;
  }
  if(message?.type==='ROUNDTABLE_WEB_TAB'&&webSender(sender)){respond({id:sender.tab.id,windowId:sender.tab.windowId});return;}
  if(message?.type==='ROUNDTABLE_SESSION'){
    const prepare=message.operation==='load'&&message.acquire&&sender.url===chrome.runtime.getURL('meeting.html?view=sidepanel')?activateSidebar():Promise.resolve();
    prepare.then(()=>meetingSessions.handle({...message,view:webSender(sender)?'web':'sidepanel'})).then(async result=>{await applyViewMode(result.mode||currentView||'sidepanel');respond(result);},error=>respond({ok:false,error:error.message,code:error.code})).catch(error=>respond({ok:false,error:error.message}));return true;
  }
  if(message?.type==='ROUNDTABLE_SWITCH'){
    if(!['web','sidepanel'].includes(message.view)){respond({ok:false,error:'表示先が不正です。'});return;}
    const ready = message.view==='web' ? Promise.resolve().then(async()=>{if(!WEB_URL)throw Error('まず本体フォルダのmeeting.htmlをChromeで開き、会議ページとして登録してください。');if(WEB_URL.startsWith('file:')&&!await chrome.extension.isAllowedFileSchemeAccess())throw Error('拡張の詳細で「ファイルのURLへのアクセスを許可する」を有効にしてください。');}) : Promise.resolve();
    ready.then(()=>meetingSessions.handle({...message,operation:'handoff'})).then(async()=>{
      if(message.view==='web'){await applyViewMode('web');await closeOwnSidebar();await focusWebMeeting(message.sourceTabId);respond({ok:true,opened:true});}
      else {
        await applyViewMode('sidepanel');
        let opened=false;
        try{await openTabSidebar(sender.tab?.id);opened=true;}catch{}
        if(opened)await activateSidebar();
        chrome.runtime.sendMessage?.({type:'ROUNDTABLE_VIEW_RESUME',view:'sidepanel'})?.catch(()=>{});
        respond({ok:true,opened});
      }
    }).catch(error=>respond({ok:false,error:error.message}));return true;
  }
  if (message?.type === 'ROUNDTABLE_HELLO') { respond({ ok: true, version: VERSION }); return; }
  if(message?.type==='ROUNDTABLE_DISCOVER'){discoverProviders().then(providers=>respond({ok:true,providers}),error=>respond({ok:false,error:error.message}));return true;}
  if (!['ROUNDTABLE_CONNECT', 'ROUNDTABLE_RELOAD_CONNECT', 'ROUNDTABLE_SEND', 'ROUNDTABLE_STATUS', 'ROUNDTABLE_ROLE_STATE', 'ROUNDTABLE_RECOVER_ROLE'].includes(message?.type)) return;
  (async () => {
    const providerId = message.provider;
    const provider = Object.hasOwn(PROVIDERS, providerId) && PROVIDERS[providerId];
    if (!provider) throw new Error('送信先のAIが不明です。');
    if (['ROUNDTABLE_CONNECT','ROUNDTABLE_RELOAD_CONNECT','ROUNDTABLE_SEND','ROUNDTABLE_ROLE_STATE','ROUNDTABLE_RECOVER_ROLE'].includes(message.type)) await meetingSessions.verify(message.clientId);
    if (message.type === 'ROUNDTABLE_ROLE_STATE') return roleState(providerId, provider, message);
    if (message.type === 'ROUNDTABLE_RECOVER_ROLE') {
      if (typeof message.text !== 'string' || !message.text.startsWith('You are participating in a group discussion\n') || message.text.length > 20000) throw new Error('Role復旧の指定が不正です。');
      const { tab } = await locate(provider, message);
      const result = await deliver(provider, tab.id, { type: `${provider.prefix}_RECOVER_ROLE`, text: message.text });
      if (!result.ok) return result;
      if (result.recovered) await roleState(providerId, provider, { operation: 'adopt', tabId: tab.id, conversationUrl: result.url }, true);
      return { ok: true, recovered: result.recovered === true };
    }
    if (['ROUNDTABLE_CONNECT', 'ROUNDTABLE_RELOAD_CONNECT'].includes(message.type)) {
      if (message.type === 'ROUNDTABLE_RELOAD_CONNECT' && !Number.isInteger(message.selectedTabId)) throw new Error('再読み込みするタブを指定してください。');
      const { tab, hello } = await locate(provider, message, message.type === 'ROUNDTABLE_RELOAD_CONNECT');
      if (hello.ready === false) throw new Error(`${provider.name}の入力欄が見つかりません。ログインと通常のチャット画面を確認してください。`);
      return { ok: true, provider: providerId, tabId: tab.id, url: hello.url || cleanURL(tab.url) };
    }
    if (typeof message.requestId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(message.requestId)) throw new Error('送信IDが不正です。会議ページを再読み込みしてください。');
    if (message.type === 'ROUNDTABLE_STATUS') {
      if (!Number.isInteger(message.tabId)) throw new Error('送信先タブが不明です。');
      let result;
      try { result = await deliver(provider, message.tabId, { type: `${provider.prefix}_STATUS`, requestId: message.requestId }); }
      catch (error) { await releaseInput(message.tabId, message.requestId); throw error; }
      if (provider.foreground && (!result.ok || ['complete', 'error'].includes(result.phase))) {
        await returnToMeeting(provider, message.tabId, message.returnTabId);
        await releaseInput(message.tabId, message.requestId);
      }
      return result;
    }
    if (!Number.isInteger(message.tabId) || typeof message.conversationUrl !== 'string') throw new Error(`${provider.name}は未参加です。先に招待してください。`);
    if (sending.has(providerId)) throw new Error('送信処理中です。完了を待ってください。');
    if (typeof message.text !== 'string' || !message.text.trim()) throw new Error('文章を入力してください。');
    if (message.text.length > 20000) throw new Error('文章は20,000文字以内で入力してください。');
    const images = RoundtableImages.validate(message.images);
    if (message.silent && images.length) throw new Error('Role指示には画像を添付できません。');
    const deliveryText = message.text + RoundtableImages.referencePrompt(images, message.requestId);
    if (deliveryText.length > 20000) throw new Error('画像番号の指示を含めると文字数上限を超えます。発言を短くしてください。');
    sending.add(providerId);
    try {
      const { tab } = await locate(provider, message);
      if (provider.foreground) await inputGuard(tab.id, message.requestId, true);
      let result;
      try {
        if (provider.foreground) await activateProvider(tab);
        result = await deliver(provider, tab.id, { type: `${provider.prefix}_SEND`, text: deliveryText, images, requestId: message.requestId, silent: message.silent === true, ...(provider.foreground ? { foreground: true } : {}) });
      } catch (error) {
        if (provider.foreground) { await returnToMeeting(provider, tab.id, message.returnTabId); await releaseInput(tab.id, message.requestId); }
        throw error;
      }
      if (provider.foreground && !result.ok) { await returnToMeeting(provider, tab.id, message.returnTabId); await releaseInput(tab.id, message.requestId); }
      return { ...result, provider: providerId, tabId: tab.id };
    } finally { sending.delete(providerId); }
  })().then(respond, error => respond({ ok: false, error: error.message, ...(error.code ? { code: error.code, candidates: error.candidates, targetTabId: error.targetTabId, targetURL: error.targetURL } : {}) }));
  return true;
}
chrome.runtime.onMessage.addListener(handleMeetingMessage);

const notifyWebMeeting = async()=>{
  const tabs=await chrome.tabs.query({url:['file:///*','http://127.0.0.1/*']});
  await Promise.all(tabs.filter(tab=>isMeetingURL(tab.url)).map(tab=>chrome.tabs.sendMessage(tab.id,{type:'ROUNDTABLE_WEB_CHANGED'}).catch(()=>{})));
};
chrome.tabs.onUpdated?.addListener((_id,change,tab)=>{if((change.url||change.status)&&Object.values(PROVIDERS).some(p=>tab.url?.startsWith(p.pattern.replace('*',''))))void notifyWebMeeting();});
chrome.tabs.onCreated?.addListener(tab=>{if(Object.values(PROVIDERS).some(p=>tab.url?.startsWith(p.pattern.replace('*',''))))void notifyWebMeeting();});
chrome.tabs.onRemoved?.addListener(()=>void notifyWebMeeting());
