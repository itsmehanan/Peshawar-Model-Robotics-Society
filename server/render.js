/**
 * The document shell.
 *
 * Branding (name, logo, favicon, description) is injected from the database on
 * every request so admin edits apply everywhere at once — while the hero
 * centrepiece stays a fixed, hand-built piece of the design.
 */
import { THEME_BOOT } from './theme-boot.js';

/** JSON is embedded in a script tag; escape the characters that could break out. */
const safeJson = (value) =>
  JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function renderDocument(settings) {
  const site = settings.site || {};
  const event = settings.event || {};

  const name = site.name || 'PMRSDC';
  const fullName = site.fullName || 'Peshawar Model Robotics Society — Dalazak Campus';
  const description =
    site.metaDescription || site.description || 'The student robotics and engineering society of Peshawar Model School.';
  const tagline = [site.campusName, site.tagline].filter(Boolean).join(' · ') ||
    (event.kicker || 'Innovate · Build · Compete').replace(/^Season \\d+\\s*[-—]\\s*/i, '');

  const favicon = site.faviconUrl
    ? `<link rel="icon" href="${esc(site.faviconUrl)}">`
    : `<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">`;
  const appleIcon = `<link rel="apple-touch-icon" href="/assets/pmrs-logo-light.jpg">`;

  // The shared header uses the emblem from the same two theme-matched logo files
  // as the homepage. CSS crops the emblem and blends out the solid backplate.
  const darkMark = site.logoMarkDarkUrl || '/assets/pmrs-logo-dark.jpg';
  const lightMark = site.logoMarkLightUrl || '/assets/pmrs-logo-light.jpg';
  const logo = `<span class="pmrs-logo-crop brand__mark-crop" aria-hidden="true">
    <img class="pmrs-logo-dark" src="${esc(darkMark)}" alt="" width="1536" height="1536">
    <img class="pmrs-logo-light" src="${esc(lightMark)}" alt="" width="1536" height="1536">
  </span>`;

  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<script>${THEME_BOOT}</script>
<title>${esc(fullName)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#08080a">
<meta name="color-scheme" content="dark light">
${favicon}
${appleIcon}
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(fullName)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(event.heroImageUrl || '/assets/pmrs-logo-dark.jpg')}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" href="/fonts/archivo-var-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/dm-mono-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/app.css">
<link rel="stylesheet" href="/assets/pmrs-studio.css">
<script type="application/json" id="boot-content">${safeJson(settings)}</script>
</head>
<body class="instrument" data-site-name="${esc(name)}">
<a class="skip" href="#main">Skip to content</a>

<header class="site-head" id="siteHead">
  <div class="wrap site-head__inner">
    <a class="brand" href="#/" data-link>
      ${logo}
      <span class="brand__text">
        <span class="brand__name">${esc(name)}</span>
        <span class="brand__sub">${esc(tagline)}</span>
      </span>
    </a>

    <nav class="nav" id="primaryNav" aria-label="Primary">
      <a href="#/fields" data-link>Fields</a>
      <a href="#/journal" data-link>Journal</a>
      <a href="#/about" data-link>About</a>
      <a href="#/contact" data-link>Contact</a>
    </nav>

    <div class="site-head__actions">
      <button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch to light theme">
        <svg class="theme-toggle__rays" viewBox="0 0 38 38" aria-hidden="true" fill="none"
             stroke="currentColor" stroke-width="1.2" stroke-linecap="round">
          <path d="M19 3.5v3.4M19 31.1v3.4M3.5 19h3.4M31.1 19h3.4M8.2 8.2l2.4 2.4M27.4 27.4l2.4 2.4M29.8 8.2l-2.4 2.4M10.6 27.4l-2.4 2.4"/>
        </svg>
        <span class="theme-toggle__disc" aria-hidden="true"></span>
      </button>
      <a class="btn btn--ghost btn--sm" href="#/login" data-link data-auth-out>Sign in</a>
      <a class="btn btn--solid btn--sm" href="#/register" data-link data-auth-out data-register-link>
        Register <span class="btn__arrow" aria-hidden="true">↗</span>
      </a>
      <a class="btn btn--solid btn--sm" href="#/dashboard" data-link data-auth-in hidden>
        My dashboard
      </a>
      <!-- An organiser is signed in: the student affordances must go away, or the
           header keeps offering Register to the person running the event. -->
      <a class="btn btn--solid btn--sm" href="#/admin/overview" data-link data-admin-in hidden>
        Admin panel
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
      <a href="#/admin/overview" data-link data-admin-in hidden>Admin panel</a>
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
