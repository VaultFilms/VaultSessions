'use strict';
(() => {
  const button=document.querySelector('#toggle-participants-panel');
  const panel=document.querySelector('#participants-panel');
  const log=document.querySelector('#meeting-log');
  function show(visible){
    const bottom=log.scrollHeight-log.clientHeight-log.scrollTop<=4;
    const bounds=log.getBoundingClientRect();
    const anchor=[...log.querySelectorAll('.entry')].find(row=>row.getBoundingClientRect().bottom>bounds.top);
    const offset=anchor?anchor.getBoundingClientRect().top-bounds.top:0;
    panel.hidden=!visible;
    document.body.classList.toggle('panel-collapsed',!visible);
    button.setAttribute('aria-expanded',String(visible));
    const key=visible?'hideParticipantsPanel':'showParticipantsPanel';
    button.dataset.i18nAria=key;button.dataset.i18nTitle=key;
    button.setAttribute('aria-label',VaultI18n.t(key));button.title=VaultI18n.t(key);
    if(bottom)log.scrollTop=log.scrollHeight;
    else if(anchor)log.scrollTop+=anchor.getBoundingClientRect().top-log.getBoundingClientRect().top-offset;
  }
  button.addEventListener('click',()=>show(panel.hidden));
  // The existing settings action must reveal the panel before opening its details.
  document.querySelector('#settings-toggle').addEventListener('click',()=>show(true),true);
})();
