'use strict';
(function (root) {
  const MAX_BYTES = 5 * 1024 * 1024;
  const MAX_COUNT = 4, MAX_TOTAL_BYTES = 10 * 1024 * 1024;
  const types = ['image/png', 'image/jpeg', 'image/webp'];
  function validate(images = []) {
    if (!Array.isArray(images) || images.length > MAX_COUNT) throw new Error('画像は最大4枚まで選択できます。');
    if (images.reduce((sum, image) => sum + (Number.isInteger(image?.size) && image.size > 0 ? image.size : 0), 0) > MAX_TOTAL_BYTES) throw new Error('画像の合計サイズは10MB以内にしてください。');
    return images.map(image => {
      if (!image || typeof image.name !== 'string' || image.name.length > 240 || !types.includes(image.type)
        || !Number.isInteger(image.size) || image.size < 1 || image.size > MAX_BYTES
        || typeof image.dataUrl !== 'string' || image.dataUrl.length > Math.ceil(MAX_BYTES / 3) * 4 + 64) {
        throw new Error('PNG・JPEG・WebPの画像を1枚あたり5MB以内で選択してください。');
      }
      const prefix = `data:${image.type};base64,`;
      if (!image.dataUrl.startsWith(prefix)) throw new Error('画像データの形式が不正です。');
      const body = image.dataUrl.slice(prefix.length);
      if ((body.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(body))
        || body.length / 4 * 3 - (body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0) !== image.size) throw new Error('画像データとサイズが一致しません。');
      return { name: image.name, type: image.type, size: image.size, dataUrl: image.dataUrl };
    });
  }
  function uploadName(image, requestId, index, count) {
    const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[image.type];
    return `roundtable-${requestId}${count > 1 ? '-' + (index + 1) : ''}.${extension}`;
  }
  function referencePrompt(images, requestId) {
    if (!images.length) return '';
    return '\nImage numbering from the meeting UI (use these numbers when referring to the images):\n' +
      images.map((image, index) => `Image ${index + 1} = attached file ${uploadName(image, requestId, index, images.length)}`).join('\n') +
      '\nRefer to Image 1, Image 2, etc. using the meeting language. Do not replace these numbers with filenames or renumber them. Numbering starts again for each new human message with attachments.\n';
  }
  const api = { uploadName, referencePrompt, MAX_BYTES, MAX_COUNT, MAX_TOTAL_BYTES, types, validate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RoundtableImages = api;
})(globalThis);
