// Runs in <head>, before the first paint: a light-theme user never sees a dark flash.
// chrome.storage is async, so popup.js mirrors the saved theme into localStorage.
try {
  document.documentElement.dataset.theme = localStorage.getItem('blueshield:theme') || 'dark';
} catch {
  // Storage blocked: keep the default from the HTML.
}
