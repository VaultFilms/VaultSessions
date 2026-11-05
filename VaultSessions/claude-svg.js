'use strict';
// SVG code blocks and SVG file cards are distinct from normal prose and UI icons.
(function(root) {
  const NS='http://www.w3.org/2000/svg';
  const TAGS=new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','defs','linearGradient','radialGradient','stop','clipPath','mask','pattern','title','desc']);
  const ATTRS=new Set(['id','viewBox','width','height','x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','d','points','transform','fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-dasharray','stroke-dashoffset','opacity','font-size','font-family','font-weight','text-anchor','dominant-baseline','dx','dy','offset','stop-color','stop-opacity','gradientUnits','gradientTransform','spreadMethod','clip-path','mask','patternUnits','patternTransform','preserveAspectRatio']);
  function extract(text) {
    const start=text.search(/<svg(?:\s|>)/i);if(start<0)return null;
    const end=text.indexOf('</svg>',start);return {source:end<0?null:text.slice(start,end+6)};
  }
  function inspect(reply) {
    if(!reply)return null;
    for(const node of reply.querySelectorAll('pre code, pre')){const svg=extract(node.textContent||'');if(svg)return {kind:'code',...svg};}
    for(const element of reply.querySelectorAll('[data-testid="file-card-open"]')){
      let parent=element;
      for(let depth=0;parent&&depth<5;depth++,parent=parent.parentElement){
        if(/\bSVG\b/i.test(parent.innerText||parent.textContent||''))return {kind:'file',element};
      }
    }
    return null;
  }
  function sanitize(source) {
    if(typeof source!=='string'||source.length>500000||/<!DOCTYPE|<!ENTITY/i.test(source))throw Error('Unsupported SVG document.');
    const parsed=new DOMParser().parseFromString(source,'image/svg+xml');
    if(parsed.querySelector('parsererror')||parsed.documentElement.localName!=='svg')throw Error('Incomplete SVG document.');
    let count=0;
    function copy(node,doc){
      if(++count>5000)throw Error('SVG is too complex.');
      if(node.nodeType===3)return doc.createTextNode(node.textContent);
      if(node.nodeType!==1||node.namespaceURI!==NS||!TAGS.has(node.localName))return null;
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
  const api={extract,inspect,sanitize,capture,captureFrame};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RoundtableClaudeSVG=api;
})(globalThis);
