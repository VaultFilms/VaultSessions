'use strict';
(function (root) {
  function safeURL(text) {
    try { const url = new URL(text); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; }
    catch { return null; }
  }
  function tokens(text) {
    const result = [];
    const pattern = /\[([^\]\n]+)\]\((https?:\/\/[^\s<>]+)\)|https?:\/\/[^\s<>`"'。、「」『』！？）】\u3000]+/gi;
    let last = 0, match;
    while ((match = pattern.exec(text))) {
      let raw = match[0], label = match[1], address = match[2];
      if (!address) {
        raw = raw.replace(/[.,!?;:。、「」『』！？）】]+$/gu, '');
        while (raw.endsWith(')') && (raw.match(/\)/g) || []).length > (raw.match(/\(/g) || []).length) raw = raw.slice(0, -1);
        address = raw; label = raw;
      }
      const href = safeURL(address);
      if (!href) continue;
      if (match.index > last) result.push({ text: text.slice(last, match.index) });
      result.push({ text: label, href });
      last = match.index + raw.length;
      pattern.lastIndex = last;
    }
    if (last < text.length) result.push({ text: text.slice(last) });
    return result;
  }
  function render(element, text) {
    const doc = element.ownerDocument;
    const fragment = doc.createDocumentFragment();
    for (const token of tokens(text)) {
      if (!token.href) { fragment.append(doc.createTextNode(token.text)); continue; }
      const anchor = doc.createElement('a');
      anchor.textContent = token.text; anchor.href = token.href;
      anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
      fragment.append(anchor);
    }
    element.replaceChildren(fragment);
  }
  const api = { tokens, render };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RoundtableLinks = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
