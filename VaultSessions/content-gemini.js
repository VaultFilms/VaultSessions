"use strict";

(() => {
  const VERSION = '0.9.3';
  // DOM verified on the signed-in Gemini website on 2026-10-29.
  const EDITORS = ['.ql-editor[contenteditable="true"][role="textbox"]'];
  const SEND = "button.send-button, button[aria-label=\"プロンプトを送信\"], button[aria-label=\"Send message\"], button[aria-label=\"Send prompt\"], button[aria-label=\"Envoyer\"], button[aria-label=\"Envoyer le message\"], button[aria-label=\"Envoyer une invite\"], button[aria-label=\"Senden\"], button[aria-label=\"Nachricht senden\"], button[aria-label=\"Prompt senden\"], button[aria-label=\"Enviar\"], button[aria-label=\"Enviar mensaje\"], button[aria-label=\"Enviar indicación\"], button[aria-label=\"Invia\"], button[aria-label=\"Invia messaggio\"], button[aria-label=\"Invia prompt\"], button[aria-label=\"Kirim\"], button[aria-label=\"Kirim pesan\"], button[aria-label=\"Kirim perintah\"], button[aria-label=\"Enviar mensagem\"], button[aria-label=\"Enviar comando\"], button[aria-label=\"भेजें\"], button[aria-label=\"संदेश भेजें\"], button[aria-label=\"प्रॉम्प्ट भेजें\"]";
  const STOP = "button.stop-button, button[aria-label=\"回答を停止\"], button[aria-label=\"応答を停止\"], button[aria-label=\"生成を停止\"], button[aria-label=\"Stop response\"], button[aria-label=\"Stop generating\"], button[aria-label=\"Arrêter la réponse\"], button[aria-label=\"Arrêter la génération\"], button[aria-label=\"Generierung beenden\"], button[aria-label=\"Antwort stoppen\"], button[aria-label=\"Generierung stoppen\"], button[aria-label=\"Detener respuesta\"], button[aria-label=\"Detener generación\"], button[aria-label=\"Interrompi risposta\"], button[aria-label=\"Interrompi generazione\"], button[aria-label=\"Hentikan respons\"], button[aria-label=\"Hentikan jawaban\"], button[aria-label=\"Hentikan pembuatan\"], button[aria-label=\"Parar resposta\"], button[aria-label=\"Interromper resposta\"], button[aria-label=\"Parar de gerar\"], button[aria-label=\"जवाब रोकें\"], button[aria-label=\"उत्तर रोकें\"], button[aria-label=\"जनरेट करना बंद करें\"]";
  const COPY = "copy-button button, button.copy-button, button[data-test-id=\"copy-button\"], button[aria-label=\"コピー\"], button[aria-label=\"Copy\"], button[aria-label=\"Copy response\"], button[aria-label=\"Copier\"], button[aria-label=\"Copier la réponse\"], button[aria-label=\"Kopieren\"], button[aria-label=\"Antwort kopieren\"], button[aria-label=\"Copiar\"], button[aria-label=\"Copiar respuesta\"], button[aria-label=\"Copia\"], button[aria-label=\"Copia risposta\"], button[aria-label=\"Salin\"], button[aria-label=\"Salin respons\"], button[aria-label=\"Salin jawaban\"], button[aria-label=\"Copiar resposta\"], button[aria-label=\"कॉपी करें\"], button[aria-label=\"जवाब कॉपी करें\"], button[aria-label=\"उत्तर कॉपी करें\"]";
  const USER_MESSAGE = 'user-query';
  const ASSISTANT = 'model-response [id^="model-response-message-content"]';
  let busy = false;
  let job = null;
  let watchTimer = null;
  let refreshWatch = null;
  let watchObserver = null;
  const normalize = text => text.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").trim();
  const canonicalText = text => normalize(text).replace(/\s+/g, ' ');
  const visible = element => element?.isConnected && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
  // innerText adds extra newlines for empty <div><br></div> blocks.
  // Normalize browser edits and Quill paragraphs to the same plain text.
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

  const messageKey = element => element.closest('.conversation-container[id]')?.id || element.id || element;
  const userBodies = () => [...document.querySelectorAll(USER_MESSAGE)];
  function userText(element) {
    const lines = [...element.querySelectorAll('.query-text-line')];
    // Exclude duplicate accessibility headings and action buttons from the body.
    return lines.length ? lines.map(line => line.textContent.trim()).join('\n') : '';
  }
  // A receipt survives rich-text rendering and does not depend on recycled turn IDs.
  const matchesPrompt = (element, prompt, receipt) => receipt
    ? userText(element).includes(receipt)
    : canonicalText(userText(element)) === canonicalText(prompt);
  const assistantBodies = () => [...document.querySelectorAll(ASSISTANT)].filter(element =>
    !element.parentElement?.closest(ASSISTANT));
  const bodyText = element => (element.querySelector('.markdown') || element).innerText.trim();

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
    let missingSince = null;
    let relayReadySince=null;
    let imageReadySince = null, imageSignature = '';
    const homePath = value => /^\/(?:u\/\d+\/)?app\/?$/.test(value) || value === '/';
    const savedPath = value => /^\/(?:u\/\d+\/)?app\/[^/]+\/?$/.test(value);
    function check() {
      if (location.pathname !== path) {
        if (homePath(path) && savedPath(location.pathname)) path = location.pathname;
        else { endJob('error', 'Geminiの会話が切り替わりました。回答取得を中止しました。'); return; }
      }
      job.url = location.origin + location.pathname;
      const users = userBodies();
      if (!userMessage.isConnected || !matchesPrompt(userMessage, prompt, receipt)) {
        let same = users.find(element => messageKey(element) === userKey && matchesPrompt(element, prompt, receipt));
        // Both nodes and IDs can change when an optimistic message is confirmed.
        // Match order and preceding messages as well as text to avoid selecting an older duplicate.
        if (!same && users[expectedIndex] && matchesPrompt(users[expectedIndex], prompt, receipt)
          && previousUserTexts.every((text, index) => users[index] && canonicalText(userText(users[index])) === text)) {
          same = users[expectedIndex];
        }
        if (same) userMessage = same;
        else {
          missingSince ??= Date.now();
          if (Date.now() - missingSince > 10000) endJob('error', '送信した発言を再描画後に特定できませんでした。自動再送はしません。Gemini側を確認してください。');
          return;
        }
      }
      missingSince = null;
      userKey = messageKey(userMessage);
      if (users.some(element =>
        element !== userMessage && (userMessage.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING))) {
        endJob('error', 'Gemini側で別の発言が追加されました。回答を混同しないため取得を中止しました。'); return;
      }
      const currentTurn = userMessage.closest('.conversation-container');
      const replies = assistantBodies().filter(element =>
        !previousReplies.has(messageKey(element)) &&
        (!currentTurn || element.closest('.conversation-container') === currentTurn) &&
        (userMessage.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING));
      const reply = replies.at(-1);
      if (!silent && globalThis.RoundtableGeminiImages && globalThis.RoundtableGeneratedImages) {
        const imageState = RoundtableGeminiImages.inspect(userMessage);
        if (imageState.markers.length) { job.kind = 'image'; job.phase = 'generating_image'; }
        if (job.kind === 'image') {
          const model = reply?.closest('model-response');
          const copy = model?.querySelector(COPY);
          const completed = reply?.getAttribute('aria-busy') === 'false' && visible(copy) && !copy.disabled;
          const signature = imageState.images.map(img => `${img.currentSrc || img.src}:${img.naturalWidth}:${img.naturalHeight}`).join('|');
          if (signature !== imageSignature) { imageSignature = signature; imageReadySince = null; }
          if (reply) job.text = bodyText(reply);
          const failed = imageState.markers.some(node => [...node.querySelectorAll('[role="alert"], [data-error="true"]')].some(visible));
          if (failed) { endJob('error', 'Image generation failed. Check the official chat.'); return; }
          if (imageState.images.length && !imageState.loading && completed && !generating() && savedPath(path)) {
            imageReadySince ??= Date.now();
            if (Date.now() - imageReadySince >= 2000) {
              job.images = RoundtableGeneratedImages.capture(imageState.images);
              endJob('complete'); return;
            }
          } else imageReadySince = null;
          if (Date.now() - started > 20 * 60 * 1000) endJob('error', 'Image generation timed out. Check the official chat.');
          return;
        }
      }
      if(job.imageRelay) {
        const model=reply?.closest('model-response');
        const copy=model?.querySelector(COPY);
        const settled=reply?.getAttribute('aria-busy')==='false' && visible(copy) && !copy.disabled && savedPath(path);
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
          if(!silent)job.richText=globalThis.RoundtableRichText?.captureReply(reply,'gemini')||null;
        }
        if (text) job.phase = 'streaming';
        const model = reply.closest('model-response');
        const copy = model?.querySelector(COPY);
        const completed = reply.getAttribute('aria-busy') === 'false' && visible(copy) && !copy.disabled;
        // Require this response to expose a copy action and clear its busy state; stable text alone is insufficient.
        if ((text || silent) && completed && !generating() && Date.now() - lastChange >= 1200) {
          if(!silent)job.richText=globalThis.RoundtableRichText?.captureReply(reply,'gemini')||null;
          endJob('complete'); return;
        }
      }
      if (Date.now() - started > 180000) {
        endJob('error', '回答の完了を3分以内に確認できませんでした。途中の文章は表示しています。再送前にGemini側を確認してください。');
      }
    }
    const tick = () => {
      try { check(); }
      catch { endJob('error', '回答のDOM読み取りに失敗しました。Gemini側を確認してください。'); }
    };
    refreshWatch = tick;
    if (typeof MutationObserver !== 'undefined') {
      watchObserver = new MutationObserver(tick);
      watchObserver.observe(document.body, {subtree:true, childList:true, attributes:true, attributeFilter:['class','src','srcset','aria-busy']});
    }
    watchTimer = setInterval(tick, 300);
    tick();
  }

  async function send(text, requestId, foreground, silent, images = [], contextOnly = false, imageRelay = false) {
    if (busy) throw new Error("このGeminiタブで送信処理中です。");
    if (typeof text !== "string" || !text.trim() || text.length > 20000) throw new Error("入力が空か、20,000文字を超えています。");
    const receipt = silent && !contextOnly && !imageRelay ? null : `VSREQUEST${crypto.randomUUID().replace(/-/g, '')}END`;
    if (receipt) text = `${receipt}\nThis is a delivery identifier, not discussion content. Do not repeat it.\n\n${text}`;
    busy = true;
    job = { requestId, imageRelay, receipt, phase: 'sending', text: '', url: location.origin + location.pathname };
    let clicked = false;
    let watching = false;
    try {
      if (foreground && !await waitFor(() => !document.hidden, 5000)) throw new Error('Geminiのタブが表示されていません。Geminiを表示してから送信してください。文章はまだ送信していません。');
      if (generating()) throw new Error("Geminiが応答中です。完了してから送信してください。");
      const editor = await waitFor(findEditor, 5000);
      if (!editor) throw new Error("Geminiの入力欄が見つかりません。ログイン、通常のチャット画面、読み込み完了を確認してください。DOM変更の可能性もあります。");
      if (editor.disabled || editor.getAttribute("aria-disabled") === "true") throw new Error("Geminiの入力欄が無効です。");
      // Replace the existing draft when sending from the meeting.
      // Select all and insert instead of deleting DOM nodes, so Quill also updates its state.
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
        // Use browser editing to deliver input events to Quill.
        if (!document.execCommand("insertText", false, text)) throw new Error("ブラウザのテキスト挿入操作が失敗しました。");
      }
      if (normalize(read(editor)) !== normalize(text)) throw new Error("入力内容が一致しません。Geminiの下書きを確認してください。");
      if (images.length) {
        if (!globalThis.RoundtableImageUpload) throw new Error('画像連携スクリプトが未更新です。公式タブを再読み込みしてください。');
        await RoundtableImageUpload.attach('gemini', editor, images, requestId, findSend);
      }
      const button = await waitFor(() => {
        const candidate = findSend();
        return candidate && !candidate.disabled && candidate.getAttribute("aria-disabled") !== "true" ? candidate : null;
      }, 5000);
      if (!button) throw new Error("送信ボタンが見つからないか、無効です。入力内容はGemini側に残っています。DOM変更や利用制限を確認してください。");
      if (generating() || normalize(read(editor)) !== normalize(text)) throw new Error("送信前に画面が変わりました。Geminiの下書きを確認してください。");
      // Virtualized conversations may reuse existing DOM nodes for new messages.
      const previousMessages = new Set(userBodies().map(messageKey));
      const previousUserTexts = userBodies().map(element => canonicalText(userText(element)));
      const previousReplies = new Set(assistantBodies().map(messageKey));
      button.click();
      clicked = true;
      const confirmed = await waitFor(() => {
        return userBodies().find(element =>
          (receipt || !previousMessages.has(messageKey(element))) && matchesPrompt(element, text, receipt));
      }, 12000);
      if (!confirmed) throw new Error("送信ボタンを押しましたが、送信完了を確認できませんでした。自動再送はしません。Geminiの画面を確認してください。");
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
      return { ok: false, uncertain: clicked, error: error.message };
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
    const copy = reply.closest('model-response')?.querySelector(COPY);
    const completed = reply.getAttribute('aria-busy') === 'false' && visible(copy) && !copy.disabled;
    return { ok: true, recovered: !!completed, url: location.origin + location.pathname };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return;
    if(message?.type==='ROUNDTABLE_GEMINI_INSPECT'){
      if(!globalThis.VaultInspectorDOM){sendResponse({ok:false,error:'Reload the official AI tab to enable Inspector.'});return;}
      sendResponse({ok:true,report:VaultInspectorDOM.inspect('gemini',{editor:EDITORS,send:SEND,stop:STOP,user:USER_MESSAGE,reply:ASSISTANT,image:'img,canvas'},{phase:job?.phase,kind:job?.kind,busy,generating:generating()})});return;
    }
    if (message?.type === 'ROUNDTABLE_GEMINI_HELLO') {
      sendResponse({ ok: true, version: VERSION, ready: !!findEditor(), busy: busy || generating(), url: location.origin + location.pathname });
      return;
    }
    if (message?.type === 'ROUNDTABLE_GEMINI_RECOVER_ROLE') { sendResponse(recoverRole(message.text)); return; }
    if (message?.type === 'ROUNDTABLE_GEMINI_IMAGE_RESULT') {
      if (job?.requestId !== message.requestId || job.kind !== 'image' || job.phase !== 'complete') {
        sendResponse({ok:false,error:'The generated image is not ready.'}); return;
      }
      try {
        const users = userBodies();
        const user = users.findLast(element => matchesPrompt(element, '', job.receipt));
        if (!user || user !== users.at(-1)) throw Error('The image conversation has changed. Open the official chat.');
        const images = job.images || RoundtableGeneratedImages.capture(RoundtableGeminiImages.inspect(user).images);
        sendResponse({ok:true,images,text:job.text,url:job.url});
      } catch(error) { sendResponse({ok:false,error:error.message}); }
      return;
    }
    if (message?.type === 'ROUNDTABLE_GEMINI_STATUS') {
      if (job?.requestId === message.requestId) refreshWatch?.();
      const {images: cachedImages, ...state} = job || {};
      sendResponse(job?.requestId === message.requestId
        ? { ok: true, ...state, ...(job.imageRelay ? {text:'',richText:null} : {}) }
        : { ok: false, error: '回答の取得状態が見つかりません。Geminiを再読み込みした場合は取得が中断されます。' });
      return;
    }
    if (message?.type !== "ROUNDTABLE_GEMINI_SEND") return;
    send(message.text, message.requestId, message.foreground, message.silent === true, message.images, message.contextOnly === true, message.imageRelay === true).then(sendResponse, error => sendResponse({ ok: false, error: error.message }));
    return true;
  });
})();
