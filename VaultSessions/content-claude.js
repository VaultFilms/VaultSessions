"use strict";

(() => {
  const VERSION = '0.10.5';
  // Input, sending, and a test response were verified in signed-in Claude on 2026-10-29.
  const EDITORS = ['[data-testid="chat-input"][contenteditable="true"]'];
  const SEND = "button[data-testid=\"chat-input-send\"], button[aria-label=\"メッセージを送信\"], button[aria-label=\"Send message\"], button[aria-label=\"Envoyer\"], button[aria-label=\"Envoyer le message\"], button[aria-label=\"Envoyer une invite\"], button[aria-label=\"Senden\"], button[aria-label=\"Nachricht senden\"], button[aria-label=\"Prompt senden\"], button[aria-label=\"Enviar\"], button[aria-label=\"Enviar mensaje\"], button[aria-label=\"Enviar indicación\"], button[aria-label=\"Invia\"], button[aria-label=\"Invia messaggio\"], button[aria-label=\"Invia prompt\"], button[aria-label=\"Kirim\"], button[aria-label=\"Kirim pesan\"], button[aria-label=\"Kirim perintah\"], button[aria-label=\"Enviar mensagem\"], button[aria-label=\"Enviar comando\"], button[aria-label=\"भेजें\"], button[aria-label=\"संदेश भेजें\"], button[aria-label=\"प्रॉम्प्ट भेजें\"]";
  // Stop selectors are compatibility fallbacks; prefer the response data-is-streaming attribute for completion.
  const STOP = "button[data-testid=\"chat-input-stop\"], button[aria-label=\"応答を停止\"], button[aria-label=\"Stop response\"], button[aria-label=\"Arrêter la réponse\"], button[aria-label=\"Arrêter la génération\"], button[aria-label=\"Generierung beenden\"], button[aria-label=\"Antwort stoppen\"], button[aria-label=\"Generierung stoppen\"], button[aria-label=\"Detener respuesta\"], button[aria-label=\"Detener generación\"], button[aria-label=\"Interrompi risposta\"], button[aria-label=\"Interrompi generazione\"], button[aria-label=\"Hentikan respons\"], button[aria-label=\"Hentikan jawaban\"], button[aria-label=\"Hentikan pembuatan\"], button[aria-label=\"Parar resposta\"], button[aria-label=\"Interromper resposta\"], button[aria-label=\"Parar de gerar\"], button[aria-label=\"जवाब रोकें\"], button[aria-label=\"उत्तर रोकें\"], button[aria-label=\"जनरेट करना बंद करें\"]";
  const USER_MESSAGE = '[data-testid="user-message"]';
  const ASSISTANT = '[data-testid="assistant-message"]';
  let busy = false;
  let job = null;
  let watchTimer = null;
  let refreshWatch = null;
  let watchObserver = null;
  const normalize = text => text.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").trim();
  const linkURL = url => url.trim().replace(/^<|>$/g, '').replace(/\\+(?=[&()])/g, '');
  const linkText = (label, url) => linkURL(label) === linkURL(url) ? label : `${label}\uFFF0${linkURL(url)}\uFFF1`;
  function renderedMarkdown(text) {
    // Claude renders backticks and image links inside JSON as inline Markdown.
    // Preserve link destinations when normalizing so equal labels with different URLs remain distinct.
    const pattern = /!?\[([^\]\n]*)\]\(/g;
    let out = '', last = 0, match;
    while ((match = pattern.exec(text))) {
      let depth = 1, end = pattern.lastIndex;
      for (; end < text.length; end++) {
        if (text[end] === '\\') { end++; continue; }
        if (text[end] === '(') depth++;
        if (text[end] === ')' && --depth === 0) break;
      }
      if (depth !== 0) continue;
      const url = text.slice(pattern.lastIndex, end);
      if (!url || /\s/.test(url)) continue;
      out += text.slice(last, match.index) + linkText(match[1], url);
      last = end + 1; pattern.lastIndex = last;
    }
    return (out + text.slice(last)).split(/(\uFFF0[^\uFFF1]*\uFFF1)/g).map(part => part.startsWith('\uFFF0') ? part : part.replace(/`+/g, '')
      .replace(/\*\*([\s\S]+?)\*\*|__([\s\S]+?)__/g, (_match, bold, under) => bold ?? under)).join('');
  }
  const stripReceipt = text => text.replace(/\s*Roundtable receipt: [a-f0-9-]{36} \(tracking only; do not repeat\)\s*$/, '');
  const canonicalText = text => normalize(renderedMarkdown(stripReceipt(text))).replace(/\s+/g, ' ');
  const visible = element => element?.isConnected && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
  // innerText adds extra newlines for empty <div><br></div> blocks.
  // Normalize browser edits and ProseMirror paragraphs to the same plain text.
  function plainText(element) {
    let text = "";
    [...element.childNodes].forEach((node, index) => {
      if (node.nodeType === Node.TEXT_NODE) { text += node.textContent; return; }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.tagName === "BR") {
        if (index < element.childNodes.length - 1) text += "\n";
        return;
      }
      if (/^(P|DIV)$/.test(node.tagName) && index > 0) text += "\n";
      text += plainText(node);
    });
    return text;
  }
  const read = editor => editor instanceof HTMLTextAreaElement ? editor.value : plainText(editor);
  const findEditor = () => EDITORS.flatMap(selector => [...document.querySelectorAll(selector)]).find(visible);
  const findSend = () => [...document.querySelectorAll(SEND)].find(visible);
  const generating = () => [...document.querySelectorAll(STOP)].some(visible);
  const pause = () => new Promise(resolve => setTimeout(resolve, 100));
  async function waitFor(check, timeout) {
    const deadline = Date.now() + timeout;
    do {
      const value = check();
      if (value) return value;
      await pause();
    } while (Date.now() < deadline);
    return null;
  }

  const messageKey = element => element.getAttribute('data-turn-key') || element.id || element;
  const userBodies = () => [...document.querySelectorAll(USER_MESSAGE)];
  // Claude converts user Markdown into HTML lists.
  // Restore list numbers omitted by innerText before matching the submitted role instructions.
  function userText(element) {
    function readNode(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent;
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      if (node.matches('button, [aria-hidden="true"]')) return '';
      if (node.tagName === 'BR') return '\n';
      if (node.tagName === 'A' && node.getAttribute('href')) return linkText([...node.childNodes].map(readNode).join(''), node.getAttribute('href'));
      let prefix = '';
      if (node.tagName === 'LI' && node.parentElement?.tagName === 'OL') {
        const siblings = [...node.parentElement.children].filter(child => child.tagName === 'LI');
        let number = Number(node.parentElement.getAttribute('start') || 1);
        for (const sibling of siblings) {
          if (sibling.hasAttribute('value')) number = Number(sibling.getAttribute('value'));
          if (sibling === node) break;
          number++;
        }
        prefix = `${number}. `;
      }
      const text = prefix + [...node.childNodes].map(readNode).join('');
      return /^(P|DIV|LI|OL|UL|H[1-6]|PRE|BLOCKQUOTE)$/.test(node.tagName) ? text + '\n' : text;
    }
    return readNode(element);
  }
  const assistantBodies = () => [...document.querySelectorAll(ASSISTANT)];
  const bodyText = element => [...element.querySelectorAll('[data-perf-reply-text]')].map(body => body.innerText).join('\n\n').trim();

  function endJob(phase, error) {
    clearInterval(watchTimer);
    watchTimer = null;
    refreshWatch = null;
    watchObserver?.disconnect(); watchObserver = null;
    job.phase = phase;
    if (error) job.error = error;
    busy = false;
  }

  function watchReply(userMessage, previousReplies, previousUserTexts, prompt, silent, receipt) {
    let lastChange = Date.now();
    const started = Date.now();
    let path = location.pathname;
    let userKey = messageKey(userMessage);
    const expectedIndex = previousUserTexts.length;
    const expectedText = canonicalText(prompt);
    const matches = element => (receipt && userText(element).includes(receipt)) || canonicalText(userText(element)) === expectedText;
    let missingSince = null;
    let relayReadySince=null;
    let silentReadySince = null;
    const allowsNoReply = silent && (/^\[switch to (chat|debate)\]$/.test(prompt)
      || (prompt.startsWith('You are participating in a group discussion\n') && prompt.includes('Debate persona:')));
    let svgSource = '', svgChangedAt = Date.now(), capturing = false;
    const homePath = value => value === '/new' || value === '/';
    const savedPath = value => /^\/chat\/[^/]+\/?$/.test(value);
    function check() {
      if (location.pathname !== path) {
        if (homePath(path) && savedPath(location.pathname)) path = location.pathname;
        else { endJob('error', 'Claudeの会話が切り替わりました。回答取得を中止しました。'); return; }
      }
      job.url = location.origin + location.pathname;
      const users = userBodies();
      if (!userMessage.isConnected || !matches(userMessage)) {
        let same = users.find(element => messageKey(element) === userKey && matches(element));
        // Both nodes and IDs can change when an optimistic message is confirmed.
        // Match order and preceding messages as well as text to avoid selecting an older duplicate.
        if (!same && users[expectedIndex] && matches(users[expectedIndex])
          && previousUserTexts.every((text, index) => users[index] && canonicalText(userText(users[index])) === text)) {
          same = users[expectedIndex];
        }
        if (same) userMessage = same;
        else {
          missingSince ??= Date.now();
          if (Date.now() - missingSince > 10000) endJob('error', '送信した発言を再描画後に特定できませんでした。自動再送はしません。Claude側を確認してください。');
          return;
        }
      }
      missingSince = null;
      userKey = messageKey(userMessage);
      if (users.some(element =>
        element !== userMessage && (userMessage.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING))) {
        endJob('error', 'Claude側で別の発言が追加されました。回答を混同しないため取得を中止しました。'); return;
      }
      const replies = assistantBodies().filter(element =>
        !previousReplies.has(messageKey(element)) &&
        (userMessage.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING));
      const reply = replies.at(-1);
      if (!silent && globalThis.RoundtableClaudeSVG) {
        const svg = RoundtableClaudeSVG.inspect(reply);
        if (svg) { job.kind = 'image'; job.phase = 'generating_image'; }
        if (job.kind === 'image') {
          if (reply) job.text = bodyText(reply);
          if (svg?.source !== svgSource) { svgSource = svg?.source; svgChangedAt = Date.now(); }
          if (svg && reply?.getAttribute('data-is-streaming') === 'false' && !generating() && savedPath(path)
            && Date.now() - svgChangedAt >= 1200) {
            if (svg.kind === 'file') { endJob('complete'); return; }
            if (svg.source && !capturing) {
              capturing = true;const activeJob = job;
              RoundtableClaudeSVG.capture(svg.source).then(images => {
                if (job !== activeJob) return;
                job.images = images;endJob('complete');
              },error => {if(job === activeJob)endJob('error',error.message);});
            }
          }
          if (Date.now() - started > 20 * 60 * 1000) endJob('error', 'SVG generation timed out. Check the official chat.');
          return;
        }
      }
      if(job.imageRelay) {
        const settled=reply?.getAttribute('data-is-streaming')==='false' && savedPath(path);
        if(settled && !generating()) {
          relayReadySince ??= Date.now();
          if(Date.now()-relayReadySince>=1500){endJob('complete');return;}
        }else relayReadySince=null;
        if(Date.now()-started>20*60*1000)endJob('error','Image sharing response timed out. Check the official chat.');
        return;
      }
      if (reply) {
        const text = bodyText(reply);
        if (text !== job.text) {
          job.text = text; lastChange = Date.now();
          if(!silent)job.richText=globalThis.RoundtableRichText?.captureReply(reply,'claude')||null;
        }
        if (text) job.phase = 'streaming';
        const completed = reply.getAttribute('data-is-streaming') === 'false';
        if ((text || silent) && completed && !generating() && Date.now() - lastChange >= 1200) {
          if(!silent)job.richText=globalThis.RoundtableRichText?.captureReply(reply,'claude')||null;
          endJob('complete'); return;
        }
      }
      if (allowsNoReply && !job.text && savedPath(path) && !generating()) {
        const editor = findEditor();
        const scope = userMessage.closest('[data-testid^=chat-message]') || userMessage.parentElement;
        const hasError = [...(scope?.querySelectorAll?.('[role="alert"], [data-error="true"]') || [])].some(visible);
        if (editor && !editor.disabled && editor.getAttribute('aria-disabled') !== 'true'
            && !editor.closest('[aria-busy="true"]') && !normalize(read(editor)) && !hasError) {
          silentReadySince ??= Date.now();
          if (Date.now() - silentReadySince >= 2000) { endJob('complete'); return; }
        } else silentReadySince = null;
      } else silentReadySince = null;
      if (Date.now() - started > 180000) {
        endJob('error', '回答の完了を3分以内に確認できませんでした。途中の文章は表示しています。再送前にClaude側を確認してください。');
      }
    }
    const tick = () => {
      try { check(); }
      catch { endJob('error', '回答のDOM読み取りに失敗しました。Claude側を確認してください。'); }
    };
    refreshWatch = tick;
    if (typeof MutationObserver !== 'undefined') {
      watchObserver = new MutationObserver(tick);
      watchObserver.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['data-is-streaming']});
    }
    watchTimer = setInterval(tick, 300);
    tick();
  }

  async function send(text, requestId, foreground, silent, images = [], contextOnly = false, imageRelay = false) {
    if (busy) throw Object.assign(new Error("このClaudeタブで送信処理中です。"), { code: "PROVIDER_BUSY" });
    if (typeof text !== "string" || !text.trim() || text.length > 75000) throw Error("The outgoing message is empty or exceeds 75,000 characters.");
    const modeSwitch = silent && /^\[switch to (chat|debate)\]$/.test(text);
    const receipt = modeSwitch ? null : `Roundtable receipt: ${crypto.randomUUID()} (tracking only; do not repeat)`;
    if (receipt) text += `\n\n${receipt}`;
    if (text.length > 75000) throw Error("The outgoing message with its receipt exceeds 75,000 characters.");
    busy = true;
    job = { requestId, imageRelay, receipt, phase: 'sending', text: '', url: location.origin + location.pathname };
    let clicked = false;
    let watching = false;
    try {
      if (foreground && !await waitFor(() => !document.hidden, 5000)) throw new Error('Claudeのタブが表示されていません。Claudeを表示してから送信してください。文章はまだ送信していません。');
      if (generating()) throw Object.assign(new Error("Claudeが応答中です。完了してから送信してください。"), { code: "PROVIDER_BUSY" });
      const editor = await waitFor(findEditor, 5000);
      if (!editor) throw new Error("Claudeの入力欄が見つかりません。ログイン、通常のチャット画面、読み込み完了を確認してください。DOM変更の可能性もあります。");
      if (normalize(read(editor))) throw Object.assign(new Error("Claudeに下書きがあります。下書きを送信または削除してから実行してください。"), { code: "COMPOSER_DRAFT" });
      if (editor.disabled || editor.getAttribute("aria-disabled") === "true") throw new Error("Claudeの入力欄が無効です。");
      if (globalThis.RoundtableImageUpload) RoundtableImageUpload.checkDraft(editor);
      editor.focus();
      if (editor instanceof HTMLTextAreaElement) {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(editor, text);
        editor.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        selection.removeAllRanges();
        selection.addRange(range);
        // Use browser editing to deliver input events to ProseMirror.
        if (!document.execCommand("insertText", false, text)) throw new Error("ブラウザのテキスト挿入操作が失敗しました。");
      }
      if (normalize(read(editor)) !== normalize(text)) throw new Error("入力内容が一致しません。Claudeの下書きを確認してください。");
      if (images.length) {
        if (!globalThis.RoundtableImageUpload) throw new Error('画像連携スクリプトが未更新です。公式タブを再読み込みしてください。');
        await RoundtableImageUpload.attach('claude', editor, images, requestId, findSend);
      }
      const button = await waitFor(() => {
        const candidate = findSend();
        return candidate && !candidate.disabled && candidate.getAttribute("aria-disabled") !== "true" ? candidate : null;
      }, 5000);
      if (!button) throw new Error("送信ボタンが見つからないか、無効です。入力内容はClaude側に残っています。DOM変更や利用制限を確認してください。");
      if (generating() || normalize(read(editor)) !== normalize(text)) throw new Error("送信前に画面が変わりました。Claudeの下書きを確認してください。");
      // Virtualized conversations may reuse existing DOM nodes for new messages.
      const previousMessages = new Set(userBodies().map(messageKey));
      const previousUserTexts = userBodies().map(element => canonicalText(userText(element)));
      const previousReplies = new Set(assistantBodies().map(messageKey));
      button.click();
      clicked = true;
      const confirmed = await waitFor(() => {
        return userBodies().find(element =>
          !previousMessages.has(messageKey(element)) && ((receipt && userText(element).includes(receipt)) || canonicalText(userText(element)) === canonicalText(text)));
      }, 12000);
      if (!confirmed) throw new Error("送信ボタンを押しましたが、送信完了を確認できませんでした。自動再送はしません。Claudeの画面を確認してください。");
      if(contextOnly){
        job.phase='complete';job.text='';job.url=location.origin+location.pathname;
        return {ok:true,requestId,url:job.url,contextDelivered:true};
      }
      job.phase = 'waiting';
      watching = true;
      watchReply(confirmed, previousReplies, previousUserTexts, text, silent, receipt);
      return { ok: true, requestId, url: job.url };
    } catch (error) {
      job.phase = 'error';
      job.error = error.message;
      return { ok: false, uncertain: clicked, error: error.message, ...(error.code ? { code: error.code } : {}) };
    } finally {
      if (!watching) busy = false;
    }
  }

  function recoverRole(text) {
    if (typeof text !== 'string' || !text.startsWith('You are participating in a group discussion\n') || text.length > 20000) return { ok: false, error: 'Role復旧の指示が不正です。' };
    if (busy || generating()) return { ok: true, recovered: false };
    const users = userBodies();
    const index = users.findLastIndex(user => canonicalText(userText(user)) === canonicalText(text));
    if (index < 0) return { ok: true, recovered: false };
    const user = users[index], next = users[index + 1];
    const reply = assistantBodies().filter(element =>
      (user.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
      && (!next || (element.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING))).at(-1);
    if (!reply) return { ok: true, recovered: false };
    const completed = reply.getAttribute('data-is-streaming') === 'false';
    return { ok: true, recovered: !!completed, url: location.origin + location.pathname };
  }

  async function imageResult(requestId) {
    if (job?.requestId !== requestId || job.kind !== 'image' || job.phase !== 'complete') return {ok:false,error:'The SVG image is not ready.'};
    const users=userBodies(), user=users.findLast(element=>userText(element).includes(job.receipt));
    if(!user||user!==users.at(-1)||job.url!==location.origin+location.pathname)throw Error('The SVG conversation has changed.');
    if(job.images)return {ok:true,images:job.images,text:job.text,url:job.url};
    const reply=assistantBodies().filter(element=>user.compareDocumentPosition(element)&Node.DOCUMENT_POSITION_FOLLOWING).at(-1);
    const svg=RoundtableClaudeSVG.inspect(reply);
    if(svg?.kind!=='file')throw Error('The generated SVG file is no longer available.');
    if(!job.previewPrepared){
      const old=[...document.querySelectorAll('iframe')].filter(frame=>frame.src.startsWith('https://www.claudeusercontent.com'));
      for(const frame of old){
        const close=frame.closest('[role="group"]')?.querySelector('button[aria-label="Close"],button[aria-label="閉じる"]');
        if(!close)throw Error('Close the previous Claude file preview before retrieving this SVG.');
        close.click();
      }
      if(old.length&&!await waitFor(()=>old.every(frame=>!frame.isConnected),5000))return {ok:true,pending:true};
      svg.element.click();job.previewPrepared=true;
    }
    const frame=[...document.querySelectorAll('iframe')].find(element=>{
      try{const url=new URL(element.src);return url.origin==='https://www.claudeusercontent.com'&&url.searchParams.get('contentType')==='image/svg+xml';}catch{return false;}
    });
    if(!frame)return {ok:true,pending:true};
    frame.loading='eager';
    return {ok:true,needsFrame:true,text:job.text,url:job.url};
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return;
    if(message?.type==='ROUNDTABLE_CLAUDE_INSPECT'){
      if(!globalThis.VaultInspectorDOM){sendResponse({ok:false,error:'Reload the official AI tab to enable Inspector.'});return;}
      sendResponse({ok:true,report:VaultInspectorDOM.inspect('claude',{editor:EDITORS,send:SEND,stop:STOP,user:USER_MESSAGE,reply:ASSISTANT,image:'img,canvas'},{phase:job?.phase,kind:job?.kind,busy,generating:generating()})});return;
    }
    if (message?.type === 'ROUNDTABLE_CLAUDE_HELLO') {
      sendResponse({ ok: true, version: VERSION, ready: !!findEditor(), busy: busy || generating(), url: location.origin + location.pathname });
      return;
    }
    if (message?.type === 'ROUNDTABLE_CLAUDE_RECOVER_ROLE') { sendResponse(recoverRole(message.text)); return; }
    if (message?.type === 'ROUNDTABLE_CLAUDE_IMAGE_RESULT') { imageResult(message.requestId).then(sendResponse,error=>sendResponse({ok:false,error:error.message})); return true; }
    if (message?.type === 'ROUNDTABLE_CLAUDE_STATUS') {
      if (job?.requestId === message.requestId) refreshWatch?.();
      const {images: cachedImages, ...state} = job || {};
      sendResponse(job?.requestId === message.requestId
        ? { ok: true, ...state, ...(job.imageRelay ? {text:'',richText:null} : {}) }
        : { ok: false, error: '回答の取得状態が見つかりません。Claudeを再読み込みした場合は取得が中断されます。' });
      return;
    }
    if (message?.type !== "ROUNDTABLE_CLAUDE_SEND") return;
    send(message.text, message.requestId, message.foreground, message.silent === true, message.images, message.contextOnly === true, message.imageRelay === true).then(sendResponse, error => sendResponse({ ok: false, error: error.message, code: error.code }));
    return true;
  });
})();
