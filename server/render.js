/**
 * The document shell. Branding (name, logo, favicon, description) is injected
 * from the database on every request so admin edits apply everywhere at once —
 * while the hero centrepiece stays a fixed, hand-built piece of the design.
 */
/** JSON is embedded in a script tag; escape the characters that could break out. */
const safeJson = (value) =>
  JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function renderDocument(settings) {
  const site = settings.site || {};
  const event = settings.event || {};

  const name = site.name || 'ORBIT';
  const fullName = site.fullName || 'ORBIT School Olympiad';
  const description = site.metaDescription || site.description || 'A school olympiad for builders, thinkers and makers.';
  const logoMark = (site.logoMark || 'O').slice(0, 3);

  const favicon = site.faviconUrl
    ? `<link rel="icon" href="${esc(site.faviconUrl)}">`
    : `<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">`;

  const logo = site.logoUrl
    ? `<img class="brand__img" src="${esc(site.logoUrl)}" alt="" width="34" height="34">`
    : `<span class="brand__mark" aria-hidden="true"><span>${esc(logoMark)}</span></span>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(fullName)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#070c15">
${favicon}
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(fullName)}">
<meta property="og:description" content="${esc(description)}">
${event.heroImageUrl ? `<meta property="og:image" content="${esc(event.heroImageUrl)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" href="/fonts/fraunces-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/app.css">
<script type="application/json" id="boot-content">${safeJson(settings)}</script>
</head>
<body data-site-name="${esc(name)}">
<a class="skip" href="#main">Skip to content</a>

<header class="site-head" id="siteHead">
  <div class="wrap site-head__inner">
    <a class="brand" href="#/" data-link>
      ${logo}
      <span class="brand__text">
        <span class="brand__name">${esc(name)}</span>
        <span class="brand__sub">${esc((event.kicker || 'School Olympiad').replace(/^Season \d+ — /i, ''))}</span>
      </span>
    </a>

    <nav class="nav" id="primaryNav" aria-label="Primary">
      <a href="#/fields" data-link>Fields</a>
      <a href="#/journal" data-link>Journal</a>
      <a href="#/about" data-link>About</a>
      <a href="#/contact" data-link>Contact</a>
    </nav>

    <div class="site-head__actions">
      <a class="btn btn--ghost btn--sm" href="#/login" data-link data-auth-out>Sign in</a>
      <a class="btn btn--solid btn--sm" href="#/register" data-link data-auth-out data-register-link>
        Register <span class="btn__arrow" aria-hidden="true">↗</span>
      </a>
      <a class="btn btn--solid btn--sm" href="#/dashboard" data-link data-auth-in hidden>
        My dashboard
      </a>
      <button class="icon-btn nav-toggle" id="navToggle" aria-label="Open menu" aria-expanded="false" aria-controls="mobileNav">
        <span></span><span></span>
      </button>
    </div>
  </div>
  <div class="mobile-nav" id="mobileNav" hidden>
    <nav aria-label="Mobile">
      <a href="#/" data-link>Home</a>
      <a href="#/fields" data-link>Fields</a>
      <a href="#/journal" data-link>Journal</a>
      <a href="#/about" data-link>About</a>
      <a href="#/contact" data-link>Contact</a>
      <a href="#/login" data-link data-auth-out>Sign in</a>
      <a href="#/dashboard" data-link data-auth-in hidden>My dashboard</a>
    </nav>
  </div>
</header>

<main id="main" tabindex="-1"></main>

<footer class="site-foot" id="siteFoot"></footer>

<div class="toast-stack" id="toastStack" role="status" aria-live="polite"></div>
<div class="modal-root" id="modalRoot" hidden></div>

<noscript>
  <div class="wrap" style="padding:4rem 0">
    <h1>${esc(fullName)}</h1>
    <p>${esc(description)}</p>
    <p>This site needs JavaScript for registration. Email
      <a href="mailto:${esc(settings.contact?.email || '')}">${esc(settings.contact?.email || 'the organisers')}</a>
      and we will register your team manually.</p>
  </div>
</noscript>

<script type="module" src="/assets/js/main.js"></script>
</body>
</html>`;
}
