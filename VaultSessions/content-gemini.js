"use strict";

(() => {
  const VERSION = '0.8.3';
  // DOM verified on the signed-in Gemini website on 2026-10-29.
  const EDITORS = ['.ql-editor[contenteditable="true"][role="textbox"]'];
  const SEND = 'button[aria-label="プロンプトを送信"], button[aria-label="Send message"], button[aria-label="Send prompt"]';
  const STOP = 'button[aria-label="回答を停止"], button[aria-label="応答を停止"], button[aria-label="生成を停止"], button[aria-label="Stop response"], button[aria-label="Stop generating"]';
  const USER_MESSAGE = 'user-query';
  const ASSISTANT = 'model-response [id^="model-response-message-content"]';
  let busy = false;
  let job = null;
  let watchTimer = null;
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
  const assistantBodies = () => [...document.querySelectorAll(ASSISTANT)].filter(element =>
    !element.parentElement?.closest(ASSISTANT));
  const bodyText = element => (element.querySelector('.markdown') || element).innerText.trim();

  function endJob(phase, error) {
    clearInterval(watchTimer);
    watchTimer = null;
    job.phase = phase;
    if (error) job.error = error;
    busy = false;
  }

  function watchReply(userMessage, previousReplies, previousUserTexts, prompt, silent) {
    let lastChange = Date.now();
    const started = Date.now();
    let path = location.pathname;
    let userKey = messageKey(userMessage);
    const expectedIndex = previousUserTexts.length;
    const expectedText = canonicalText(prompt);
    let missingSince = null;
    const homePath = value => /^\/(?:u\/\d+\/)?app\/?$/.test(value) || value === '/';
    const savedPath = value => /^\/(?:u\/\d+\/)?app\/[^/]+\/?$/.test(value);
    function check() {
      if (location.pathname !== path) {
        if (homePath(path) && savedPath(location.pathname)) path = location.pathname;
        else { endJob('error', 'Geminiの会話が切り替わりました。回答取得を中止しました。'); return; }
      }
      job.url = location.origin + location.pathname;
      const users = userBodies();
      if (!userMessage.isConnected || canonicalText(userText(userMessage)) !== expectedText) {
        let same = users.find(element => messageKey(element) === userKey && canonicalText(userText(element)) === expectedText);
        // Both nodes and IDs can change when an optimistic message is confirmed.
        // Match order and preceding messages as well as text to avoid selecting an older duplicate.
        if (!same && users[expectedIndex] && canonicalText(userText(users[expectedIndex])) === expectedText
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
      if (reply) {
        const text = bodyText(reply);
        if (text !== job.text) { job.text = text; lastChange = Date.now(); }
        if (text) job.phase = 'streaming';
        const model = reply.closest('model-response');
        const copy = model?.querySelector('button[aria-label="コピー"], button[aria-label="Copy"], button[aria-label="Copy response"]');
        const completed = reply.getAttribute('aria-busy') === 'false' && visible(copy) && !copy.disabled;
        // Require this response to expose a copy action and clear its busy state; stable text alone is insufficient.
        if ((text || silent) && completed && !generating() && Date.now() - lastChange >= 1200) {
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
    watchTimer = setInterval(tick, 300);
    tick();
  }

  async function send(text, requestId, foreground, silent, images = []) {
    if (busy) throw new Error("このGeminiタブで送信処理中です。");
    if (typeof text !== "string" || !text.trim() || text.length > 20000) throw new Error("入力が空か、20,000文字を超えています。");
    busy = true;
    job = { requestId, phase: 'sending', text: '', url: location.origin + location.pathname };
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
          !previousMessages.has(messageKey(element)) && canonicalText(userText(element)) === canonicalText(text));
      }, 12000);
      if (!confirmed) throw new Error("送信ボタンを押しましたが、送信完了を確認できませんでした。自動再送はしません。Geminiの画面を確認してください。");
      job.phase = 'waiting';
      watching = true;
      watchReply(confirmed, previousReplies, previousUserTexts, text, silent);
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
    const copy = reply.closest('model-response')?.querySelector('button[aria-label="コピー"], button[aria-label="Copy"], button[aria-label="Copy response"]');
    const completed = reply.getAttribute('aria-busy') === 'false' && visible(copy) && !copy.disabled;
    return { ok: true, recovered: !!completed, url: location.origin + location.pathname };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return;
    if (message?.type === 'ROUNDTABLE_GEMINI_HELLO') {
      sendResponse({ ok: true, version: VERSION, ready: !!findEditor(), busy: busy || generating(), url: location.origin + location.pathname });
      return;
    }
    if (message?.type === 'ROUNDTABLE_GEMINI_RECOVER_ROLE') { sendResponse(recoverRole(message.text)); return; }
    if (message?.type === 'ROUNDTABLE_GEMINI_STATUS') {
      sendResponse(job?.requestId === message.requestId
        ? { ok: true, ...job }
        : { ok: false, error: '回答の取得状態が見つかりません。Geminiを再読み込みした場合は取得が中断されます。' });
      return;
    }
    if (message?.type !== "ROUNDTABLE_GEMINI_SEND") return;
    send(message.text, message.requestId, message.foreground, message.silent === true, message.images).then(sendResponse, error => sendResponse({ ok: false, error: error.message }));
    return true;
  });
})();
