"use strict";

// Prevent keystrokes from reaching an official chat immediately after foregrounding; shared by all providers.
(() => {
  const VERSION = '0.7.6';
  // Longer than the complete send/attachment budget; renewed by response polling.
  const LEASE_MS = 120000;
  let requestId = null, banner = null, timer;
  function release() {
    clearTimeout(timer);
    requestId = null;
    banner?.remove(); banner = null;
  }
  function render(text) {
    if (banner) { banner.textContent=text; return; }
    banner = document.createElement('div');
    banner.setAttribute('role', 'status');
    banner.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:2147483647;max-width:calc(100vw - 32px);padding:10px;background:#fff4cf;color:#332800;border:1px solid #ab9440;border-radius:8px;font:13px/1.5 system-ui;box-shadow:0 2px 8px #0003';
    banner.textContent = text;
    document.documentElement.append(banner);
  }
  function block(event) {
    if (!requestId || !event.isTrusted) return;
    // Allow copying, tab switching, and scrolling without blocking automated execCommand/InputEvent insertion.
    if (event.type === 'keydown') {
      const editingShortcut = (event.ctrlKey || event.metaKey) && /^(x|v|z|y|Backspace|Delete|Enter)$/i.test(event.key);
      if (!editingShortcut && (event.ctrlKey || event.metaKey || event.altKey ||
        (!event.isComposing && event.key.length !== 1 && !['Enter', 'Backspace', 'Delete', 'Process', 'Unidentified'].includes(event.key)))) return;
    }
    event.preventDefault(); event.stopImmediatePropagation();
  }
  for (const type of ['keydown', 'beforeinput', 'paste', 'drop']) window.addEventListener(type, block, true);
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || message?.type !== 'ROUNDTABLE_INPUT_GUARD') return;
    if (typeof message.requestId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(message.requestId)) return;
    if (message.lock === true) {
      // A delayed poll must never replace a newer request's protection or revive an expired lease.
      if (message.renew === true && requestId !== message.requestId) {
        respond({ ok: true, guarded: false, version: VERSION });
        return;
      }
      clearTimeout(timer); requestId = message.requestId;
      if (message.renew !== true) render(typeof message.guardText==='string'&&message.guardText.trim()&&message.guardText.length<=500?message.guardText:'Meeting in progress: keyboard input is protected to prevent accidental typing.');
      // If the meeting disappears, no more polls arrive and protection expires automatically.
      timer = setTimeout(release, LEASE_MS);
    }
    else if (requestId === message.requestId) release();
    respond({ ok: true, guarded: requestId === message.requestId, version: VERSION });
  });
})();
