'use strict';
// Generated-image DOM markers are scoped to the current submitted turn, never the whole chat's images.
(function(root) {
  // Loading canvas and game-board markers verified during a VS-submitted generation on 2026-11-04.
  const MARKERS = '[data-testid="generated-image-preview"], [data-web-image-tile="true"], [data-testid="generated-image-gallery"], [data-testid="image-generation-loader"], [data-testid="image-generation-progress"], [data-testid="image-gen-loading-game-board"], [aria-busy="true"][aria-label="Generating image..."]:has(canvas)';
  const MAX_IMAGES = 4, MAX_DATA_LENGTH = 380000;
  function after(user, previous = new Set(), doc = document) {
    return [...doc.querySelectorAll(MARKERS)].filter(node => !previous.has(node) &&
      !!(user.compareDocumentPosition(node) & 4));
  }
  function loadedImages(markers) {
    const images = [...new Set(markers.flatMap(node => [...node.querySelectorAll('img')]))];
    return images.length && images.every(img => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) ? images.slice(0, MAX_IMAGES) : [];
  }
  function capture(images, doc = document) {
    if (!images.length) throw Error('No completed generated image is available.');
    return images.slice(0, MAX_IMAGES).map((img, index) => {
      const canvas = doc.createElement('canvas');
      let scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      for (let attempt = 0; attempt < 5; attempt++) {
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw Error('Unable to create the generated-image preview.');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/webp', 0.88);
        if (dataUrl.length <= MAX_DATA_LENGTH && /^data:image\/(webp|png);base64,/.test(dataUrl)) {
          return {dataUrl, width:canvas.width, height:canvas.height, name:`generated-image-${index + 1}.${dataUrl.startsWith('data:image/webp;') ? 'webp' : 'png'}`};
        }
        scale *= 0.7;
      }
      throw Error('The generated-image preview is too large. Open the official chat to view the original.');
    });
  }
  function clean(images) {
    if (!Array.isArray(images) || images.length > MAX_IMAGES) throw Error('Invalid generated images.');
    return images.map(img => {
      if (!img || typeof img.dataUrl !== 'string' || img.dataUrl.length > MAX_DATA_LENGTH ||
        !/^data:image\/(?:webp|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(img.dataUrl) ||
        !Number.isInteger(img.width) || !Number.isInteger(img.height) || img.width < 1 || img.height < 1 || img.width > 1600 || img.height > 1600) throw Error('Invalid generated-image preview.');
      return {dataUrl:img.dataUrl,width:img.width,height:img.height,name:typeof img.name==='string'?img.name.slice(0,100):'generated-image.webp'};
    });
  }
  const api = {MARKERS,after,loadedImages,capture,clean};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RoundtableGeneratedImages = api;
})(globalThis);
