'use strict';
// Pass Files to provider inputs and verify previews, processing completion, and send readiness.
(() => {
  const visible = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const wait = async (check, ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { const result = check(); if (result) return result; await new Promise(r => setTimeout(r, 150)); }
    return null;
  };
  function scope(editor) {
    const known = editor.closest('input-container') || editor.closest('[data-composer-body], form, .text-input-field');
    if (known) return known;
    for (let p = editor.parentElement, i = 0; p && i < 12 && !['BODY', 'MAIN', 'HTML'].includes(p.tagName); p = p.parentElement, i++) {
      if (p.querySelector('input[type="file"]')) return p;
    }
    throw new Error('添付を確認する入力領域が見つかりません。公式タブを確認してください。');
  }
  const previewSelector = 'img[src^="blob:"],img[src^="data:image/"],[data-testid*="attachment"],[data-testid*="file-thumbnail"],file-preview,.file-preview-container';
  function checkDraft(editor) {
    const area = scope(editor);
    const removal = [...area.querySelectorAll('button')].some(b => visible(b) && /remove.*(file|image|attachment)|delete.*(file|image)|削除|取り除く/i.test(b.getAttribute('aria-label') || ''));
    if (removal || [...area.querySelectorAll(previewSelector)].some(visible)) throw new Error('公式チャットに未送信の添付があります。削除または送信してから実行してください。自動再送はしません。');
  }
  async function attach(provider, editor, images, requestId, findSend) {
    const files = RoundtableImages.validate(images);
    if (!files.length) return;
    const area = scope(editor);
    let input = [...document.querySelectorAll('input[type=file]')].find(x => !x.disabled && /image\//i.test(x.accept) && !x.capture && (files.length === 1 || x.multiple));
    if (!input && provider === 'gemini') {
      const menu = [...document.querySelectorAll('button')].find(x => visible(x) && /アップロードとツール|Upload.*tools|ファイルを追加|Add files|Importer.*outils|Ajouter des fichiers|Hochladen.*Tools|Dateien hinzufügen|Subir.*herramientas|Añadir archivos|Agregar archivos|Carica.*strumenti|Aggiungi file|Upload.*alat|Unggah.*alat|Tambahkan file|Enviar.*ferramentas|Adicionar arquivos|अपलोड.*टूल|फ़ाइलें जोड़ें/i.test(x.getAttribute('aria-label') || ''));
      if (menu) menu.click();
      input = await wait(() => [...document.querySelectorAll('input[type=file]')].find(x => !x.disabled && /image\//i.test(x.accept) && (files.length === 1 || x.multiple)), 3000);
    }
    if (!input && provider === 'claude') input = document.querySelector('input[data-testid="file-upload"],input#chat-input-file-upload-bottom');
    if (!input || input.disabled || (files.length > 1 && !input.multiple)) throw new Error('画像のファイル選択欄が見つかりません。添付メニュー・サイトの利用制限・DOM変更を確認してください。文章はまだ送信していません。');
    const before = new Set([...area.querySelectorAll('img')].map(x => x.getAttribute('src')));
    const transfer = new DataTransfer();
    const names = files.map((image, index) => {
      const name = RoundtableImages.uploadName(image, requestId, index, files.length);
      const data = atob(image.dataUrl.split(',')[1]);
      const bytes = Uint8Array.from(data, c => c.charCodeAt(0));
      transfer.items.add(new File([bytes], name, { type: image.type }));
      return name;
    });
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    let readySince = null;
    const ready = await wait(() => {
      if (!area.isConnected || !editor.isConnected) throw new Error('画像添付中に入力領域が切り替わりました。公式タブを確認してください。');
      const loaded = new Set([...area.querySelectorAll('img')].filter(x => visible(x) && !before.has(x.getAttribute('src')) && x.complete && x.naturalWidth > 0).map(x => x.getAttribute('src')));
      const preview = names.every(name => area.textContent.includes(name)) || loaded.size >= files.length;
      const pending = [...area.querySelectorAll('[role=progressbar],[aria-busy=true],mat-progress-spinner,mat-spinner')].some(visible);
      const error = [...area.querySelectorAll('[role=alert]')].find(x => visible(x) && /error|fail|limit|できません|失敗|制限|エラー/i.test(x.textContent));
      if (error) throw new Error('画像のアップロードでエラーが表示されました。公式タブを確認してください。自動再送はしません。');
      const send = findSend();
      if (!preview || pending || !send || send.disabled || send.getAttribute('aria-disabled') === 'true') { readySince = null; return false; }
      readySince ??= Date.now();
      return Date.now() - readySince >= 1000;
    }, 60000);
    if (!ready) throw new Error('すべての画像の添付完了を確認できませんでした。文章は送信していません。公式タブの添付状態を確認してください。自動再送はしません。');
  }
  globalThis.RoundtableImageUpload = { checkDraft, attach };
})();
