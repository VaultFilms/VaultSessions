"use strict";
(() => {
  const select = document.querySelector('#meeting-mode');
  const tools = document.querySelector('#dev-tools');
  const heading = document.querySelector('.meeting-heading h2');
  const settingsLabel = document.querySelector('#meeting-setup > summary [data-i18n="meetingSettings"]');
  const badge = document.createElement('span');
  badge.className = 'settings-mode-badge'; badge.textContent = 'Dev'; badge.hidden = true;
  settingsLabel.after(badge);
  function render() {
    const dev = select.value === 'dev';
    document.body.classList.toggle('dev-mode', dev);
    tools.hidden = !dev; badge.hidden = !dev;
    for (const item of tools.querySelectorAll('[data-dev-only]')) item.hidden = !dev;
    heading.dataset.i18n = dev ? 'devMeetingTitle' : 'meetingTitle';
    heading.textContent = VaultI18n.t(heading.dataset.i18n);
  }
  // Presentation only: modes share the existing meeting, participants and log.
  // Mock tool buttons deliberately have no action or AI-message side effects.
  select.addEventListener('change', render);
  window.addEventListener('vaultsessions-language', render);
  window.addEventListener('vaultsessions-restore-mode', render);
  render();
})();
