'use strict';
// Extract SVG from the current answer, including supported visualization frames.
(function(root) {
  const NS='http://www.w3.org/2000/svg';
  const TAGS=new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','defs','linearGradient','radialGradient','stop','clipPath','mask','pattern','title','desc']);
  const ATTRS=new Set(['id','viewBox','width','height','x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','d','points','transform','fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-dasharray','stroke-dashoffset','opacity','font-size','font-family','font-weight','text-anchor','dominant-baseline','dx','dy','offset','stop-color','stop-opacity','gradientUnits','gradientTransform','spreadMethod','clip-path','mask','patternUnits','patternTransform','preserveAspectRatio']);
  function extract(text) {
    const start=text.search(/<svg(?:\s|>)/i);if(start<0)return null;
    const close = /<\/svg\s*>/ig;
    close.lastIndex = start;
    const end = close.exec(text);
    const selfClosing = /^<svg\b[^>]*\/\s*>/i.exec(text.slice(start));
    return {source:end ? text.slice(start,close.lastIndex) : selfClosing?.[0] || null};
  }
  function inspectCode(reply) {
    if (!reply) return null;
    for (const node of reply.querySelectorAll('pre code, pre, code')) {
      const svg = extract(node.textContent || '');
      if (svg) return {kind:'code',...svg};
    }
    return null;
  }
  function inspectText(reply) {
    if (!reply) return null;
    for (const node of [...reply.querySelectorAll('p, [data-perf-reply-text]'),reply]) {
      const copy = node.cloneNode(true);
      copy.querySelectorAll('button, [aria-hidden="true"]').forEach(element=>element.remove());
      const svg = extract(copy.textContent || '');
      if (svg?.source) return {kind:'code',source:svg.source};
    }
    return null;
  }
  function inspectInline(reply) {
    if (!reply) return null;
    for (const svg of reply.querySelectorAll('svg')) {
      if (svg.closest('button, [role="button"]') || svg.parentElement?.closest('svg')) continue;
      const box=svg.getBoundingClientRect();
      const view=(svg.getAttribute('viewBox')||'').split(/[ ,]+/).map(Number);
      if (box.width < 65 || box.height < 65) continue;
      if (!(view[2] > 64 || parseFloat(svg.getAttribute('width')) > 64)) continue;
      return {kind:'code',source:new XMLSerializer().serializeToString(svg)};
    }
    return null;
  }
  function inspectFrame(reply) {
    if (!reply) return null;
    const frames=[...reply.querySelectorAll('iframe[title^="visualize:"], svg-code-block [data-test-id="genui-sandbox-container"] iframe[title="Model Generated UI Container"][srcdoc]')];
    for (const frame of frames.reverse()) {
      try {
        if (location.origin==='https://gemini.google.com' && frame.title==='Model Generated UI Container'
            && frame.hasAttribute('srcdoc') && frame.closest('svg-code-block') && frame.closest('[data-test-id="genui-sandbox-container"]')) {
          return {kind:'frame',source:'gemini-genui|'+frame.title,frame,origin:'null'};
        }
        const target=new URL(frame.src);
        if (target.protocol==='https:' && /^[a-z0-9-]+\.claudemcpcontent\.com$/i.test(target.hostname)
            && target.pathname==='/mcp_apps') return {kind:'frame',source:frame.src+'|'+frame.title,frame};
      } catch { /* Ignore unrelated or incomplete embedded frames. */ }
    }
    return null;
  }
  function inspectDownload(reply) {
    if (!reply) return null;
    for (const image of reply.querySelectorAll('img[src^="data:image/svg+xml"]')) {
      const source=image.currentSrc || image.getAttribute('src');
      if (/^data:image\/svg\+xml[;,]/i.test(source)) return {kind:'download',source};
    }
    for (const link of reply.querySelectorAll('a[download], a[href]')) {
      const name = link.getAttribute('download') || link.textContent?.trim() || '';
      const href = link.getAttribute('href') || '';
      if (!/\.svg(?:[?#]|$)/i.test(href) && !/\.svg$/i.test(name) && !/^data:image\/svg\+xml[;,]/i.test(href)) continue;
      try {
        const target = new URL(href,link.baseURI);
        if (target.username || target.password) continue;
        const local = target.origin === location.origin && ['https:','blob:'].includes(target.protocol);
        if (!local && !/^data:image\/svg\+xml[;,]/i.test(target.href)) continue;
        return {kind:'download',source:target.href};
      } catch { /* A non-URL file card is handled by the provider-specific preview path. */ }
    }
    return null;
  }
  async function captureDownload(url) {
    const response = await fetch(url,{credentials:'same-origin',redirect:'error',signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw Error('Unable to read the SVG attachment.');
    if (Number(response.headers.get('content-length')) > 500000) throw Error('The SVG attachment is too large.');
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const {done,value} = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 500000) throw Error('The SVG attachment is too large.');
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    return capture(await new Blob(chunks).text());
  }
  function inspect(reply) {
    const code = inspectCode(reply);
    if (code) return code;
    if (!reply) return null;
    for(const element of reply.querySelectorAll('[data-testid="file-card-open"]')){
      let parent=element;
      for(let depth=0;parent&&depth<5;depth++,parent=parent.parentElement){
        if(/\bSVG\b/i.test(parent.innerText||parent.textContent||''))return {kind:'file',element};
      }
    }
    return null;
  }

  const frameJobs = new WeakMap();
  const inspectVisual = reply => inspectCode(reply) || inspectText(reply) || inspectInline(reply) || inspectDownload(reply) || inspectFrame(reply);

  function releaseFrame(job) {
    const state=frameJobs.get(job);
    state?.cleanup?.();
    frameJobs.delete(job);
  }

  function collectFrame(job,reply,framesReady=false) {
    const state=frameJobs.get(job);
    const current=inspectFrame(reply);
    if (!state || !current || current.frame!==state.frame || current.source!==state.source || job.abandoned) {
      return {ok:false,error:'The visualization or conversation changed.'};
    }
    if (state.images) return {ok:true,images:state.images,text:job.text,url:job.url};
    if (state.error) return {ok:false,error:state.error};
    if (!framesReady && !state.started) return {ok:true,needsFrame:true,visualizer:true};
    if (state.started) return {ok:true,pending:true};
    state.started=true;
    const token=crypto.randomUUID();
    const origin=state.origin || new URL(state.frame.src).origin;
    let timeout;
    const cleanup=()=>{window.removeEventListener('message',receive);clearTimeout(timeout);};
    state.cleanup=cleanup;
    const receive=event=>{
      if (event.source!==state.frame.contentWindow || event.origin!==origin
          || event.data?.channel!=='vaultsessions-svg-frame-result' || event.data.token!==token) return;
      const sources=event.data.sources;
      if (!Array.isArray(sources) || !sources.length || sources.length>4
          || sources.some(source=>typeof source!=='string'||source.length>500000)) {
        state.error='The visualization contains no readable SVG.';
        cleanup();
        return;
      }
      cleanup();
      Promise.all(sources.map(capture)).then(images=>{
        const latest=inspectFrame(reply);
        if (!job.abandoned && latest?.frame===state.frame && latest.source===state.source) {
          state.images=images.flat().slice(0,4);
          job.images=state.images;
        }
      },error=>{state.error=error.message;});
    };
    window.addEventListener('message',receive);
    timeout=setTimeout(()=>{cleanup();state.error='SVG visualization retrieval timed out.';},12000);
    state.frame.contentWindow.postMessage({channel:'vaultsessions-svg-frame-request',token},origin==='null'?'*':origin);
    return {ok:true,pending:true};
  }

  // This function is injected into visualization frames by the extension service worker.
  // It only serializes SVG markup. The meeting tab sanitizes and rasterizes the result.
  function installFrameResponder() {
    const allowed=origin=>origin==='https://gemini.google.com'||/^https:\/\/[a-z0-9-]+\.claudemcpcontent\.com$/i.test(origin);
    const ownAllowed=allowed(location.origin)&&location.pathname==='/mcp_apps';
    const nestedAllowed=['about:','blob:'].includes(location.protocol)&&[...location.ancestorOrigins].some(allowed);
    if (!ownAllowed&&!nestedAllowed || globalThis.__vaultSvgFrameResponder) return;
    globalThis.__vaultSvgFrameResponder=true;
    window.addEventListener('message',event=>{
      const request=event.data;
      if (event.source!==parent || request?.channel!=='vaultsessions-svg-frame-request'
          || typeof request.token!=='string' || !/^[a-zA-Z0-9-]{1,80}$/.test(request.token)) return;
      const sources=[];
      const deadline=Date.now()+8000;
      const children=[...document.querySelectorAll('iframe')].map(frame=>frame.contentWindow).filter(Boolean);
      let done=false;
      function scan(doc,depth=0) {
        if (depth>3) return;
        for (const svg of [...doc.querySelectorAll('svg')].slice(0,100)) {
          if (sources.length>=4 || svg.closest('button,[role="button"]') || svg.parentElement?.closest('svg')) continue;
          const box=svg.getBoundingClientRect();
          if (box.width<65||box.height<65) continue;
          const text=new XMLSerializer().serializeToString(svg);
          if (text.length<=500000&&!sources.includes(text)) sources.push(text);
        }
        for (const frame of doc.querySelectorAll('iframe')) {
          try { if (frame.contentDocument) scan(frame.contentDocument,depth+1); } catch {}
        }
      }
      const finish=()=>{
        if(done)return;
        done=true;
        clearInterval(timer);
        window.removeEventListener('message',childResult);
        event.source.postMessage({channel:'vaultsessions-svg-frame-result',token:request.token,sources},event.origin==='null'?'*':event.origin);
      };
      const childResult=response=>{
        if (!children.includes(response.source) || response.data?.channel!=='vaultsessions-svg-frame-result'
            || response.data.token!==request.token || !Array.isArray(response.data.sources)) return;
        for(const source of response.data.sources)if(typeof source==='string'&&source.length<=500000&&sources.length<4)sources.push(source);
        if(sources.length)finish();
      };
      window.addEventListener('message',childResult);
      for(const child of children)child.postMessage(request,'*');
      const timer=setInterval(()=>{scan(document);if(sources.length||Date.now()>=deadline)finish();},150);
    });
  }

  // A tracker belongs to one submitted turn; it never reads icons or earlier messages.
  function createTracker({current,complete,fail,now=Date.now,render=capture}) {
    let source,changedAt=now(),capturing=false,failedSource;
    return {
      update(job,reply,settled) {
        const svg = inspectVisual(reply);
        if (!svg) return false;
        job.kind = 'image';
        job.phase = 'generating_image';
        if (source !== svg.source) { source = svg.source; changedAt = now(); failedSource = undefined; }
        if (!svg.source || !settled || capturing || failedSource === source || now() - changedAt < 1200) return true;
        if (svg.kind==='frame') {
          frameJobs.set(job,{frame:svg.frame,source:svg.source,origin:svg.origin});
          job.svgFrame=true;
          complete(job,null);
          return true;
        }
        const snapshot = source;
        capturing = true;
        Promise.resolve().then(() => svg.kind === 'download' ? captureDownload(snapshot) : render(snapshot)).then(images => {
          if (current() === job && !job.abandoned && source === snapshot
              && inspectVisual(reply)?.source === snapshot) complete(job,images);
        },error => {
          failedSource = snapshot;
          if (current() === job && !job.abandoned) fail(job,error.message);
        }).finally(() => { capturing=false; });
        return true;
      }
    };
  }
  function sanitize(source) {
    if(typeof source!=='string'||source.length>500000||/<!DOCTYPE|<!ENTITY/i.test(source))throw Error('Unsupported SVG document.');
    const parsed=new DOMParser().parseFromString(source,'image/svg+xml');
    if(parsed.querySelector('parsererror')||parsed.documentElement.localName!=='svg')throw Error('Incomplete SVG document.');
    let count=0;
    function copy(node,doc){
      if(++count>5000)throw Error('SVG is too complex.');
      if(node.nodeType===3)return doc.createTextNode(node.textContent);
      if(node.nodeType!==1||(node.namespaceURI&&node.namespaceURI!==NS)||!TAGS.has(node.localName))return null;
      const clean=doc.createElementNS(NS,node.localName);
      for(const attr of node.attributes){
        const value=attr.value;
        if(!ATTRS.has(attr.name)||attr.namespaceURI||/[\\]|(?:javascript|data|https?):|\/\//i.test(value))continue;
        if(/url\s*\(/i.test(value)&&!/^url\(\s*#[A-Za-z_][\w:.-]*\s*\)$/.test(value))continue;
        clean.setAttribute(attr.name,value);
      }
      for(const child of node.childNodes){const next=copy(child,doc);if(next)clean.append(next);}
      return clean;
    }
    const doc=document.implementation.createDocument(NS,'svg',null),svg=copy(parsed.documentElement,doc);
    const view=(svg.getAttribute('viewBox')||'').trim().split(/[ ,]+/).map(Number);
    let width=/%$/.test(svg.getAttribute('width')||'')?NaN:parseFloat(svg.getAttribute('width')),height=/%$/.test(svg.getAttribute('height')||'')?NaN:parseFloat(svg.getAttribute('height'));
    if(!(width>0))width=view.length===4&&view[2]>0?view[2]:800;
    if(!(height>0))height=view.length===4&&view[3]>0?view[3]:800;
    if(!Number.isFinite(width)||!Number.isFinite(height)||width>20000||height>20000)throw Error('Unsupported SVG dimensions.');
    const scale=Math.min(1,1600/Math.max(width,height));
    svg.setAttribute('width',Math.max(1,Math.round(width*scale)));svg.setAttribute('height',Math.max(1,Math.round(height*scale)));
    if(!svg.hasAttribute('viewBox'))svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    return new XMLSerializer().serializeToString(svg);
  }
  async function capture(source) {
    const safe=sanitize(source),url=URL.createObjectURL(new Blob([safe],{type:'image/svg+xml'}));
    try{
      const img=new Image();
      await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('SVG preview timed out.')),10000);img.onload=()=>{clearTimeout(timeout);resolve();};img.onerror=()=>{clearTimeout(timeout);reject(Error('Unable to render SVG preview.'));};img.src=url;});
      return RoundtableGeneratedImages.capture([img]);
    }finally{URL.revokeObjectURL(url);}
  }
  async function captureFrame(){
    if(location.origin!=='https://www.claudeusercontent.com'||new URL(location.href).searchParams.get('contentType')!=='image/svg+xml')return null;
    const candidates=[...document.querySelectorAll('svg')].filter(svg=>!svg.closest('button,[role="button"]')&&Math.max(parseFloat(svg.getAttribute('width'))||0,parseFloat(svg.getAttribute('height'))||0,...(svg.getAttribute('viewBox')||'').split(/[ ,]+/).slice(2).map(Number))>64);
    if(candidates.length!==1)return null;
    return capture(new XMLSerializer().serializeToString(candidates[0]));
  }
  // Register in matched visualization frames and their about:blank/srcdoc children.
  if (typeof window!=='undefined' && window!==window.top) installFrameResponder();
  const api={extract,inspect,inspectCode,inspectText,inspectInline,inspectFrame,inspectDownload,collectFrame,releaseFrame,installFrameResponder,createTracker,sanitize,capture,captureFrame};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else { root.RoundtableClaudeSVG=api; root.RoundtableSVG=api; }
})(globalThis);
