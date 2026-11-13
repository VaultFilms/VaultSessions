'use strict';
(() => {
  const VERSION = '0.1.6';
  const EDITOR = 'form [data-testid="chat-input"] .query-bar-editor[contenteditable="true"], form .query-bar-editor[contenteditable="true"]';
  const SEND = 'button[type="submit"], button[data-testid="send-button"], button[aria-label="Send message"], button[aria-label="Submit"]';
  const STOP = 'button[data-testid="stop-button"], button[aria-label="Stop"], button[aria-label^="Stop generating"], button[aria-label^="Stop response"], button[aria-label="生成を停止"], button[aria-label="回答を停止"]';
  const USER = '[data-testid="user-message"]';
  const ASSISTANT = '[data-testid="assistant-message"]';
  const BODY = '.response-content-markdown';
  const ACTIONS = 'button[aria-label="Copy response"], button[aria-label="Good response"], button[aria-label="Bad response"]';
  const PREFIX = 'ROUNDTABLE_GROK_';
  const visible = el => !!el?.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const enabled = el => visible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
  const editor = () => [...document.querySelectorAll(EDITOR)].find(visible);
  const form = () => editor()?.closest('form');
  const sendButton = () => [...(form()?.querySelectorAll(SEND) || [])].find(enabled);
  const generating = () => [...(form()?.querySelectorAll(STOP) || [])].some(visible);
  const users = () => [...document.querySelectorAll(USER)];
  const replies = () => [...document.querySelectorAll(ASSISTANT)];
  const turn = element => element?.closest('[id^="response-"]');
  const textOf = element => element?.innerText?.trim() ?? '';
  // The full bubble text can be rendered as Markdown even while visually collapsed.
  // Restore structural markers for exact prompt matching; exclude the speaker and Show more UI.
  function sourceText(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName;
    if (tag === 'BR') return '\n';
    if (tag === 'BUTTON' || node.hasAttribute('data-no-copy')) return '';
    if (tag === 'OL' || tag === 'UL') {
      let number = Number(node.getAttribute('start')) || 1;
      return [...node.children].map(child => {
        if (child.tagName !== 'LI') return sourceText(child);
        if (child.hasAttribute('value')) number = Number(child.getAttribute('value'));
        const marker = tag === 'OL' ? `${number++}. ` : '- ';
        return '\n' + marker + [...child.childNodes].map(sourceText).join('');
      }).join('') + '\n';
    }
    const text = [...node.childNodes].map(sourceText).join('');
    if (/^H[1-6]$/.test(tag)) return '\n' + '#'.repeat(Number(tag[1])) + ' ' + text + '\n';
    return /^(P|DIV|SECTION|BLOCKQUOTE)$/.test(tag) ? '\n' + text + '\n' : text;
  }
  const userText = element => {
    const body = element.querySelector('[data-bubble-text]') || element.querySelector(':scope > span');
    if (!body) return textOf(element);
    return body.nodeType === Node.ELEMENT_NODE ? sourceText(body).trim() : body.textContent?.trim() || '';
  };
  const normalize = text => text.replace(/\s+/g, ' ').trim();
  const url = () => location.origin + location.pathname;
  const saved = path => /^\/c\/[^/]+\/?$/.test(path);
  const follows = (before, after) => !!(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING);
  const completed = reply => !!turn(reply)?.querySelector(ACTIONS);
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  let job, timer;

  function checkUsageLimit() {
    const notices = document.querySelectorAll('[role="alert"], [role="status"], [role="dialog"], [data-sonner-toast]');
    const limit = /(?:limit (?:has been )?reached|(?:hit|reached|exceeded).{0,50}(?:limit|quota)|(?:rate|usage|message) limit|too many requests|利用上限|上限に達|利用制限に達|回数制限)/i;
    if ([...notices].some(node => visible(node) && !node.closest(USER + ', ' + BODY) && limit.test(textOf(node)))) {
      throw Object.assign(Error('Grok has reached its usage limit. Try again later.'), {code:'GROK_UNAVAILABLE'});
    }
  }

  async function waitFor(check, ms) {
    const deadline = Date.now() + ms;
    do {
      const value = check();
      if (value) return value;
      await delay(100);
    } while (Date.now() < deadline);
    return null;
  }

  function finish(phase, error, code) {
    clearInterval(timer);
    timer = null;
    job.phase = phase;
    if (error) job.error = error;
    if (code) job.code = code;
  }

  function watch(matches, silent) {
    const deadline = Date.now() + 180000;
    const svgTracker = globalThis.RoundtableSVG?.createTracker({
      current:()=>job,
      complete:(task,images)=>{task.images=images;finish('complete');},
      fail:(_task,error)=>finish('error',error)
    });
    let stableSince = 0, missingSince = 0, previousReply, previousText;
    const tick = () => {
      try {
        checkUsageLimit();
        const path = location.pathname;
        if (job.url !== url() && (saved(new URL(job.url).pathname) || !saved(path))) {
          return finish('error', 'The Grok conversation changed. Reply collection stopped.');
        }
        if (Date.now() >= deadline) return finish('error', 'Grok did not finish within three minutes. Check the official tab.', 'GROK_UNAVAILABLE');
        const user = users().findLast(matches);
        if (!user) {
          missingSince ||= Date.now();
          if (Date.now() - missingSince > 10000) finish('error', 'The submitted Grok message is no longer visible.');
          return;
        }
        missingSince = 0;
        if (user !== users().at(-1)) return finish('error', 'A different message was sent in Grok. Reply collection stopped.');
        job.url = url();
        const reply = replies().findLast(candidate => follows(user, candidate));
        const body = reply?.querySelector(BODY);
        const text = textOf(body);
        if (!silent && !job.imageRelay && svgTracker?.update(job,reply,!!reply && completed(reply) && !generating() && saved(path))) {
          job.text = text;
          return;
        }
        if (!silent) {
          job.text = text;
          if (text) job.phase = 'streaming';
        }
        if (reply !== previousReply || text !== previousText) stableSince = 0;
        previousReply = reply;
        previousText = text;
        const noReply = silent && !text && !job.imageRelay && enabled(editor()) && !textOf(editor())
          && !turn(user)?.querySelector('[role="alert"], [data-error="true"]');
        const settled = saved(path) && !generating() && ((!!reply && completed(reply)) || noReply);
        if (!settled) { stableSince = 0; return; }
        stableSince ||= Date.now();
        if (Date.now() - stableSince < (noReply ? 2500 : 1000)) return;
        if (!silent) {
          job.richText = globalThis.RoundtableRichText?.captureReply(body, 'grok');
          if (job.kind === 'image' && text) {
            delete job.kind;
            job.imageFallback = true;
          }
        }
        finish('complete');
      } catch (error) {
        if (error.code === 'GROK_UNAVAILABLE') finish('error', error.message, error.code);
        else finish('error', 'The Grok reply could not be read. Check the official tab.');
      }
    };
    timer = setInterval(tick, 350);
  }

  async function send(message) {
    if ((job && ['sending','waiting','streaming','generating_image'].includes(job.phase)) || generating()) {
      return {ok:false,code:'PROVIDER_BUSY',error:'Grok is already responding. Wait for it to finish.'};
    }
    try { checkUsageLimit(); }
    catch (error) { return {ok:false,error:error.message,code:error.code}; }
    const {requestId, silent, contextOnly, imageRelay} = message;
    const startURL = url();
    let clicked = false;
    const receipt = !silent || contextOnly || imageRelay ? 'VSREQUEST' + crypto.randomUUID().replace(/-/g, '') + 'END' : '';
    const text = receipt ? receipt + '\nDelivery reference only; do not repeat it.\n\n' + message.text : message.text;
    const start = editor();
    if (!enabled(start)) return {ok:false,code:'GROK_UNAVAILABLE',error:'The Grok chat composer was not found. Open a signed-in chat.'};
    if (textOf(start)) return {ok:false,code:'COMPOSER_DRAFT',error:'Grok has a draft. Send or clear it before continuing.'};
    job = {requestId, receipt, phase:'sending', imageRelay, text:'', url:startURL};
    try {
      if (typeof message.text !== 'string' || !message.text.trim() || text.length > 75000) throw Error('Invalid Grok message length.');
      RoundtableImageUpload.checkDraft(start);
      start.focus();
      if (!document.execCommand('insertText', false, text) || normalize(textOf(start)) !== normalize(text)) {
        throw Error('Grok did not accept the complete message. Nothing was sent.');
      }
      if (message.images?.length) await RoundtableImageUpload.attach('grok', start, message.images, requestId, sendButton);
      const button = await waitFor(() => { checkUsageLimit(); return sendButton(); }, 5000);
      if (!button) throw Object.assign(Error('Grok’s send button is unavailable. Nothing was sent.'), {code:'GROK_UNAVAILABLE'});
      if (url() !== startURL || editor() !== start || normalize(textOf(start)) !== normalize(text) || generating()) {
        throw Error('The Grok composer changed or the send button was unavailable. Nothing was sent.');
      }
      const existing = new Set(users().map(node => turn(node)?.id || node));
      const matches = node => receipt ? userText(node).includes(receipt)
        : !existing.has(turn(node)?.id || node) && normalize(userText(node)) === normalize(text);
      button.click();
      clicked = true;
      const confirmed = await waitFor(() => { checkUsageLimit(); return users().findLast(matches); }, 12000);
      if (!confirmed) throw Object.assign(Error('Grok did not confirm the submitted message. Check the official tab before retrying.'), {code:'GROK_UNAVAILABLE'});
      job.url = url();
      if (contextOnly) {
        finish('complete');
        return {ok:true,url:job.url,contextDelivered:true};
      }
      job.phase = 'waiting';
      watch(matches, silent);
      return {ok:true,url:job.url};
    } catch (error) {
      finish('error', error.message);
      return {ok:false,error:error.message,uncertain:clicked,code:error.code};
    }
  }

  const speech=globalThis.RoundtableSpeech?.create({provider:'grok',getJob:()=>job,users:users,replies:replies,userText,url:()=>url()});
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || !message?.type?.startsWith(PREFIX)) return;
    const operation = message.type.slice(PREFIX.length);
    if(operation==='SPEECH'){if(!speech){respond({ok:false,state:'unsupported'});return;}speech.handle(message).then(respond);return true;}
    const busy = !!job && ['sending','waiting','streaming','generating_image'].includes(job.phase);
    if (operation === 'ABANDON_IMAGE') {
      if (job?.requestId === message.requestId && job.kind === 'image') {
        finish('abandoned');
        job.abandoned = true;
        globalThis.RoundtableSVG?.releaseFrame(job);
        job.images = null;
      }
      respond({ok:true});
      return;
    }
    if (operation === 'HELLO') respond({ok:true,version:VERSION,ready:!!editor(),busy:busy || generating(),url:url()});
    if (operation === 'STATUS') {
      const {images:cachedImages,...state}=job || {};
      respond(job?.requestId === message.requestId ? {ok:true,...state} : {ok:false,error:'No matching Grok request.'});
    }
    if (operation === 'IMAGE_RESULT') {
      const user = users().findLast(node=>job?.receipt && userText(node).includes(job.receipt));
      if (job?.requestId !== message.requestId || job.phase !== 'complete' || (!job.images?.length&&!job.svgFrame)
          || job.url !== url() || !user || user !== users().at(-1)) {
        respond({ok:false,error:'The Grok SVG is unavailable or the conversation changed.'});
      } else if(job.svgFrame) {
        const reply=replies().findLast(candidate=>follows(user,candidate));
        respond(RoundtableSVG.collectFrame(job,reply,message.framesReady===true));
      } else respond({ok:true,images:job.images,text:job.text,url:job.url});
      return;
    }
    if (operation === 'INSPECT') {
      respond({ok:true,report:VaultInspectorDOM.inspect('grok',{editor:EDITOR,send:SEND,stop:STOP,user:USER,reply:ASSISTANT},{phase:job?.phase,busy,generating:generating()})});
    }
    if (operation === 'RECOVER_ROLE') {
      if (typeof message.text !== 'string' || !message.text.trim()) {
        respond({ok:false,error:'Invalid Grok role instructions.'});
        return;
      }
      const user = users().findLast(node => normalize(userText(node)) === normalize(message.text));
      const nextUser = user && users().find(candidate => follows(user, candidate));
      const reply = user && replies().findLast(candidate => follows(user, candidate) && (!nextUser || follows(candidate,nextUser)));
      respond({ok:true,url:url(),recovered:!!user && saved(location.pathname) && !busy && !generating()
        && (!!reply && completed(reply) || !nextUser && !reply && enabled(editor()) && !textOf(editor())
          && !turn(user)?.querySelector('[role="alert"], [data-error="true"]'))});
    }
    if (operation === 'SEND') { send(message).then(respond, error => respond({ok:false,error:error.message})); return true; }
  });
})();
