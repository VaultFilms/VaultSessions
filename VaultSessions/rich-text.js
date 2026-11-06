'use strict';
// Preserve semantic HTML as a bounded, inert tree. Never transport or insert raw HTML.
(function(root) {
  const HTML_NS = 'http://www.w3.org/1999/xhtml';
  const TAGS = new Set('p br div span h1 h2 h3 h4 h5 h6 ul ol li table caption thead tbody tfoot tr th td blockquote pre code strong em b i s del u sup sub hr dl dt dd mark kbd samp var'.split(' '));
  const DROP = new Set('script style noscript template iframe frame frameset object embed applet base link meta title form input button select option textarea datalist output audio video source track img picture canvas svg math'.split(' '));
  const MAX_NODES = 4000, MAX_DEPTH = 32, MAX_TEXT = 50000, MAX_BYTES = 200000;
  const records = new WeakMap();
  function safeURL(value, base) {
    if(typeof value !== 'string' || value.length > 4096)return null;
    try {const url = base ? new URL(value, base) : new URL(value);return ['https:', 'http:'].includes(url.protocol) ? url.href : null;}
    catch {return null;}
  }
  function integer(value, min, max) {
    if(value === null || value === undefined || value === '' || !/^-?\d+$/.test(String(value)))return null;
    const number = Number(value);return Number.isSafeInteger(number) && number >= min && number <= max ? number : null;
  }
  function attributes(tag, source, base) {
    const result = {};
    if(tag === 'a') {const href = safeURL(source.href, base);if(href)result.href = href;}
    if(tag === 'ol' || tag === 'li') {const key = tag === 'ol' ? 'start' : 'value', value = integer(source[key], -1000000, 1000000);if(value !== null)result[key] = value;}
    if(tag === 'th' || tag === 'td')for(const key of ['colspan', 'rowspan']) {const value = integer(source[key], 1, 100);if(value !== null)result[key] = value;}
    if(tag === 'th' && ['row', 'col', 'rowgroup', 'colgroup'].includes(source.scope))result.scope = source.scope;
    return result;
  }
  TAGS.add('a');
  function clean(value) {
    if(!value || value.version !== 1 || !Array.isArray(value.nodes))return null;
    let count = 0, length = 0, visible = false;
    function walk(nodes, depth) {
      if(depth > MAX_DEPTH)throw Error('Rich response is too deeply nested.');
      const result = [];
      for(const node of nodes) {
        if(++count > MAX_NODES)throw Error('Rich response has too many nodes.');
        if(typeof node === 'string') {
          length += node.length;if(length > MAX_TEXT)throw Error('Rich response exceeds the text limit.');
          if(node.trim())visible = true;
          if(node)result.push(node);continue;
        }
        if(!node || typeof node !== 'object' || typeof node.tag !== 'string' || !Array.isArray(node.children))throw Error('Invalid rich response node.');
        // Unknown tags from the message boundary are discarded, never passed to createElement.
        if(!TAGS.has(node.tag))continue;
        if(node.tag === 'hr')visible = true;
        result.push({tag:node.tag,...attributes(node.tag,node),children:walk(node.children, depth + 1)});
      }
      return result;
    }
    try {
      const result = {version:1,nodes:walk(value.nodes, 0)};
      return visible && result.nodes.length && JSON.stringify(result).length <= MAX_BYTES ? result : null;
    }catch {return null;}
  }
  function capture(elements) {
    let count = 0, length = 0;
    function children(node, depth) {return [...node.childNodes].flatMap(child => walk(child, depth));}
    function walk(node, depth) {
      if(++count > MAX_NODES || depth > MAX_DEPTH)throw Error('Rich response exceeds the capture limit.');
      if(node.nodeType === 3) {
        length += node.textContent.length;if(length > MAX_TEXT)throw Error('Rich response exceeds the text limit.');
        return node.textContent ? [node.textContent] : [];
      }
      if(node.nodeType !== 1)return [];
      const tag = node.localName.toLowerCase();
      if(node.hidden || node.getAttribute('aria-hidden') === 'true')return [];
      // Preserve formulas as inert text when their original MathML cannot be imported.
      if(tag === 'math') {
        const formula = node.querySelector('annotation[encoding="application/x-tex"]')?.textContent || node.textContent;
        length += formula.length;if(length > MAX_TEXT)throw Error('Rich response exceeds the text limit.');
        return formula ? [{tag:'code',children:[formula]}] : [];
      }
      if(node.namespaceURI !== HTML_NS || DROP.has(tag))return [];
      if(node.matches('.sr-only, .visually-hidden'))return [];
      const style = node.ownerDocument.defaultView?.getComputedStyle(node);
      if(style?.display === 'none' || style?.visibility === 'hidden')return [];
      if(!TAGS.has(tag))return children(node, depth + 1);
      // Provider code panels may wrap toolbar labels inside pre. Keep only their actual code.
      const code = tag === 'pre' ? node.querySelector('code') : null;
      const body = code ? walk(code, depth + 1) : children(node, depth + 1);
      const attrs = Object.fromEntries(['href','start','value','colspan','rowspan','scope'].map(key => [key,node.getAttribute(key)]));
      return [{tag,...attributes(tag,attrs,node.baseURI),children:body}];
    }
    try {return clean({version:1,nodes:elements.flatMap(element => children(element, 0))});}
    catch {return null;}
  }
  function captureReply(element, provider) {
    if(!element)return null;
    if(provider === 'claude') {
      const bodies = [...element.querySelectorAll('[data-perf-reply-text]')].filter(body => !body.parentElement?.closest('[data-perf-reply-text]'));
      return capture(bodies.length ? bodies : [element]);
    }
    return capture([element.querySelector('.markdown') || element]);
  }
  function stripPrefix(value, prefix) {
    const tree = clean(value);if(!tree)return null;
    const text = nodes => nodes.map(node => typeof node === 'string' ? node : text(node.children)).join('');
    const full = text(tree.nodes), offset = full.indexOf(prefix);
    if(offset < 0 || full.slice(0, offset).trim())return null;
    let remaining = offset + prefix.length;
    remaining += /^\s*/.exec(full.slice(remaining))[0].length;
    function trim(nodes) {
      return nodes.flatMap(node => {
        if(typeof node === 'string') {const skip = Math.min(remaining,node.length);remaining -= skip;return node.slice(skip) ? [node.slice(skip)] : [];}
        const children = trim(node.children);
        return children.length || ['br','hr'].includes(node.tag) ? [{...node,children}] : [];
      });
    }
    return clean({version:1,nodes:trim(tree.nodes)});
  }
  function render(element, text, value) {
    const tree = clean(value), doc = element.ownerDocument;
    element.classList.toggle('rich-response', !!tree);
    if(!tree) {
      const links = root.RoundtableLinks || (typeof require === 'function' ? require('./linkify.js') : null);
      if(links)links.render(element,text);else element.textContent = text;
    }else {
      function build(node) {
        if(typeof node === 'string')return doc.createTextNode(node);
        const element = doc.createElement(node.tag);
        element.className = 'vs-rich-' + node.tag;
        for(const [key,value] of Object.entries(attributes(node.tag,node)))element.setAttribute(key,String(value));
        if(node.tag === 'a') {element.target = '_blank';element.rel = 'noopener noreferrer';}
        for(const child of node.children)element.append(build(child));
        if(node.tag === 'table') {
          const scroll = doc.createElement('div');scroll.className = 'vs-rich-table-scroll';scroll.tabIndex = 0;
          scroll.append(element);return scroll;
        }
        return element;
      }
      element.replaceChildren(...tree.nodes.map(build));
    }
    records.set(element,{text,richText:tree,nodes:[...element.childNodes]});
  }
  function read(element) {
    if(!element)return null;
    const record = records.get(element);
    if(!record || record.nodes.length !== element.childNodes.length || record.nodes.some((node,index) => node !== element.childNodes[index]))return null;
    return {text:record.text,...(record.richText ? {richText:clean(record.richText)} : {})};
  }
  const api = {capture,captureReply,clean,render,read,stripPrefix,safeURL,MAX_NODES,MAX_DEPTH,MAX_TEXT,MAX_BYTES};
  if(typeof module !== 'undefined' && module.exports)module.exports = api;else root.RoundtableRichText = api;
})(globalThis);
