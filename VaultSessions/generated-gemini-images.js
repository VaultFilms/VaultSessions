"use strict";
// Verified during a VS-submitted Gemini image generation on 2026-11-04.
(function(root) {
  const MARKERS = '.image-gen-shimmer-placeholder, generated-image';
  function inspect(user, doc = document) {
    const markers = [...doc.querySelectorAll(MARKERS)].filter(node => user.compareDocumentPosition(node) & 4);
    const generated = markers.filter(node => node.matches('generated-image'));
    const images = [...new Set(generated.flatMap(node => [...node.querySelectorAll('img')]))];
    const loaded = images.length && images.every(img => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) ? images.slice(0, 4) : [];
    const loading = markers.some(node => node.matches('.image-gen-shimmer-placeholder, .gem-shimmer-active') || node.closest('.pending') || node.querySelector('.loader.animate'));
    return {markers, images:loaded, loading};
  }
  const api = {MARKERS, inspect};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RoundtableGeminiImages = api;
})(globalThis);
