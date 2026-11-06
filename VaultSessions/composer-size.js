"use strict";
(() => {
  const input=document.querySelector('#message');
  const log=document.querySelector('#meeting-log');
  const maxLines=10;
  function resize(){
    if(!input.clientWidth)return;
    const atBottom=log&&log.scrollHeight-log.clientHeight-log.scrollTop<=4;
    const style=getComputedStyle(input);
    const lineHeight=parseFloat(style.lineHeight)||parseFloat(style.fontSize)*1.55;
    const padding=parseFloat(style.paddingTop)+parseFloat(style.paddingBottom);
    const border=parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth);
    const minimum=lineHeight*2+padding+border;
    const maximum=lineHeight*maxLines+padding+border;
    // Reset before measuring so deleting text also shrinks the composer.
    input.style.height='0px';
    const needed=input.scrollHeight+border;
    input.style.height=Math.ceil(Math.max(minimum,Math.min(needed,maximum)))+'px';
    input.style.overflowY=needed>maximum?'auto':'hidden';
    if(atBottom)log.scrollTop=log.scrollHeight;
  }
  globalThis.VaultComposerSize={resize};
  input.addEventListener('input',resize);
  let previousWidth=0;
  new ResizeObserver(entries=>{
    const width=entries[0].contentRect.width;
    if(width!==previousWidth){previousWidth=width;resize();}
  }).observe(input);
  window.addEventListener('resize',resize);
  document.fonts?.ready.then(resize);
  resize();
})();
