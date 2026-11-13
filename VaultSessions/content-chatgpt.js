"use strict";

(() => {
  const VERSION = '0.9.12';
  let blockedDraft;
  // ProseMirror and the Japanese send label were verified in normal Chat UI on 2026-10-29.
  // English labels, #prompt-textarea, and data-testid are compatibility candidates not verified in that session.
  // Message bodies, IDs, and turn states were verified in the current UI; retain legacy fallbacks.
  const EDITORS = [
    '#prompt-textarea[contenteditable="true"]',
    '[data-composer-markdown][contenteditable="true"][role="textbox"]',
    'textarea#prompt-textarea',
    '[data-composer-body] [contenteditable="true"].ProseMirror[role="textbox"]',
    'form [contenteditable="true"].ProseMirror[role="textbox"]'
  ];
  const SEND = "button[data-testid=\"send-button\"], button[type=\"submit\"][aria-label=\"送信\"], button[type=\"submit\"][aria-label=\"Send\"], button[type=\"submit\"][aria-label=\"Send prompt\"], button[aria-label=\"Envoyer\"], button[aria-label=\"Envoyer le message\"], button[aria-label=\"Envoyer une invite\"], button[aria-label=\"Senden\"], button[aria-label=\"Nachricht senden\"], button[aria-label=\"Prompt senden\"], button[aria-label=\"Enviar\"], button[aria-label=\"Enviar mensaje\"], button[aria-label=\"Enviar indicación\"], button[aria-label=\"Invia\"], button[aria-label=\"Invia messaggio\"], button[aria-label=\"Invia prompt\"], button[aria-label=\"Kirim\"], button[aria-label=\"Kirim pesan\"], button[aria-label=\"Kirim perintah\"], button[aria-label=\"Enviar mensagem\"], button[aria-label=\"Enviar comando\"], button[aria-label=\"भेजें\"], button[aria-label=\"संदेश भेजें\"], button[aria-label=\"प्रॉम्प्ट भेजें\"]";
  const STOP = "button[data-testid=\"stop-button\"], button[aria-label=\"Stop generating\"], button[aria-label=\"Stop streaming\"], button[aria-label=\"生成を停止する\"], button[aria-label=\"停止\"], button[aria-label=\"Arrêter la réponse\"], button[aria-label=\"Arrêter la génération\"], button[aria-label=\"Generierung beenden\"], button[aria-label=\"Antwort stoppen\"], button[aria-label=\"Generierung stoppen\"], button[aria-label=\"Detener respuesta\"], button[aria-label=\"Detener generación\"], button[aria-label=\"Interrompi risposta\"], button[aria-label=\"Interrompi generazione\"], button[aria-label=\"Hentikan respons\"], button[aria-label=\"Hentikan jawaban\"], button[aria-label=\"Hentikan pembuatan\"], button[aria-label=\"Parar resposta\"], button[aria-label=\"Interromper resposta\"], button[aria-label=\"Parar de gerar\"], button[aria-label=\"जवाब रोकें\"], button[aria-label=\"उत्तर रोकें\"], button[aria-label=\"जनरेट करना बंद करें\"]";
  const USER_MESSAGE = '[data-user-message-bubble="true"], [data-message-author-role="user"]';
  const ASSISTANT = '[data-markdown-text-style="assistant-message"], [data-message-author-role="assistant"]';
  let busy = false;
  let job = null;
  let watchTimer = null;
  let refreshWatch = null;
  let watchObserver = null;
  const normalize = text => text.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").trim();
  // rich-text-user-turn splits paragraphs into elements, so textContent loses line breaks.
  // Keep editor matching strict; normalize whitespace only for submitted message DOM.
  const messageText = text => normalize(text).replace(/\s+/g, '');
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
  function draftText(editor) {
    if(editor instanceof HTMLTextAreaElement)return normalize(editor.value).replace(/[\u200b\ufeff]/g,'');
    const copy=editor.cloneNode(true);
    // Remove only explicit placeholder nodes; keep paragraphs that merely have a data-placeholder attribute.
    for(const node of copy.querySelectorAll('[data-slate-placeholder="true"], [contenteditable="false"][aria-hidden="true"], [data-placeholder="true"][contenteditable="false"]'))node.remove();
    return normalize(plainText(copy)).replace(/[\u200b\ufeff]/g,'').trim();
  }
  // Writing/Canvas documents also use ProseMirror; only chat-composer candidates are eligible.
  const findEditor = () => EDITORS.flatMap(selector => [...document.querySelectorAll(selector)])
    .find(element => visible(element) && !element.closest?.('.writing-block-editor'));
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

  const messageKey = element => element.closest('[data-chatgpt-selection-message-id]')?.getAttribute('data-chatgpt-selection-message-id')
    || element.closest('[data-chatgpt-search-message-ids]')?.getAttribute('data-chatgpt-search-message-ids')
    || element.closest('[data-message-id]')?.getAttribute('data-message-id') || element;
  const userBodies = () => [...document.querySelectorAll(USER_MESSAGE)].filter(element => !element.querySelector(USER_MESSAGE));
  function userText(element) {
    const body = element.querySelector('.rich-text-user-turn') || element.querySelector('.whitespace-pre-wrap') || element;
    // Show more/less labels are controls, not part of the submitted instructions.
    if (typeof body.cloneNode !== 'function') return body.textContent;
    const copy = body.cloneNode(true);
    for (const button of copy.querySelectorAll('button')) button.remove();
    return copy.textContent;
  }
  const expandedPrompts = new WeakSet();
  function matchesUserPrompt(element, expected) {
    const shown=messageText(userText(element));
    // Match normal turns by their leading random receipt, which survives Markdown rendering and collapsing.
    const receipt=expected.match(/^VSREQUEST[a-f0-9]{32}END/);
    if(receipt)return shown.startsWith(receipt[0]);
    if(shown===expected)return true;
    // The current UI truncates collapsed DOM at 10,240 characters. Expand before checking the full text.
    const expand=element.querySelector('button[aria-expanded="false"][data-markdown-copy="exclude"]');
    if(shown.length>=80&&expected.startsWith(shown)&&expand&&!expandedPrompts.has(expand)){
      expandedPrompts.add(expand);expand.click();
      return element.isConnected&&messageText(userText(element))===expected;
    }
    return false;
  }

  const assistantBodies = () => [...document.querySelectorAll(ASSISTANT)].filter(element =>
    !element.parentElement?.closest(ASSISTANT));
  const bodyText = element => (element.querySelector('.markdown') || element).innerText.trim();

  // Role instructions request silence. Even without a response body, require the turn to be
  // complete and the official UI to be ready for the next input.
  // Elapsed time or the absence of a stop button alone does not establish success.
  function silentRoleSettled(userMessage) {
    const turn = userMessage.closest('[data-talvt-turn-state]');
    const editor = findEditor();
    const idleAction = [...document.querySelectorAll("button[data-testid=\"voice-mode-button\"], button[aria-label=\"Start Voice\"], button[aria-label=\"音声会話を開始\"], button[aria-label=\"Start voice mode\"], button[aria-label=\"Start Voice Mode\"], button[aria-label=\"Start voice chat\"], button[aria-label=\"Démarrer le mode vocal\"], button[aria-label=\"Sprachmodus starten\"], button[aria-label=\"Iniciar modo de voz\"], button[aria-label=\"Avvia modalità vocale\"], button[aria-label=\"Mulai mode suara\"], button[aria-label=\"Iniciar modo de voz\"], button[aria-label=\"वॉइस मोड शुरू करें\"]")]
      .some(button => visible(button) && !button.disabled && button.getAttribute('aria-disabled') !== 'true');
    const state = turn?.getAttribute('data-talvt-turn-state');
    const scope = turn || userMessage.closest('article') || userMessage.parentElement;
    return (!state || state === 'complete') && !!editor
      && !editor.disabled && editor.getAttribute('aria-disabled') !== 'true'
      && !editor.closest('[aria-busy="true"]') && !normalize(read(editor))
      && ![...(scope?.querySelectorAll('[role="alert"], [data-testid="conversation-turn-error"], [data-error="true"]') || [])].some(visible)
      && idleAction && !generating();
  }

  function endJob(phase, error) {
    clearInterval(watchTimer);
    watchTimer = null;
    refreshWatch = null;
    watchObserver?.disconnect(); watchObserver = null;
    job.phase = phase;
    if (error) job.error = error;
    busy = false;
  }

  function watchReply(userMessage, previousReplies, previousUsers, prompt, silent) {
    let lastChange = Date.now();
    const started = Date.now();
    let path = location.pathname;
    let silentReadySince = null;
    let userKey = messageKey(userMessage), missingSince = null;
    const expectedText = messageText(prompt), expectedIndex = previousUsers.length;
    let imageReadySince = null;
    let relayReadySince=null;
    let imageSignature = '';
    let fallbackReadySince = null, fallbackText = '';
    const svgTracker = globalThis.RoundtableSVG?.createTracker({
      current:()=>job,
      complete:(task,images)=>{task.images=images;endJob('complete');},
      fail:(_task,error)=>endJob('error',error)
    });
    const pendingPath = value => /^\/c\/local-chatgpt(?::|%3a)[^/]+\/?$/i.test(value);
    const savedPath = value => /^\/c\/[^/]+\/?$/.test(value) && !pendingPath(value);
    function check() {
      // New conversations progress from / through /c/local-chatgpt%3A... to /c/<saved-id>.
      // Continue rejecting navigation between different saved conversations.
      if (location.pathname !== path) {
        if ((path === '/' && (pendingPath(location.pathname) || savedPath(location.pathname)))
          || (pendingPath(path) && savedPath(location.pathname))) path = location.pathname;
        else { endJob('error', 'ChatGPTの会話が切り替わりました。回答取得を中止しました。'); return; }
      }
      job.url = location.origin + location.pathname;
      const users = userBodies();
      if (!userMessage.isConnected || !matchesUserPrompt(userMessage, expectedText)) {
        let same = users.find(e => messageKey(e) === userKey && matchesUserPrompt(e, expectedText));
        if (!same && users[expectedIndex] && matchesUserPrompt(users[expectedIndex], expectedText)
          && previousUsers.every((text, index) => users[index] && messageText(userText(users[index])) === text)) same = users[expectedIndex];
        if (same) userMessage = same;
        else {
          missingSince ??= Date.now();
          if (Date.now() - missingSince > 10000) endJob('error', '送信した発言を再描画後に特定できませんでした。自動再送はしません。ChatGPT側を確認してください。');
          return;
        }
      }
      missingSince = null; userKey = messageKey(userMessage);
      if (users.some(element =>
        element !== userMessage && (userMessage.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING))) {
        endJob('error', 'ChatGPT側で別の発言が追加されました。回答を混同しないため取得を中止しました。'); return;
      }
      const replies = assistantBodies().filter(element =>
        !previousReplies.has(messageKey(element)) &&
        (userMessage.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING));
      const reply = replies.at(-1);
      const replyTurn = reply?.closest('[data-talvt-turn-state]');
      const replyComplete = !!reply && (replyTurn
        ? replyTurn.getAttribute('data-talvt-turn-state') === 'complete'
        : !!reply.closest('article, [data-testid^="conversation-turn-"]')?.querySelector('button[data-testid="copy-turn-action-button"]'));
      if (!silent && !job.imageRelay && svgTracker?.update(job,reply,replyComplete && !generating() && savedPath(path))) {
        job.text = bodyText(reply);
        return;
      }
      // Only native image-generation components after this receipt can detach a turn.
      // Plain text about images and earlier generated images must not trigger this path.
      if (!silent && globalThis.RoundtableGeneratedImages) {
        const markers = RoundtableGeneratedImages.after(userMessage);
        if (markers.length) {
          job.kind = 'image'; job.phase = 'generating_image';
          const images = RoundtableGeneratedImages.loadedImages(markers);
          const imageTurn = markers[0].closest('[data-talvt-turn-state]');
          const turnState = imageTurn?.getAttribute('data-talvt-turn-state');
          const failed = markers.some(node => [...node.querySelectorAll('[role="alert"], [data-error="true"]')].some(visible));
          if (failed) { endJob('error', 'Image generation failed. Check the official chat.'); return; }
          const signature = images.map(img => `${img.currentSrc || img.src}:${img.naturalWidth}:${img.naturalHeight}`).join('|');
          if (signature !== imageSignature) { imageSignature = signature; imageReadySince = null; }
          if (images.length && !generating() && (!turnState || turnState === 'complete') && savedPath(path)) {
            imageReadySince ??= Date.now();
            if (Date.now() - imageReadySince >= 2000) {
              job.images = RoundtableGeneratedImages.capture(images);
              endJob('complete'); return;
            }
          } else imageReadySince = null;
        }
        if (job.kind === 'image') {
          const images = RoundtableGeneratedImages.loadedImages(markers);
          const text = reply ? bodyText(reply) : '';
          if (!images.length && text && replyComplete && !generating() && savedPath(path) && silentRoleSettled(userMessage)) {
            if (text !== fallbackText) { fallbackText=text; fallbackReadySince=null; }
            fallbackReadySince ??= Date.now();
            if (Date.now() - fallbackReadySince >= 1500) {
              delete job.kind;
              job.imageFallback = true;
              job.text = text;
              job.richText = globalThis.RoundtableRichText?.captureReply(reply,'chatgpt') || null;
              endJob('complete');
              return;
            }
          } else fallbackReadySince = null;
          if (Date.now() - started > 20 * 60 * 1000) endJob('error', 'Image generation timed out. Check the official chat.');
          return;
        }
      }

      if(job.imageRelay) {
        const turn=reply?.closest('[data-talvt-turn-state]');
        const completed=reply && (turn ? turn.getAttribute('data-talvt-turn-state')==='complete' : !!reply.closest('article, [data-testid^="conversation-turn-"]')?.querySelector('button[data-testid="copy-turn-action-button"]'));
        const settled=(completed || (!reply && savedPath(path) && silentRoleSettled(userMessage))) && savedPath(path);
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
          if(!silent)job.richText=globalThis.RoundtableRichText?.captureReply(reply,'chatgpt')||null;
        }
        if (text) job.phase = 'streaming';
        const turn = reply.closest('[data-talvt-turn-state]');
        const legacyTurn = reply.closest('article, [data-testid^="conversation-turn-"]');
        const legacyComplete = !turn && legacyTurn?.querySelector("button[data-testid=\"copy-turn-action-button\"], button[aria-label=\"コピーする\"], button[aria-label=\"Copy\"], button[aria-label=\"Copier\"], button[aria-label=\"Copier la réponse\"], button[aria-label=\"Kopieren\"], button[aria-label=\"Antwort kopieren\"], button[aria-label=\"Copiar\"], button[aria-label=\"Copiar respuesta\"], button[aria-label=\"Copia\"], button[aria-label=\"Copia risposta\"], button[aria-label=\"Salin\"], button[aria-label=\"Salin respons\"], button[aria-label=\"Salin jawaban\"], button[aria-label=\"Copiar resposta\"], button[aria-label=\"कॉपी करें\"], button[aria-label=\"जवाब कॉपी करें\"], button[aria-label=\"उत्तर कॉपी करें\"]");
        const completed = turn ? turn.getAttribute('data-talvt-turn-state') === 'complete' : legacyComplete;
        // Wait for a saved URL even if the reply finishes first; otherwise the next turn uses a stale target.
        if ((text || silent) && completed && !pendingPath(path) && !generating() && Date.now() - lastChange >= 1000) {
          if(!silent)job.richText=globalThis.RoundtableRichText?.captureReply(reply,'chatgpt')||null;
          endJob('complete'); return;
        }
      }
      if (silent && !reply && savedPath(path) && silentRoleSettled(userMessage)) {
        silentReadySince ??= Date.now();
        if (Date.now() - silentReadySince >= 1000) {
          job.completion = 'role-delivered-without-reply';
          endJob('complete'); return;
        }
      } else silentReadySince = null;
      if (Date.now() - started > 180000) {
        endJob('error', '回答の完了を3分以内に確認できませんでした。途中の文章は表示しています。再送前にChatGPT側を確認してください。');
      }
    }
    const tick = () => {
      try { check(); }
      catch { endJob('error', '回答のDOM読み取りに失敗しました。ChatGPT側を確認してください。'); }
    };
    refreshWatch = tick;
    // DOM changes detect generation promptly; STATUS also checks when background timers are throttled.
    if (typeof MutationObserver !== 'undefined') {
      watchObserver = new MutationObserver(tick);
      watchObserver.observe(document.body, {subtree:true, childList:true, attributes:true, attributeFilter:['src','srcset','data-talvt-turn-state']});
    }
    watchTimer = setInterval(tick, 300);
    tick();
  }

  async function send(text, requestId, silent, images = [], contextOnly = false, imageRelay = false) {
    if (busy) throw Object.assign(new Error("このChatGPTタブで送信処理中です。"), { code: "PROVIDER_BUSY" });
    if (typeof text !== "string" || !text.trim() || text.length > 75000) throw Error("The outgoing message is empty or exceeds 75,000 characters.");
    // Keep role recovery compatible; add a one-time receipt only to normal messages.
    if(!silent||contextOnly||imageRelay)text='VSREQUEST'+crypto.randomUUID().replace(/-/g,'')+'END\nDelivery reference only; do not repeat it.\n\n'+text;
    if (text.length > 75000) throw Error("The outgoing message with its receipt exceeds 75,000 characters.");
    busy = true;
    job = { requestId, imageRelay, phase: 'sending', text: '', url: location.origin + location.pathname, receipt: silent && !imageRelay ? null : text.match(/^VSREQUEST[a-f0-9]{32}END/)?.[0] };
    let clicked = false;
    let watching = false;
    try {
      if (generating()) throw Object.assign(new Error("ChatGPTが応答中です。完了してから送信してください。"), { code: "PROVIDER_BUSY" });
      let editor = await waitFor(findEditor, 5000);
      if (!editor) throw new Error("ChatGPTの入力欄が見つかりません。ログイン、通常のChatモード、画面の読み込みを確認してください。DOM変更の可能性もあります。");
      // React may replace the editor during rendering. Reacquire it before reporting a draft.
      if (draftText(editor)) {
        await pause();
        editor = findEditor();
        if (!editor) throw new Error("ChatGPTの入力欄が再描画中です。もう一度実行してください。");
        if (draftText(editor)) {
          console.warn('[VaultSessions draft-check]', JSON.stringify({version:VERSION,requestId,at:new Date().toISOString(),tag:editor.tagName,connected:editor.isConnected,visible:visible(editor),rawLength:read(editor).length,draftLength:draftText(editor).length,placeholderNodes:editor.querySelectorAll('[data-placeholder], [data-slate-placeholder]').length,editors:EDITORS.flatMap(selector=>[...document.querySelectorAll(selector)]).length}));
          blockedDraft = { requestId, editor, text: read(editor), href: location.href };
          throw Object.assign(new Error("ChatGPTに下書きがあります。下書きを送信または削除してから実行してください。"), { code: "COMPOSER_DRAFT", draftToken: requestId });
        }
      }
      if (editor.disabled || editor.getAttribute("aria-disabled") === "true") throw new Error("ChatGPTの入力欄が無効です。");
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
      if (normalize(read(editor)) !== normalize(text)) throw new Error("入力内容が一致しません。ChatGPTの下書きを確認してください。");
      if (images.length) {
        if (!globalThis.RoundtableImageUpload) throw new Error('画像連携スクリプトが未更新です。公式タブを再読み込みしてください。');
        await RoundtableImageUpload.attach('chatgpt', editor, images, requestId, findSend);
      }
      const button = await waitFor(() => {
        const candidate = findSend();
        return candidate && !candidate.disabled && candidate.getAttribute("aria-disabled") !== "true" ? candidate : null;
      }, 5000);
      if (!button) throw new Error("送信ボタンが見つからないか、無効です。入力内容はChatGPT側に残っています。DOM変更や利用制限を確認してください。");
      if (generating() || normalize(read(editor)) !== normalize(text)) throw new Error("送信前に画面が変わりました。ChatGPTの下書きを確認してください。");
      // Virtualized conversations may reuse existing DOM nodes for new messages.
      const previousMessages = new Set(userBodies().map(messageKey));
      const previousUsers = userBodies().map(element => messageText(userText(element)));
      const previousReplies = new Set(assistantBodies().map(messageKey));
      button.click();
      clicked = true;
      const confirmed = await waitFor(() => {
        return userBodies().find(element =>
          !previousMessages.has(messageKey(element)) && matchesUserPrompt(element, messageText(text)));
      }, 12000);
      if (!confirmed) {
        console.warn('[VaultSessions delivery-check]', JSON.stringify({version:VERSION,requestId,expectedLength:text.length,userCount:userBodies().length,newUserCount:userBodies().filter(e=>!previousMessages.has(messageKey(e))).length,generating:generating()}));
        throw new Error("送信ボタンを押しましたが、送信完了を確認できませんでした。自動再送はしません。ChatGPTの画面を確認してください。");
      }
      if(contextOnly){
        job.phase='complete';job.text='';job.url=location.origin+location.pathname;
        return {ok:true,requestId,url:job.url,contextDelivered:true};
      }
      job.phase = 'waiting';
      watching = true;
      watchReply(confirmed, previousReplies, previousUsers, text, silent);
      return { ok: true, requestId, url: job.url };
    } catch (error) {
      job.phase = 'error';
      job.error = error.message;
      return { ok: false, uncertain: clicked, error: error.message, draftToken: error.draftToken, ...(error.code ? { code: error.code } : {}) };
    } finally {
      if (!watching) busy = false;
    }
  }

  async function recoverRole(text) {
    if (typeof text !== 'string' || !text.startsWith('You are participating in a group discussion\n') || text.length > 20000) return { ok: false, error: 'Role復旧の指示が不正です。' };
    if (busy || generating()) return { ok: true, recovered: false };
    const users = userBodies();
    const expected = messageText(text);
    // Recover full text before comparison: saved roles can be collapsed by the official UI.
    // A prefix alone is never enough to adopt a role (the meeting language may differ).
    let index = -1;
    for (let i = users.length - 1; i >= 0; i--) {
      const user = users[i];
      if (messageText(userText(user)) === expected) { index = i; break; }
      const shown = messageText(userText(user)).replace(/(?:\.\.\.|…)$/, '');
      if (shown.length < 80 || !expected.startsWith(shown)) continue;
      const expand = user.querySelector('button[aria-expanded="false"]');
      if (!expand || !visible(expand)) continue;
      expand.click();
      if (await waitFor(() => user.isConnected && messageText(userText(user)) === expected, 1500)) { index = i; break; }
    }
    if (index < 0) return { ok: true, recovered: false };
    const user = users[index], next = users[index + 1];
    const reply = assistantBodies().filter(element =>
      (user.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
      && (!next || (element.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING))).at(-1);
    if (!reply) return { ok: true, recovered: silentRoleSettled(user), url: location.origin + location.pathname };

    const turn = reply.closest('[data-talvt-turn-state]');
    const legacy = reply.closest('article, [data-testid^="conversation-turn-"]');
    const completed = turn ? turn.getAttribute('data-talvt-turn-state') === 'complete'
      : !!legacy?.querySelector("button[data-testid=\"copy-turn-action-button\"], button[aria-label=\"コピーする\"], button[aria-label=\"Copy\"], button[aria-label=\"Copier\"], button[aria-label=\"Copier la réponse\"], button[aria-label=\"Kopieren\"], button[aria-label=\"Antwort kopieren\"], button[aria-label=\"Copiar\"], button[aria-label=\"Copiar respuesta\"], button[aria-label=\"Copia\"], button[aria-label=\"Copia risposta\"], button[aria-label=\"Salin\"], button[aria-label=\"Salin respons\"], button[aria-label=\"Salin jawaban\"], button[aria-label=\"Copiar resposta\"], button[aria-label=\"कॉपी करें\"], button[aria-label=\"जवाब कॉपी करें\"], button[aria-label=\"उत्तर कॉपी करें\"]");
    return { ok: true, recovered: !!completed, url: location.origin + location.pathname };
  }

  function clearConfirmedDraft(token) {
    const draft = blockedDraft;
    const editor = findEditor();
    if (busy || generating() || !draft || job?.requestId !== token || draft.requestId !== token || draft.href !== location.href
        || !editor || editor !== draft.editor || editor.disabled || editor.getAttribute('aria-disabled') === 'true'
        || read(editor) !== draft.text) {
      throw Error('The ChatGPT draft or conversation changed. Check the official tab and try again.');
    }
    RoundtableImageUpload.checkDraft(editor);
    editor.focus();
    if (findEditor() !== editor || read(editor) !== draft.text || location.href !== draft.href) {
      throw Error('The ChatGPT draft changed. Check the official tab and try again.');
    }
    if (editor instanceof HTMLTextAreaElement) {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(editor, '');
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection.removeAllRanges();
      selection.addRange(range);
      if (!document.execCommand('delete', false)) throw Error('The ChatGPT draft could not be cleared.');
    }
    if (draftText(findEditor() || editor)) throw Error('The ChatGPT draft could not be cleared.');
    blockedDraft = null;
    return { ok: true };
  }

  const speech=globalThis.RoundtableSpeech?.create({provider:'chatgpt',getJob:()=>job,users:userBodies,replies:assistantBodies,userText,url:()=>location.origin+location.pathname});
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return;
    if (message?.type === 'ROUNDTABLE_CHATGPT_ABANDON_IMAGE') {
      if (job?.requestId === message.requestId && job.kind === 'image') {
        endJob('abandoned');
        job.abandoned = true;
        globalThis.RoundtableSVG?.releaseFrame(job);
        job.images = null;
      }
      sendResponse({ok:true});
      return;
    }
    if (message?.type === 'ROUNDTABLE_CHATGPT_CLEAR_DRAFT') {
      try { sendResponse(clearConfirmedDraft(message.draftToken)); }
      catch (error) { sendResponse({ok:false,error:error.message}); }
      return;
    }
    if(message?.type==='ROUNDTABLE_CHATGPT_INSPECT'){
      if(!globalThis.VaultInspectorDOM){sendResponse({ok:false,error:'Reload the official AI tab to enable Inspector.'});return;}
      sendResponse({ok:true,report:VaultInspectorDOM.inspect('chatgpt',{editor:EDITORS,send:SEND,stop:STOP,user:USER_MESSAGE,reply:ASSISTANT,image:'img,canvas'},{phase:job?.phase,kind:job?.kind,busy,generating:generating()})});return;
    }
    if(message?.type==='ROUNDTABLE_CHATGPT_SPEECH'){if(!speech){sendResponse({ok:false,state:'unsupported'});return;}speech.handle(message).then(sendResponse);return true;}
    if (message?.type === 'ROUNDTABLE_CHATGPT_HELLO') {
      sendResponse({ ok: true, version: VERSION, ready: !!findEditor(), busy: busy || generating(), url: location.origin + location.pathname });
      return;
    }
    if (message?.type === 'ROUNDTABLE_CHATGPT_RECOVER_ROLE') { recoverRole(message.text).then(sendResponse, error => sendResponse({ok:false,error:error.message})); return true; }
    if (message?.type === 'ROUNDTABLE_CHATGPT_IMAGE_RESULT') {
      if (job?.requestId !== message.requestId || job.kind !== 'image' || job.phase !== 'complete') {
        sendResponse({ok:false,error:'The generated image is not ready.'}); return;
      }
      try {
        const users = userBodies();
        const user = users.findLast(element => messageText(userText(element)).startsWith(job.receipt));
        if (!user || user !== users.at(-1)) throw Error('The image conversation has changed. Open the official chat.');
        if (job.svgFrame) {
          const reply=assistantBodies().filter(element=>user.compareDocumentPosition(element)&Node.DOCUMENT_POSITION_FOLLOWING).at(-1);
          sendResponse(RoundtableSVG.collectFrame(job,reply,message.framesReady===true));
          return;
        }
        const images = job.images || RoundtableGeneratedImages.capture(RoundtableGeneratedImages.loadedImages(RoundtableGeneratedImages.after(user)));
        sendResponse({ok:true,images,text:job.text,url:job.url});
      } catch(error) { sendResponse({ok:false,error:error.message}); }
      return;
    }
    if (message?.type === 'ROUNDTABLE_CHATGPT_STATUS') {
      if (job?.requestId === message.requestId) refreshWatch?.();
      const {images: cachedImages, ...state} = job || {};
      sendResponse(job?.requestId === message.requestId
        ? { ok: true, ...state, ...(job.imageRelay ? {text:'',richText:null} : {}) }
        : { ok: false, error: '回答の取得状態が見つかりません。ChatGPTを再読み込みした場合は取得が中断されます。' });
      return;
    }
    if (message?.type !== "ROUNDTABLE_CHATGPT_SEND") return;
    send(message.text, message.requestId, message.silent === true, message.images, message.contextOnly === true, message.imageRelay === true).then(sendResponse, error => sendResponse({ ok: false, error: error.message, code: error.code }));
    return true;
  });
})();
