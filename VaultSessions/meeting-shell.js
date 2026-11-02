'use strict';
(() => {
 const I=VaultI18n,localeSelect=document.querySelector('#ui-language'),setup=document.querySelector('#meeting-setup'),pill=document.querySelector('#meeting-state');
 const locales=I.locales;
 language.replaceChildren(...locales.map(item=>new Option(item.name,item.meetingLanguage)));
 localeSelect.replaceChildren(...locales.map(item=>new Option(item.shortName,item.code)));
 const lookup=name=>locales.find(item=>item.meetingLanguage===name);
 function refresh(){
  I.apply();I.refreshGenerated();localeSelect.value=I.locale;
  document.querySelector('#switch-view').textContent=I.t(isSidePanel?'fullscreen':'sidebar');
  document.querySelector('#switch-view').title=I.t('switchHint');
  for(const row of log.querySelectorAll('.entry')){const time=row.querySelector('time');if(time&&row.dataset.time)time.textContent=new Intl.DateTimeFormat(I.locale,{hour:'numeric',minute:'2-digit'}).format(Number(row.dataset.time));}
  if(location.protocol!=='chrome-extension:')reloadExtension.textContent=I.message('会議ページを再読み込み');
 }
 function selectMeetingLanguage(name,persist=false){const item=lookup(name);if(item){language.value=name;I.setLocale(item.code,{persist});}}
 language.value=language.dataset.restored||locales.find(item=>item.code===I.locale)?.meetingLanguage||'English';
 selectMeetingLanguage(language.value);
 language.addEventListener('change',()=>selectMeetingLanguage(language.value,true));
 localeSelect.addEventListener('change',()=>{language.value=locales.find(item=>item.code===localeSelect.value).meetingLanguage;language.dispatchEvent(new Event('change',{bubbles:true}));});
 window.addEventListener('vaultsessions-language',refresh);
 window.addEventListener('vaultsessions-restore-language',event=>selectMeetingLanguage(event.detail));
 const toggleSetup=()=>{setup.open=!setup.open;if(setup.open)setup.scrollIntoView({block:'nearest'});};
 document.querySelector('#settings-toggle').addEventListener('click',toggleSetup);
 document.querySelector('#compact-settings-toggle').addEventListener('click',toggleSetup);
 document.querySelector('#manage-participants').addEventListener('click',()=>{for(const card of Object.values(cards)){card.element.classList.add('is-expanded');card.element.querySelector('.provider-menu').setAttribute('aria-expanded','true');}document.querySelector('#invitations').scrollIntoView({block:'nearest'});});
 const sharingRow=document.querySelector('.sharing-row');sharingRow.before(document.querySelector('.compact-settings'));
 if(isSidePanel)setup.open=false;
 else {const sharing=document.querySelector('#auto-page-context');sharing.checked=false;sharing.title=I.t('shareUnavailable');}
 const previousEvent=controller.onEvent;
 controller.onEvent=event=>{
  previousEvent(event);
  if(['started','speaker','progress','repair'].includes(event.type)){pill.dataset.i18n='discussing';pill.dataset.state='sending';}
  if(event.type==='ended'){pill.dataset.i18n=event.reason==='stopped'?'stopped':'complete';pill.dataset.state='success';}
  if(event.type==='error'){pill.dataset.i18n='message_044';pill.dataset.state='error';}
  pill.textContent=I.t(pill.dataset.i18n||'ready');
  const compact=document.querySelector('#compact-meeting-state');compact.dataset.i18n=pill.dataset.i18n||'ready';compact.textContent=pill.textContent;
  document.querySelector('.meeting-stage').dataset.discussionState=pill.dataset.i18n||'ready';
 };
 // Mutation handling is limited to new UI labels, not human or AI response bodies.
 new MutationObserver(()=>{for(const card of Object.values(cards))card.element.dataset.connected=String(!!targets[Object.keys(cards).find(id=>cards[id]===card)]);}).observe(document.querySelector('#invitations'),{childList:true,subtree:true,characterData:true});
 refresh();
})();
