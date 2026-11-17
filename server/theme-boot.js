/**
 * Theme bootstrap.
 *
 * The stored theme must be applied before the body paints, otherwise every load
 * shows a flash of the wrong palette. That means an inline <script> in <head>.
 *
 * It lives in its own module for one reason: the Content-Security-Policy is
 * `script-src 'self'` with no `'unsafe-inline'`, so an inline script is BLOCKED
 * unless its exact bytes are listed as a sha256 hash. Keeping the source in one
 * place lets the document renderer inline it and the security middleware hash
 * the very same string, instead of two copies drifting apart — which is how the
 * theme preference silently stopped surviving a reload.
 */
import crypto from 'node:crypto';

export const THEME_BOOT = `(function(){try{
  var k='pmrs-theme',s=localStorage.getItem(k);
  var t=(s==='light'||s==='dark')?s:'dark';
  document.documentElement.setAttribute('data-theme',t);
  document.documentElement.style.colorScheme=t;
}catch(e){document.documentElement.setAttribute('data-theme','dark')}})();`;

/** `'sha256-…'` source expression for this exact script body. */
export const THEME_BOOT_HASH = `'sha256-${crypto
  .createHash('sha256')
  .update(THEME_BOOT, 'utf8')
  .digest('base64')}'`;
