"use strict";

const uiText = text => globalThis.VaultI18n ? VaultI18n.message(text) : text;
const VERSION = '0.1.0';
// Accept compatible service workers after UI-only updates.
const COMPATIBLE_BACKEND_VERSIONS = new Set(['0.1.0']);
const meetingClientId = crypto.randomUUID();
let meetingActive = true;
let summaryBusy = false;
let viewSwitching = false;
let meetingRestoring = !!globalThis.chrome?.runtime?.id;
const isSidePanel = new URLSearchParams(location.search).get('view') === 'sidepanel';
document.body.classList.toggle('side-panel', isSidePanel);
const providers = {
  chatgpt: { name: 'ChatGPT', origin: 'https://chatgpt.com/*', foreground: true },
  gemini: { name: 'Gemini', origin: 'https://gemini.google.com/*', foreground: true },
  claude: { name: 'Claude', origin: 'https://claude.ai/*', foreground: true }
};
const form = document.querySelector('#meeting-form');
const input = document.querySelector('#message');
const button = document.querySelector('#send');
const imageInput = document.querySelector('#meeting-image');
const imagePreview = document.querySelector('#image-preview');
const imageRemove = document.querySelector('#remove-image');
let selectedImages = [], imageLoading = false, imageSelection = 0;
function renderImages() {
  const items = document.querySelector('#image-items'); items.replaceChildren();
  selectedImages.forEach((image, index) => {
    const row = document.createElement('div'); row.className = 'image-item';
    const preview = document.createElement('img'); preview.src = image.dataUrl; preview.alt = VaultI18n.t('notice_046', {0:index + 1,1:image.name});
    const name = document.createElement('span'); name.textContent = `${index + 1}. ${image.name}`;
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = VaultI18n.t('message_001');
    remove.setAttribute('aria-label', VaultI18n.t('message_002', {0:image.name}));
    remove.addEventListener('click', () => {
      if ((controller.running || summaryBusy) || isConnecting() || imageLoading) return;
      selectedImages.splice(index, 1); imageInput.value = ''; renderImages(); syncControls();
    });
    row.append(preview, name, remove); items.append(row);
  });
  imagePreview.hidden = selectedImages.length === 0;
}
function clearImage() {
  imageSelection++; selectedImages = []; imageLoading = false; imageInput.value = '';
  document.querySelector('#image-composer').open = false;
  renderImages();
}

const status = document.querySelector('#status');
const activity = document.querySelector('#activity');
const log = document.querySelector('#meeting-log');
const empty = document.querySelector('#empty-log');
const connection = document.querySelector('#connection');
const reloadExtension = document.querySelector('#reload-extension');
const participants = document.querySelector('#participants');
const targets = {};
let imageJobs = null;
const providerAvailable = id => !!targets[id] && !imageJobs?.isBusy(id);
const cards = {};
const connecting = new Set();
let automaticInvitations = null;
const pendingDepartures = new Set();
const isConnecting = () => connecting.size > 0;
let composing = false;
let pageLoading = false;
const language = document.querySelector('#meeting-language');
const stopButton = document.querySelector('#stop-discussion');
const speaker = document.querySelector('#current-speaker');
const counters = document.querySelector('#discussion-counts');
const runRows = new Map();
const controller = new RoundtableDiscussion.DiscussionController({
  languageNames: globalThis.VaultI18n?.locales.map(item=>item.meetingLanguage),
  order: Object.keys(providers), names: Object.fromEntries(Object.entries(providers).map(([id, value]) => [id, value.name])),
  getManual: ({question,language:answerLanguage}) => VaultManual.prompt(question,answerLanguage,VaultManual.capture(document,{
    view:isSidePanel?'sidepanel':'fullscreen',uiLanguage:VaultI18n.locale,mode:document.querySelector('#meeting-mode').value,protocol:location.protocol,
    connections:Object.keys(providers).map(id=>({name:providers[id].name,connected:!!targets[id],available:!!targets[id]&&!imageJobs?.isBusy(id)}))
  },key=>VaultI18n.t(key))),
  getTarget: id => targets[id], isAvailable: id => !imageJobs?.isBusy(id), exchange,
  recoverRole: async (provider, text) => {
    const result = await request({ type: 'ROUNDTABLE_RECOVER_ROLE', provider, text, ...targets[provider] });
    return result.recovered === true;
  },
  roleState: (operation, provider, target, extra = {}) => request({ type: 'ROUNDTABLE_ROLE_STATE', operation, provider, ...target, ...extra }),
  onEvent: discussionEvent
});

function setStatus(state, text, { inLog = true } = {}) {
  text=uiText(text);
  status.removeAttribute('data-i18n');
  status.dataset.state = state;
  status.textContent = text;
  activity.dataset.state = state; activity.textContent = text;
  const record = runRows.get(controller.active?.id);
  // Show errors even for operations, such as view switching, that do not add log entries.
  status.hidden = state !== 'error' && (!!record || !inLog);
  if (record && inLog) showLogStatus(record, state, text);
  log.setAttribute('aria-busy', String(state === 'sending'));
}
function providerStatus(id, state, text) {
  cards[id].status.removeAttribute('data-i18n');
  cards[id].status.dataset.state = state;
  cards[id].status.textContent = uiText(text);
  cards[id].badge.textContent = state === 'sending' ? VaultI18n.t('message_003') : targets[id] ? VaultI18n.t('message_004') : VaultI18n.t('message_005');
  renderAutomaticCards();
}
function renderParticipants() {
  const ids = Object.keys(providers).filter(id => targets[id] && !connecting.has(id));
  const wasConnected = document.body.classList.contains('has-participants');
  document.body.classList.toggle('has-participants', ids.length > 0);
  if (!wasConnected && ids.length) {
    for (const card of Object.values(cards)) {
      card.element.classList.remove('is-expanded');
      card.element.querySelector('.provider-menu').setAttribute('aria-expanded', 'false');
    }
  }
  participants.textContent = ids.length ? VaultI18n.t('message_006', {0:ids.map(id => providers[id].name).join(' / ')}) : VaultI18n.t('message_007');
  connection.textContent = ids.map(id => `${providers[id].name}: ${targets[id].conversationUrl}`).join('\n');
  for (const id of Object.keys(providers)) {
    cards[id].invite.textContent = connecting.has(id) ? VaultI18n.t('message_008') : targets[id] ? VaultI18n.t('message_004') : VaultI18n.t('message_009', {0:providers[id].name});
    cards[id].leave.hidden = !targets[id] || connecting.has(id);
    cards[id].badge.textContent = imageJobs?.isBusy(id) ? VaultI18n.t('imageJobGenerating') : connecting.has(id) ? VaultI18n.t('message_003') : targets[id] ? VaultI18n.t('message_004') : VaultI18n.t('message_005');
  }
  syncControls();
}
function syncControls() {
  const running = (controller.running || summaryBusy) || !meetingActive || meetingRestoring;
  reloadExtension.disabled = isConnecting() || (controller.running || summaryBusy) || meetingRestoring;
  // Reference capture does not block sending; omit unavailable material from this turn.
  button.disabled = isConnecting() || running || imageLoading || !Object.keys(targets).some(providerAvailable);
  if (running && document.activeElement === input) input.blur();
  input.disabled = isConnecting() || running || !Object.keys(targets).some(providerAvailable);
  imageInput.disabled = isConnecting() || running || imageLoading;
  imageRemove.disabled = isConnecting() || running || imageLoading;
  for (const remove of imagePreview.querySelectorAll('button')) remove.disabled = isConnecting() || running || imageLoading;
  input.required = selectedImages.length === 0;
  stopButton.disabled = !controller.running;
  button.textContent = (controller.running || summaryBusy) ? VaultI18n.t('message_010') : !meetingActive ? VaultI18n.t('message_011') : VaultI18n.t('message_012');
  for (const [id, card] of Object.entries(cards)) {
    card.invite.disabled = connecting.has(id) || (controller.running || summaryBusy) || meetingRestoring || !!targets[id] || !!imageJobs?.isBusy(id);
    card.leave.disabled = connecting.has(id) || pendingDepartures.has(id);
    for (const control of [card.select, card.reload, card.allow, card.roleRetry]) control.disabled = connecting.has(id) || (controller.running || summaryBusy) || meetingRestoring;
  }
  renderAutomaticCards();
  document.querySelector('#switch-view').disabled = viewSwitching || (controller.running || summaryBusy) || isConnecting() || imageLoading || meetingRestoring;
}
// Image delivery can spend 60 seconds attaching files, plus editor/button/receipt waits.
// Keep the UI deadline beyond the bridge deadline; ordinary calls still fail promptly.
function requestTimeout(message) {
  if(['ROUNDTABLE_INSPECTOR_CONTEXT','ROUNDTABLE_INSPECTOR_SHARE'].includes(message.type))return 60000;
  return message.type === 'ROUNDTABLE_SEND' && message.images?.length ? 110000 : 30000;
}
async function request(message) {
  if (!globalThis.chrome?.runtime?.id) throw new Error(VaultI18n.t('message_013'));
  let timer;
  let result;
  try {
    result = await Promise.race([
      chrome.runtime.sendMessage({ ...message, clientId: meetingClientId }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(VaultI18n.t('message_014'))), requestTimeout(message));
      })
    ]);
  } finally { clearTimeout(timer); }
  if (message.type === 'ROUNDTABLE_HELLO' && !COMPATIBLE_BACKEND_VERSIONS.has(result?.version)) {
    throw new Error(VaultI18n.t('message_015', {0:VERSION,1:result?.version || VaultI18n.t('noResponse')}));
  }
  if (!result?.ok) {
    const error = new Error(result?.error || VaultI18n.t('message_016'));
    Object.assign(error, { code: result?.code, candidates: result?.candidates, targetTabId: result?.targetTabId });
    throw error;
  }
  return result;
}
async function finishInvitation(id, result) {
  const card = cards[id];
  targets[id] = { tabId: result.tabId, conversationUrl: result.url };
  providerStatus(id, 'sending', VaultI18n.t('message_017'));
  try { await controller.ensureRole(id, language.value); }
  catch (error) {
    card.roleTarget = { ...targets[id] }; card.roleRetry.hidden = false;
    delete targets[id]; renderConnection(); throw error;
  }
  card.autoIssue = false;
  card.roleRetry.hidden = true; card.roleTarget = null;
  card.picker.hidden = true;
  card.recovery.hidden = true;
  card.allow.hidden = true;
  card.pendingTabId = null;
  renderParticipants();
  providerStatus(id, 'success', VaultI18n.t('message_018', {0:targets[id].conversationUrl}));
  setStatus('success', VaultI18n.t('message_019', {0:providers[id].name}));
}
function invitationError(id, error) {
  const card = cards[id];
  if(automaticInvitations?.paused.has(id)){clearInvitationIssue(id);return;}
  card.autoIssue = true;
  if (error.code === 'CHOOSE_TAB' && Array.isArray(error.candidates)) {
    card.select.replaceChildren(new Option(VaultI18n.t('message_020'), ''));
    for (const tab of error.candidates) {
      card.select.append(new Option(VaultI18n.t('message_021', {0:tab.title,1:tab.url,2:tab.windowId ?? '?'}), String(tab.tabId)));
    }
    card.picker.hidden = false;
  }
  if (error.code === 'BRIDGE_UNAVAILABLE' && Number.isInteger(error.targetTabId)) {
    card.pendingTabId = error.targetTabId;
    card.recovery.hidden = false;
  }
  if (error.code === 'SITE_ACCESS') card.allow.hidden = false;
  const state=error.code==='CHOOSE_TAB'?'ready':'error';
  providerStatus(id, state, error.message);
  setStatus(state, `${providers[id].name}: ${error.message}`);
}
async function ensureMeetingAccess(){
  await request({type:'ROUNDTABLE_HELLO'});
  if(!meetingActive){
    const result=await request({type:'ROUNDTABLE_SESSION',operation:'load',acquire:true});
    if(result.active===false)throw Error(VaultI18n.t('message_022'));
    meetingActive=true;window.dispatchEvent(new Event('roundtable-resume'));syncControls();
  }
}
async function invite(id, reload = false, overrideTabId = null) {
  const card = cards[id];
  if (meetingRestoring || connecting.has(id) || (controller.running || summaryBusy) || targets[id] || imageJobs?.isBusy(id)) return;
  if (overrideTabId == null && !reload && !card.picker.hidden && !card.select.value) {
    providerStatus(id, 'error', VaultI18n.t('message_023'));
    return;
  }
  const selectedTabId = overrideTabId ?? (reload ? card.pendingTabId : card.picker.hidden ? null : Number(card.select.value));
  if (reload && !Number.isInteger(selectedTabId)) return;
  card.autoIssue = false;
  connecting.add(id); syncControls();
  card.recovery.hidden = true; card.allow.hidden = true;
  card.invite.textContent = VaultI18n.t('message_008');
  providerStatus(id, 'sending', reload ? VaultI18n.t('message_024') : VaultI18n.t('message_008'));
  setStatus('sending', VaultI18n.t('message_025', {0:providers[id].name}));
  try {
    await ensureMeetingAccess();
    const result = await request({ type: reload ? 'ROUNDTABLE_RELOAD_CONNECT' : 'ROUNDTABLE_CONNECT', provider: id,
      ...(selectedTabId == null ? {} : { selectedTabId }) });
    await finishInvitation(id, result);
  } catch (error) { invitationError(id, error); }
  finally {
    connecting.delete(id);
    renderParticipants();
  }
}
function createInvitationCard(id) {
  const name = providers[id].name;
  const element = document.createElement('article');
  element.className = 'provider-card'; element.id = `invite-card-${id}`;
  // IDs and names are code constants. Render external candidates and errors through textContent.
  element.innerHTML = `<header><strong>${name}</strong><span class="badge">Not connected</span><button class="provider-menu" type="button" aria-expanded="false" data-i18n-aria="menu">⌄</button></header>
    <div class="card-actions"><button id="invite-${id}" type="button">${VaultI18n.t('message_009', {0:name})}</button><button id="leave-${id}" type="button" hidden>${VaultI18n.t('message_092')}</button></div>
    <p class="provider-status" role="status" aria-live="polite" data-i18n="connectHint">Open an official AI tab, sign in, then connect.</p>
    <div id="${id}-tab-picker" hidden><label for="${id}-tab" data-i18n="selectTab">Select a connection tab</label><select id="${id}-tab"></select><p class="note" data-i18n="selectHint">Choose a tab to connect.</p></div>
    <div id="${id}-recovery" hidden><button id="reload-${id}" type="button" data-i18n="reloadConnect">Reload selected tab and connect</button><p class="note" data-i18n="draftHint">Save any unsent draft before reloading.</p></div>
    <button id="role-retry-${id}" type="button" hidden data-i18n="resetRole">Reset instructions and connect</button>
    <button id="allow-${id}" type="button" hidden>${VaultI18n.t('grantAccess',{name})}</button>`;
  document.querySelector('#invitations').append(element);
  const toggleCard=()=>{
    const card=cards[id];
    if(element.classList.contains('participant-collapsed')){
      element.classList.remove('participant-collapsed');
      element.classList.add('is-expanded');
      element.querySelector('.provider-menu').setAttribute('aria-expanded','true');
      return;
    }
    if(!targets[id]&&(card.autoIssue||card.status.dataset.state==='error')){
      automaticInvitations?.pause(id);clearInvitationIssue(id);
      element.classList.remove('is-expanded');
      element.querySelector('.provider-menu').setAttribute('aria-expanded','false');
      return;
    }
    const expanded=element.classList.toggle('is-expanded');
    element.querySelector('.provider-menu').setAttribute('aria-expanded',String(expanded));
  };
  element.querySelector('.provider-menu').addEventListener('click',toggleCard);
  const badge=element.querySelector('.badge');
  badge.setAttribute('role','button');badge.tabIndex=0;
  badge.addEventListener('click',toggleCard);
  badge.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleCard();}});
  globalThis.VaultI18n?.apply(element);
  const card = cards[id] = {
    element, invite: element.querySelector(`#invite-${id}`), leave: element.querySelector(`#leave-${id}`),
    status: element.querySelector('.provider-status'), badge: element.querySelector('.badge'),
    picker: element.querySelector(`#${id}-tab-picker`), select: element.querySelector(`#${id}-tab`),
    recovery: element.querySelector(`#${id}-recovery`), reload: element.querySelector(`#reload-${id}`),
    allow: element.querySelector(`#allow-${id}`), roleRetry: element.querySelector(`#role-retry-${id}`), roleTarget: null, pendingTabId: null
  };
  card.roleRetry.addEventListener('click', async () => {
    if (connecting.has(id) || (controller.running || summaryBusy) || !card.roleTarget) return;
    connecting.add(id); syncControls();
    const target = card.roleTarget;
    try { await request({ type: 'ROUNDTABLE_ROLE_STATE', operation: 'reset', provider: id, ...target }); }
    catch (error) { invitationError(id, error); return; }
    finally { connecting.delete(id); syncControls(); }
    await invite(id, false, target.tabId);
  });
  card.invite.addEventListener('click', () => { automaticInvitations?.resume(id); void invite(id); });
  card.select.addEventListener('change', () => { if (card.select.value) invite(id); });
  card.reload.addEventListener('click', () => invite(id, true));
  card.leave.addEventListener('click', () => {
    if (connecting.has(id) || pendingDepartures.has(id)) return;
    automaticInvitations?.pause(id);
    if((controller.running || summaryBusy)){
      pendingDepartures.add(id);controller.stop();
      providerStatus(id,'sending',VaultI18n.t('message_026'));syncControls();
    }else leaveProvider(id);
  });
  card.allow.addEventListener('click', async () => {
    if (connecting.has(id) || (controller.running || summaryBusy)) return;
    connecting.add(id); syncControls();
    try {
      const allowed = await chrome.permissions.request({ origins: [providers[id].origin] });
      if (!allowed) throw new Error(VaultI18n.t('message_027'));
      card.allow.hidden = true;
      if(automaticInvitations){card.autoIssue=false;automaticInvitations.resume(id);automaticInvitations.changed();}
      providerStatus(id, 'success', automaticInvitations ? VaultI18n.t('message_028') : VaultI18n.t('message_029'));
    } catch (error) { providerStatus(id, 'error', error.message); }
    finally { connecting.delete(id); syncControls(); }
  });
}
let scrollPending = false;
function scrollToLatest() {
  if (scrollPending) return;
  scrollPending = true;
  // Scroll to the bottom only on a human post and completion of the first reply to that topic.
  requestAnimationFrame(() => {
    scrollPending = false;
    log.scrollTop = log.scrollHeight;
    if (!isSidePanel) window.scrollTo({ top: document.scrollingElement.scrollHeight, behavior: 'instant' });
  });
}
function addEntry(role, text, id) {
  empty.hidden = true;
  const entry = document.createElement('article'); entry.className = `entry ${role}`;
  if(id)entry.dataset.provider=id;entry.dataset.time=String(Date.now());
  const heading = document.createElement('header');
  const name = document.createElement('strong'); name.textContent = role === 'user' ? VaultI18n.t('message_030') : role === 'system' ? VaultI18n.t('message_031') : providers[id].name;
  const meta = document.createElement('span'); meta.className = 'entry-state'; meta.textContent = role === 'user' ? VaultI18n.t('message_032') : VaultI18n.t('message_033');
  const time=document.createElement('time');time.className='entry-time';time.dateTime=new Date(Number(entry.dataset.time)).toISOString();time.textContent=new Intl.DateTimeFormat(globalThis.VaultI18n?.locale||'en',{hour:'numeric',minute:'2-digit'}).format(Number(entry.dataset.time));
  heading.append(name,time,meta);
  const body = document.createElement('div'); body.className = 'entry-body'; body.textContent = text;
  if (role === 'system') body.setAttribute('role', 'status');
  entry.append(heading, body); log.append(entry);
  if (role === 'user') scrollToLatest();
  return { entry, body, meta };
}
// Serialize providers requiring foreground access until retrieval finishes, preventing focus contention.
let foregroundTail = Promise.resolve();
async function exchange(id, text, options = {}) {
  if (!providers[id].foreground) return performExchange(id, text, options);
  const previous = foregroundTail;
  let release;
  foregroundTail = new Promise(resolve => { release = resolve; });
  if (options.silent) providerStatus(id, 'sending', VaultI18n.t('message_034'));
  await previous;
  try {
    if (options.silent) providerStatus(id, 'sending', VaultI18n.t('message_035'));
    return await performExchange(id, text, options);
  } finally { release(); }
}
async function performExchange(id, text, { silent = false, images = [], requestId = crypto.randomUUID(), onProgress = () => {} } = {}) {
  await request({ type: 'ROUNDTABLE_HELLO' });
  // Side-panel pages have no own tab. Continue the meeting in the panel after switching to an AI tab.
  const ownTab = providers[id].foreground ? (isSidePanel ? (await chrome.tabs.query({active:true,currentWindow:true}))[0] : await chrome.tabs.getCurrent()) : null;
  const run = controller.active;
  const stage = text => {
    if (!silent && !run?.cancelled && controller.active === run) {
      setStatus('sending', `${providers[id].name}: ${text}`);
    }
  };
  if (!silent && run?.cancelled) return { cancelledBeforeSend: true };
  stage(images.length ? VaultI18n.t('message_036') : VaultI18n.t('message_037'));
  const result = await request({ type: 'ROUNDTABLE_SEND', provider: id, guardText: VaultI18n.t('inputGuardNotice'), text, images, requestId, silent, returnTabId: ownTab?.id, ...targets[id] });
  targets[id] = { tabId: result.tabId, conversationUrl: result.url };
  renderConnection();
  stage(VaultI18n.t('message_038'));
  const until = Date.now() + 195000;
  while (Date.now() < until) {
    const state = await request({ type: 'ROUNDTABLE_STATUS', provider: id, requestId, tabId: result.tabId, returnTabId: ownTab?.id });
    if (state.url) { targets[id] = { tabId: result.tabId, conversationUrl: state.url }; renderConnection(); }
    if (state.phase === 'error') throw new Error(state.error || VaultI18n.t('message_039'));
    if (!silent && run && state.kind === 'image') {
      await request({type:'ROUNDTABLE_DETACH_IMAGE',provider:id,tabId:result.tabId,requestId,returnTabId:ownTab?.id});
      const completed = state.phase === 'complete' ? await request({type:'ROUNDTABLE_IMAGE_RESULT',provider:id,tabId:result.tabId,requestId}) : null;
      return {detachedImage:true,images:completed?.images,task:{provider:id,tabId:result.tabId,requestId,conversationUrl:state.url||targets[id].conversationUrl,startedAt:Date.now(),topic:run.text.slice(0,1000)}};
    }
    if (state.phase === 'complete') { stage(VaultI18n.t('message_040')); return { text: state.text || '', url: state.url }; }
    stage(state.phase === 'streaming' ? VaultI18n.t('message_041') : VaultI18n.t('message_038'));
    if (!silent) onProgress(state.text || '');
    await new Promise(resolve => setTimeout(resolve, 800));
  }
  throw new Error(VaultI18n.t('message_042'));
}
function renderConnection() {
  connection.textContent = Object.entries(targets).map(([id, target]) => `${providers[id].name}: ${target.conversationUrl}`).join('\n');
}
function answerRow(record, id) {
  if (!record.answer) {
    record.answer = addEntry('assistant', '', id);
    record.answer.pending = true;
    record.answer.entry.classList.add('pending');
    record.answer.body.setAttribute('role', 'status');
  }
  return record.answer;
}
function showLogStatus(record, state, text) {
  if (state === 'sending' && record.answer && !record.answer.pending) {
    record.answer.meta.textContent = text;
    return;
  }
  const row = record.answer?.pending ? record.answer : (record.notice ||= addEntry('system', ''));
  row.body.textContent = text;
  row.meta.textContent = state === 'sending' ? VaultI18n.t('message_043') : state === 'error' ? VaultI18n.t('message_044') : VaultI18n.t('message_045');
  row.entry.dataset.state = state;
}
function clearNotice(record) {
  record.notice?.entry.remove();
  record.notice = null;
}
function removeAnswer(record) {
  record?.answer?.entry.remove();
  if (record) record.answer = null;
}
function discussionEvent(event) {
  const record = runRows.get(event.runId);
  switch (event.type) {
    case 'material': {
      const row = addEntry('system', VaultI18n.t('message_046', {0:event.material.title || event.material.url,1:event.nextTopic ? VaultI18n.t('notice_042') : ''}));
      row.entry.classList.add('material'); row.meta.textContent = VaultI18n.t('message_047');
      break;
    }
    case 'role':
      providerStatus(event.provider, event.state, event.state === 'sending' ? VaultI18n.t('message_035') : event.state === 'ready' ? VaultI18n.t('message_048') : event.error);
      break;
    case 'queued': {
      const user = addEntry('user', event.text + (event.imageNames?.length ? '\n📎 ' + event.imageNames.map((name, index) => VaultI18n.t('message_049', {0:index + 1,1:name})).join(', ') : ''));
      user.meta.textContent = event.waiting ? VaultI18n.t('message_050') : VaultI18n.t('message_033');
      runRows.set(event.runId, { user, answer: null, firstReplyShown: false });
      if (event.waiting) setStatus('sending', VaultI18n.t('message_051'));
      break;
    }
    case 'withdrawn':
      if (record) { record.user.meta.textContent = VaultI18n.t('message_052'); record.user.entry.classList.add('cancelled'); }
      break;
    case 'started':
      record.user.meta.textContent = VaultI18n.t('message_053', {0:event.automatic ? VaultI18n.t('autoMode') : VaultI18n.t('normalMode'),1:providers[event.first].name});
      syncControls();
      break;
    case 'turn':
      clearNotice(record);
      record.answer = null;
      answerRow(record, event.provider);
      speaker.textContent = VaultI18n.t('message_054', {0:providers[event.provider].name});
      counters.textContent = VaultI18n.t('message_055', {0:event.speeches,1:event.queries,2:event.passes});
      setStatus('sending', VaultI18n.t('message_056', {0:providers[event.provider].name}));
      break;
    case 'manual':
      removeAnswer(record);
      answerRow(record,event.provider);
      setStatus('sending',VaultI18n.t('manualReading',{0:providers[event.provider].name}));
      counters.textContent=VaultI18n.t('message_055',{0:event.speeches,1:event.queries,2:event.passes});
      break;
    case 'progress': {
      // Do not display partial control signals as ordinary contributions.
      if (!event.text.trim() || '[PASS]'.startsWith(event.text.trim())) break;
      const row = answerRow(record, event.provider);
      clearNotice(record);
      row.pending = false; row.entry.classList.remove('pending');
      row.body.removeAttribute('role');
      RoundtableLinks.render(row.body, event.text); row.meta.textContent = VaultI18n.t('message_057');
      break;
    }
    case 'image-detached': {
      const row = answerRow(record,event.provider);
      clearNotice(record);record.answer=null;
      window.dispatchEvent(new CustomEvent('roundtable-image-job',{detail:{task:event.task,row,images:event.images}}));
      break;
    }
    case 'reply': {
      const row = answerRow(record, event.provider);
      clearNotice(record);
      row.pending = false; row.entry.classList.remove('pending');
      row.body.removeAttribute('role');
      RoundtableLinks.render(row.body, event.text); row.meta.textContent = VaultI18n.t('message_058');
      if (!record.firstReplyShown) {
        record.firstReplyShown = true;
        scrollToLatest();
      }
      counters.textContent = VaultI18n.t('message_055', {0:event.speeches,1:event.queries,2:event.passes});
      record.answer = null;
      break;
    }
    case 'protocol-warning': {
      removeAnswer(record);
      const diagnostics = document.querySelector('#protocol-diagnostics');
      diagnostics.hidden = false;
      const detail = document.createElement('p'); detail.className = 'provider-status';
      detail.textContent = VaultI18n.t('message_059', {0:providers[event.provider].name,1:event.runId,2:event.text});
      document.querySelector('#protocol-details').append(detail);
      break;
    }
    case 'repair':
      speaker.textContent = VaultI18n.t('message_060', {0:providers[event.provider].name});
      counters.textContent = VaultI18n.t('message_055', {0:event.speeches,1:event.queries,2:event.passes});
      setStatus('sending', VaultI18n.t('message_061', {0:providers[event.provider].name}));
      break;
    case 'pass':
      removeAnswer(record);
      counters.textContent = VaultI18n.t('message_055', {0:event.speeches,1:event.queries,2:event.passes});
      setStatus('sending', VaultI18n.t('message_062', {0:providers[event.provider].name}));
      break;
    case 'discarded':
      removeAnswer(record);
      record.user.meta.textContent = VaultI18n.t('message_063');
      break;
    case 'stopping':
      setStatus('sending', VaultI18n.t('message_064'));
      break;
    case 'context-trimmed':
      if (record) record.user.meta.textContent = VaultI18n.t('message_065');
      break;
    case 'ended': {
      const reasons = { normal: VaultI18n.t('message_066'), 'all-pass': VaultI18n.t('message_067'), 'speech-limit': VaultI18n.t('message_068'), 'query-limit': VaultI18n.t('message_069'), stopped: VaultI18n.t('message_070') };
      if (!controller.pending) setStatus('success', reasons[event.reason], { inLog: false });
      clearNotice(record);
      if (record.answer?.pending) removeAnswer(record);
      counters.textContent = VaultI18n.t('message_055', {0:event.speeches,1:event.queries,2:event.passes});
      break;
    }
    case 'error':
      if (record?.answer) { record.answer.entry.classList.add('failed'); record.answer.meta.textContent = VaultI18n.t('message_071'); }
      if (record) record.user.meta.textContent = VaultI18n.t('message_072');
      setStatus('error', event.error);
      break;
    case 'idle':
      for(const id of pendingDepartures)leaveProvider(id);
      pendingDepartures.clear();
      automaticInvitations?.schedule();
      speaker.textContent = VaultI18n.t('message_073');
      syncControls();
      break;
  }
}
form.addEventListener('submit', event => {
  event.preventDefault();
  if (!meetingActive || meetingRestoring || isConnecting() || imageLoading || (controller.running || summaryBusy)) return;
  try {
    const text = input.value.trim() || (selectedImages.length ? 'Review the attached images and share your observations.' : '');
    const mentioned = RoundtableRecipients.mention(text);
    if (mentioned && imageJobs?.isBusy(mentioned)) throw Error(VaultI18n.t('imageJobBusy',{name:providers[mentioned].name}));
    const connected = Object.keys(providers).filter(id => providerAvailable(id) && !connecting.has(id));
    const first = RoundtableRecipients.choose(text, connected);
    controller.submit({ text, images: selectedImages, first,
      maxSpeeches: Number(document.querySelector('#max-speeches').value),
      maxQueries: Number(document.querySelector('#max-queries').value), language: language.value });
    if (isSidePanel) document.querySelector('#meeting-setup').open = false;
    input.value = ''; globalThis.VaultComposerSize?.resize(); input.blur(); clearImage(); syncControls();
  } catch (error) { setStatus('error', error.message); }
});
async function addImageFiles(files) {
  if (imageLoading || controller.running || summaryBusy || isConnecting() || meetingRestoring || !meetingActive) return;
  const selection = ++imageSelection;
  imageLoading = files.length > 0; syncControls();
  if (!files.length) return;
  try {
    if (selectedImages.length + files.length > RoundtableImages.MAX_COUNT) throw new Error(VaultI18n.t('message_075'));
    if (selectedImages.reduce((sum, image) => sum + image.size, 0) + files.reduce((sum, file) => sum + file.size, 0) > RoundtableImages.MAX_TOTAL_BYTES) throw new Error(VaultI18n.t('message_076'));
    const additions = [];
    for (const file of files) {
      if (!RoundtableImages.types.includes(file.type) || file.size < 1 || file.size > RoundtableImages.MAX_BYTES) throw new Error(VaultI18n.t('message_077'));
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error(VaultI18n.t('message_078'))); reader.readAsDataURL(file);
      });
      const check = new Image(); check.src = dataUrl; await check.decode();
      if (selection !== imageSelection) return;
      additions.push({ name: file.name.slice(0, 240), type: file.type, size: file.size, dataUrl });
    }
    selectedImages = RoundtableImages.validate([...selectedImages, ...additions]);
    renderImages();
    document.querySelector('#image-composer').open = true;
  } catch (error) {
    if (selection === imageSelection) setStatus('error', error.message || VaultI18n.t('message_078'));
  } finally {
    if (selection === imageSelection) { imageLoading = false; imageInput.value = ''; }
    syncControls();automaticInvitations?.schedule();
  }
}
imageInput.addEventListener('change', () => void addImageFiles([...(imageInput.files || [])]));
input.addEventListener('paste', event => {
  const items = [...(event.clipboardData?.items || [])].filter(item => item.type.startsWith('image/'));
  if (!items.length) return;
  event.preventDefault();
  void addImageFiles(items.map(item => item.getAsFile()).filter(Boolean));
});
imageRemove.addEventListener('click', () => { if (!(controller.running || summaryBusy) && !isConnecting()) { clearImage(); syncControls(); } });
stopButton.addEventListener('click', () => controller.stop());
language.addEventListener('change', () => controller.setLanguage(language.value));
input.addEventListener('compositionstart', () => { composing = true; });
input.addEventListener('compositionend', () => { composing = false; });
input.addEventListener('keydown', event => {
  if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
  if (composing || event.isComposing || event.keyCode === 229) return;
  event.preventDefault();
  if (meetingActive && !meetingRestoring && !isConnecting() && !event.repeat) form.requestSubmit(button);
});
if(location.protocol==='http:'||location.protocol==='https:'){reloadExtension.textContent=VaultI18n.t('message_079');reloadExtension.title=VaultI18n.t('message_080');}
reloadExtension.addEventListener('click', () => {
  if (isConnecting() || (controller.running || summaryBusy)) return;
  try { chrome.runtime.reload(); } catch (error) { setStatus('error', error.message); }
});
for (const id of Object.keys(providers)) createInvitationCard(id);
renderParticipants();
setStatus('ready', VaultI18n.t('message_081'));
startAutomaticInvitations();
function connectPageContext() {
  if (!isSidePanel || !globalThis.chrome?.runtime?.connect) return;
  const toggle = document.querySelector('#auto-page-context');
  const note = document.querySelector('#page-material-note');
  let port = null, closed = false, retry = null, captureTimer = null;
  const apply = message => {
    note.hidden = false;
    if (message.type === 'PAGE_PREF') {
      toggle.checked = message.enabled; toggle.disabled = false;
      note.textContent = message.enabled ? VaultI18n.t('message_082') : VaultI18n.t('message_083');
    } else if (message.type === 'PAGE_PENDING') {
      pageLoading = true; controller.setMaterial(null);
      note.textContent = VaultI18n.t('message_084');
      clearTimeout(captureTimer);
      captureTimer = setTimeout(() => {
        pageLoading = false;
        note.textContent = VaultI18n.t('message_085');
      }, 20000);
    } else if (message.type === 'PAGE_MATERIAL') {
      clearTimeout(captureTimer); pageLoading = false; controller.setMaterial(message.material);
      note.textContent = VaultI18n.t('message_086', {0:message.material.title || message.material.url,1:(message.material.truncated || message.material.text.length > 5000) ? VaultI18n.t('notice_043') : ''});
    } else if (['PAGE_DISABLED', 'PAGE_UNAVAILABLE'].includes(message.type)) {
      clearTimeout(captureTimer); pageLoading = false; controller.setMaterial(null);
      note.textContent = uiText(message.reason || VaultI18n.t('message_083'));
    }
    syncControls();
  };
  async function connect() {
    try {
      const ownWindow = await chrome.windows.getCurrent();
      if (closed) return;
      port = chrome.runtime.connect({ name: 'ROUNDTABLE_PAGE_CONTEXT' });
      port.onMessage.addListener(message => { try { apply(message); } catch { clearTimeout(captureTimer); pageLoading = false; controller.setMaterial(null); note.textContent = VaultI18n.t('message_087'); syncControls(); } });
      port.onDisconnect.addListener(() => {
        clearTimeout(captureTimer); port = null; pageLoading = false; controller.setMaterial(null); toggle.disabled = true; syncControls();
        if (!closed) retry = setTimeout(connect, 500);
      });
      port.postMessage({ type: 'START', windowId: ownWindow.id });
    } catch {
      if (!closed) retry = setTimeout(connect, 1500);
    }
  }
  toggle.addEventListener('change', () => {
    if (port) port.postMessage({ type: 'SET_ENABLED', enabled: toggle.checked });
  });
  window.addEventListener('pagehide', () => { closed = true; clearTimeout(retry); clearTimeout(captureTimer); port?.disconnect(); });
  void connect();
}
connectPageContext();


function clearInvitationIssue(id){
  const card=cards[id];card.autoIssue=false;
  card.picker.hidden=true;card.recovery.hidden=true;card.allow.hidden=true;card.roleRetry.hidden=true;
  card.roleTarget=null;card.pendingTabId=null;
  providerStatus(id,'ready',VaultI18n.t('message_088'));
  if(status.dataset.state==='error'&&status.textContent.startsWith(providers[id].name+':')){
    setStatus('ready','',{inLog:false});
  }
}
function leaveProvider(id) {
  const card=cards[id];delete targets[id];card.autoIssue=false;

  card.picker.hidden=true;card.recovery.hidden=true;card.allow.hidden=true;card.roleRetry.hidden=true;card.roleTarget=null;card.pendingTabId=null;
  renderParticipants();providerStatus(id,'ready',VaultI18n.t('message_088'));
  setStatus('ready',VaultI18n.t('message_089', {0:providers[id].name}));
}

function renderAutomaticCards() {
  for (const [id, card] of Object.entries(cards)) {
    card.element.dataset.connected=String(!!targets[id]);
    const paused=automaticInvitations?.paused.has(id)||false, joining=connecting.has(id), connected=!!targets[id];
    const issue=card.autoIssue||!card.picker.hidden||!card.recovery.hidden||!card.allow.hidden||!card.roleRetry.hidden;
    card.element.hidden=false;
    card.element.classList.toggle('auto-compact',!issue);
    card.element.classList.toggle('auto-joining',joining);
    card.invite.hidden=connected||joining;
    card.invite.textContent=joining?VaultI18n.t('message_008'):VaultI18n.t('message_090');
    card.leave.textContent=pendingDepartures.has(id)?VaultI18n.t('message_091'):VaultI18n.t('message_092');
  }
}
function startAutomaticInvitations() {
  // Subscribe to tab events in the extension only, not plain pages or legacy fixtures.
  if (!globalThis.chrome?.tabs?.onUpdated?.addListener || !globalThis.RoundtableAutoInvitations) return;
  automaticInvitations=new RoundtableAutoInvitations.Coordinator({
    discover:async()=>{await request({type:'ROUNDTABLE_HELLO'});return (await request({type:'ROUNDTABLE_DISCOVER'})).providers;},
    invite:id=>invite(id), getTarget:id=>targets[id],
    removeTarget:id=>{delete targets[id];renderParticipants();},
    canConnect:()=>meetingActive&&!meetingRestoring&&!(controller.running || summaryBusy)&&!isConnecting()&&!imageLoading&&(!Object.keys(targets).length||(!composing&&document.activeElement!==input&&!input.value.trim())),
    onState:(id,state)=>{
      if(!id){setStatus('error',state.error);return;}
      const card=cards[id];
      if(state.state==='paused'){clearInvitationIssue(id);card.element.classList.remove('is-expanded');card.element.querySelector('.provider-menu').setAttribute('aria-expanded','false');}
      else if(state.state==='choose')invitationError(id,{code:'CHOOSE_TAB',candidates:state.candidates,message:providers[id].name+VaultI18n.t('message_093')});
      else if(state.state==='error')invitationError(id,state);
      else if(state.state==='waiting'&&state.targetTabId)invitationError(id,{code:'BRIDGE_UNAVAILABLE',targetTabId:state.targetTabId,message:state.error});
      else if(state.state==='absent'){
        card.autoIssue=false;card.picker.hidden=true;card.recovery.hidden=true;card.allow.hidden=true;card.roleRetry.hidden=true;card.roleTarget=null;
        providerStatus(id,'ready',VaultI18n.t('message_094'));
      }
      renderAutomaticCards();
    }
  });
  const invitationBar=document.querySelector('#invitations');
  invitationBar.classList.add('auto-invitations');invitationBar.setAttribute('aria-label',VaultI18n.t('message_095'));
  participants.before(invitationBar);participants.hidden=true;
  const isAI=url=>typeof url==='string'&&Object.values(providers).some(provider=>url.startsWith(provider.origin.replace('*','')));
  const updated=(tabId,change,tab)=>{if((change.url||change.status)&&isAI(tab?.url||change.url))automaticInvitations.changed(tabId);};
  const created=tab=>{if(!tab.url||isAI(tab.url))automaticInvitations.changed(tab.id);};
  const removed=tabId=>automaticInvitations.changed(tabId);
  chrome.tabs.onUpdated.addListener(updated);
  chrome.tabs.onCreated?.addListener(created);
  chrome.tabs.onRemoved?.addListener(removed);
  input.addEventListener('blur',()=>automaticInvitations.schedule());
  input.addEventListener('input',()=>{if(!input.value.trim())automaticInvitations.schedule();});
  window.addEventListener('pagehide',()=>{
    automaticInvitations.dispose();chrome.tabs.onUpdated.removeListener?.(updated);
    chrome.tabs.onCreated?.removeListener?.(created);chrome.tabs.onRemoved?.removeListener?.(removed);
  });
  renderAutomaticCards();automaticInvitations.schedule(0);
}
