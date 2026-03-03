/**
 * NormOS — utils.js
 * Global utility functions available to all scripts.
 */

/** HTML-escape a string */
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Random float between min and max */
function rnd(min, max) {
  return Math.random() * (max - min) + min;
}
