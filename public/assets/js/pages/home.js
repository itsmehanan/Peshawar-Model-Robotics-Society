import { esc, richText, socialIcons, mountFaq } from '../ui.js';
import { bootHero3D } from '../hero-boot.js';
import { state } from '../store.js';

const pad = (n) => String(n).padStart(2, '0');

/* Field artwork. Generated studio renders shipped as static assets: they are
   part of the design system, not admin content, so they cannot be broken by a
   branding change. Each category falls back to the hero object if a future
   category has no artwork yet. */
/* Bases are extension-less so one helper can build every variant. Keeping the
   `.png` in the base produced `/assets/art/field-robotics.png-sm.png`, which does
   not exist — every non-WebP browser got a broken card image. */
const FIELD_ART = {
  robotics: '/assets/art/field-robotics',
  science: '/assets/art/field-science',
  engineering: '/assets/art/field-engineering',
  technology: '/assets/art/field-technology',
};

export const fieldArt = (id) => FIELD_ART[id] || '/assets/art/hero';

/**
 * <picture> markup: half-size WebP/PNG for phones, full-size WebP for desktop,
 * and a PNG fallback that always exists. `base` must have no extension.
 */
export function artPicture(base, { width, height, eager = false, className = '' } = {}) {
  const root = String(base).replace(/\.[a-z0-9]+$/i, '');
  return `<picture${className ? ` class="${className}"` : ''}>
      <source media="(max-width: 640px)" type="image/webp" srcset="${root}-sm.webp">
      <source media="(max-width: 640px)" srcset="${root}-sm.png">
      <source type="image/webp" srcset="${root}.webp">
      <img src="${root}-sm.png" alt="" width="${width}" height="${height}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">
    </picture>`;
}

/**
 * The hero stage.
 *
 * A canvas sits over a poster render. The poster is what everyone sees, on every
 * device, immediately — it is the whole fallback strategy. Once the bundled 3D
 * scene has proven it can render a frame (see hero-boot.js), it fades in on top.
 * That way the centrepiece is never a blank box, and reduced-motion users keep
 * the still image by design.
 *
 * The caption labels stay: they are the studio-drawing detail that keeps the
 * object reading as an artefact rather than as a decorative blob.
 */
function heroStage({ venue, city, kicker }) {
  return `
  <figure class="plate" data-plate data-hero-stage aria-label="The PMRS centrepiece: a machined arm presenting a wireframe cube inside a gear ring">
    <span class="plate__guides" aria-hidden="true"><span></span><span></span><span></span></span>
    <div class="plate__media">
      ${artPicture('/assets/art/hero', { width: 1000, height: 1000, eager: true, className: 'plate__object' })}
      <canvas class="plate__canvas" data-hero-canvas hidden aria-hidden="true"></canvas>
    </div>
    <span class="plate__ticks" aria-hidden="true"><span></span><span></span><span></span><span></span></span>
    <figcaption class="plate__label plate__label--tl">
      ${esc((kicker || 'Season 04').toUpperCase())}<br><b>Society centrepiece</b>
    </figcaption>
    <div class="plate__label plate__label--br">
      ${esc((venue || 'Main hall').toUpperCase())}<br><b>${esc(city || '—')}</b>
    </div>
    <span class="plate__caption">Plate 01 / arm &amp; cube</span>
  </figure>`;
}

function noticeBar(notice) {
  return `<aside class="notice-bar notice-bar--${esc(notice.level || 'info')}" aria-label="Announcement">
    <div class="wrap notice-bar__inner">
      <span class="notice-bar__tag">${notice.level === 'important' ? 'Important' : notice.level === 'success' ? 'News' : 'Notice'}</span>
      <p class="notice-bar__text"><b>${esc(notice.title)}</b>${notice.body ? ` — ${esc(notice.body)}` : ''}</p>
      ${notice.linkUrl ? `<a class="notice-bar__link" href="${esc(notice.linkUrl)}" target="_blank" rel="noopener noreferrer">${esc(notice.linkLabel || 'Read more')}</a>` : ''}
      <button class="notice-bar__close" data-dismiss-notice aria-label="Dismiss announcement">✕</button>
    </div>
  </aside>`;
}

function fieldCard(category, index) {
  return `
  <a class="field-card reveal" data-delay="${Math.min(index, 4)}" href="#/fields/${esc(category.id)}" data-link>
    <div class="field-card__media">
      ${artPicture(fieldArt(category.id), { width: 880, height: 660 })}
    </div>
    <div class="field-card__top">
      <span class="field-card__index">${pad(index + 1)} / Field</span>
      <span class="field-card__symbol" aria-hidden="true">${esc(category.symbol || '◇')}</span>
    </div>
    <h3>${esc(category.name)}</h3>
    <p>${esc(category.summary)}</p>
    <div class="field-card__foot">
      <span>Read the brief</span>
      <span class="field-card__arrow" aria-hidden="true">→</span>
    </div>
  </a>`;
}

function journalCard(article, index) {
  return `
  <a class="journal-card reveal" data-delay="${Math.min(index + 1, 4)}" href="#/journal/${esc(article.slug)}" data-link>
    <div class="journal-card__meta">
      <span>${esc(article.label)}</span>
      <span aria-hidden="true">·</span>
      <span>${article.readMinutes} min read</span>
    </div>
    <h3>${esc(article.title)}</h3>
    <p>${esc(article.excerpt)}</p>
    <span class="journal-card__cta">Read the piece <span aria-hidden="true">↗</span></span>
  </a>`;
}

export function homePage() {
  const { content, student } = state;
  const site = content.site;
  const event = content.event;
  const registration = content.registration || {};
  const categories = content.categories || [];
  const articles = (content.articles || []).slice(0, 3);
  const faqs = (content.faqs || []).slice(0, 4);
  const counts = content.counts || {};
  const deadline = registration.deadlineLabel || '';

  const ctaHref = student ? '#/dashboard' : '#/register';
  const ctaLabel = student ? 'Open my dashboard' : registration.open === false ? 'See registration details' : 'Register your team';
  const primaryCta = registration.open === false && !student ? '#/register' : ctaHref;

  const facts = [
    { term: 'Date', value: event.dateLabel || 'To be announced' },
    { term: 'Venue', value: event.venue || 'To be announced' },
    { term: 'Teams', value: registration.open === false ? 'Closed' : deadline || 'Open now' },
  ];

  const notice = (content.announcements || []).find((a) => a.isActive !== false);

  return `<div class="view">
    ${notice ? noticeBar(notice) : ''}
    <section class="hero">
      <div class="wrap hero__grid">
        <div>
          <span class="eyebrow">${esc((event.kicker || 'Season 04').toUpperCase())}${event.city ? ` · ${esc(event.city.toUpperCase())}` : ''}</span>
          <div class="hero__date mt-2">
            <span class="dot" aria-hidden="true"></span>
            ${esc(event.dateLabel || 'Date to be announced')}
            <span aria-hidden="true">·</span>
            ${esc(event.doorsLabel || 'Exhibition day')}
          </div>
          <h1 class="display">${richInk(event.headline)}</h1>
          <p class="lede hero__lede">${esc(event.intro)}</p>
          <div class="hero__actions">
            <a class="btn btn--solid btn--lg" href="${primaryCta}" data-link>
              ${esc(ctaLabel)} <span class="btn__arrow" aria-hidden="true">↗</span>
            </a>
            <a class="btn btn--lg" href="#/fields" data-link>Explore the fields</a>
          </div>
          <dl class="hero__facts">
            ${facts
              .map(
                (f) => `<div class="hero__fact"><dt>${esc(f.term)}</dt><dd>${esc(f.value)}</dd></div>`,
              )
              .join('')}
          </dl>
        </div>
        ${heroStage({ venue: event.venue, city: event.city, kicker: event.kicker })}
      </div>
    </section>

    <div class="ticker" aria-hidden="true">
      <div class="ticker__track">
        ${Array.from({ length: 2 })
          .map(
            () =>
              `<span class="ticker__item">${esc(site.fullName || site.name)}</span>` +
              categories.map((c) => `<span class="ticker__item">${esc(c.name)}</span>`).join('') +
              `<span class="ticker__item">${esc(event.dateLabel || 'Exhibition day')}</span>`,
          )
          .join('')}
      </div>
    </div>

    <section class="section" id="fields">
      <div class="wrap">
        <div class="section-head">
          <div>
            <span class="eyebrow">01 — Fields of entry</span>
            <h2 class="h2 mt-1">Four ways to enter.<br>One exhibition floor.</h2>
          </div>
          <p class="section-head__aside small ink2">
            Every team presents in exactly one field. Choose the one that matches the work you actually
            built, not the one that sounds most impressive.
          </p>
        </div>
        <div class="grid grid--4">
          ${categories.map(fieldCard).join('')}
        </div>
      </div>
    </section>

    <section class="section section--dark">
      <div class="wrap">
        <div class="section-head">
          <div>
            <span class="eyebrow">02 — The day</span>
            <h2 class="h2 mt-1">A working exhibition,<br><em>not a schedule of talks.</em></h2>
          </div>
          <p class="section-head__aside small">
            Booths open in the morning, judges circulate before lunch, and the hall is open to families and
            visiting schools in the afternoon.
          </p>
        </div>
        <dl class="event-band">
          <div class="event-band__item">
            <dt>Date</dt>
            <dd>${esc(event.dateLabel || 'To be announced')}<small class="tiny muted" style="display:block;margin-top:.3rem;font-family:var(--sans)">${esc(event.doorsLabel || '')}</small></dd>
          </div>
          <div class="event-band__item">
            <dt>Venue</dt>
            <dd>${esc(event.venue || 'To be announced')}<small class="tiny muted" style="display:block;margin-top:.3rem;font-family:var(--sans)">${esc(event.city || '')}</small></dd>
          </div>
          <div class="event-band__item">
            <dt>Entries</dt>
            <dd>${counts.students || 0} students<small class="tiny muted" style="display:block;margin-top:.3rem;font-family:var(--sans)">${counts.teams || 0} teams registered</small></dd>
          </div>
          <div class="event-band__item">
            <dt>Registration</dt>
            <dd>${registration.open === false ? 'Closed' : 'Open now'}<small class="tiny muted" style="display:block;margin-top:.3rem;font-family:var(--sans)">${esc(deadline || 'Teams of two to six')}</small></dd>
          </div>
        </dl>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <div>
            <span class="eyebrow">03 — Taking part</span>
            <h2 class="h2 mt-1">From a question<br>to a booth.</h2>
          </div>
          <p class="section-head__aside small ink2">
            Registration is done by the team leader. Teammates join with the passcode the leader sets —
            no duplicate sign-ups, no waiting for a coordinator.
          </p>
        </div>
        <div class="steps">
          <article class="step" data-step="01">
            <span class="step__num">Step 01</span>
            <h3>Create your account</h3>
            <p>Name, class, school, one field of entry. About forty seconds, and you can edit all of it later.</p>
          </article>
          <article class="step" data-step="02">
            <span class="step__num">Step 02</span>
            <h3>Start or join a team</h3>
            <p>Leaders create a team, set its size and share the passcode. Everyone else joins with that code — same school, same field.</p>
          </article>
          <article class="step" data-step="03">
            <span class="step__num">Step 03</span>
            <h3>Build, then present</h3>
            <p>Prepare the object and a two-minute explanation. Judges visit every booth and leave written feedback.</p>
          </article>
        </div>
        <div class="mt-3" style="display:flex;gap:.75rem;flex-wrap:wrap">
          <a class="btn btn--solid" href="${student ? '#/dashboard' : '#/register'}" data-link>
            ${student ? 'Go to my dashboard' : 'Start registration'} <span class="btn__arrow" aria-hidden="true">↗</span>
          </a>
          <a class="link-arrow" href="#/journal" data-link>Read the field notes <span aria-hidden="true">→</span></a>
        </div>
      </div>
    </section>

    <section class="section section--paper2">
      <div class="wrap">
        <div class="section-head">
          <div>
            <span class="eyebrow">04 — About</span>
            <h2 class="h2 mt-1">${esc(event.aboutTitle || 'An exhibition, not a competition of polish.')}</h2>
          </div>
        </div>
        <div class="split">
          <div class="prose">${richText(event.aboutBody)}</div>
          <dl class="stats" style="align-self:start">
            ${(event.stats || [])
              .map(
                (s) => `<div class="stat"><dd class="stat__value" data-count>${esc(s.value)}</dd><dt class="stat__label">${esc(s.label)}</dt></div>`,
              )
              .join('')}
          </dl>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <div>
            <span class="eyebrow">05 — Journal</span>
            <h2 class="h2 mt-1">Field notes for<br>first-time exhibitors.</h2>
          </div>
          <a class="section-head__aside link-arrow" href="#/journal" data-link>All writing <span aria-hidden="true">→</span></a>
        </div>
        <div class="journal-grid">
          ${articles.map(journalCard).join('')}
        </div>
      </div>
    </section>

    <section class="section section--tight">
      <div class="wrap">
        <div class="split split--wide">
          <div>
            <span class="eyebrow">06 — Questions</span>
            <h2 class="h2 mt-1 mb-2">Good to know.</h2>
            <div class="faq" data-faq>
              ${faqs
                .map(
                  (f, index) => `
                <div class="faq__item">
                  <button class="faq__q" data-faq-trigger aria-expanded="false" aria-controls="home-faq-${index}">
                    <span>${esc(f.question)}</span>
                    <span class="faq__icon" aria-hidden="true">+</span>
                  </button>
                  <div class="faq__a" id="home-faq-${index}" role="region">
                    <div>${esc(f.answer)}</div>
                  </div>
                </div>`,
                )
                .join('')}
            </div>
            <a class="link-arrow mt-2" href="#/about" data-link>All questions & contact <span aria-hidden="true">→</span></a>
          </div>
          <div class="aside-card" style="position:static">
            <span class="eyebrow eyebrow--plain">Coordination desk</span>
            <h3 class="mt-1">${esc(content.contact.organizerName || 'The organisers')}</h3>
            <p class="small muted">${esc(content.contact.organizerRole || '')}</p>
            <div class="mt-2 stack stack--sm small">
              ${content.contact.email ? `<a class="underline" href="mailto:${esc(content.contact.email)}">${esc(content.contact.email)}</a>` : ''}
              ${content.contact.phone ? `<a class="underline" href="tel:${esc(content.contact.phone.replace(/\s/g, ''))}">${esc(content.contact.phone)}</a>` : ''}
            </div>
            ${
              (content.socials || []).length
                ? `<div class="socials mt-2">
                    ${content.socials
                      .map(
                        (s) =>
                          `<a class="social" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(s.label)}">
                            ${socialIcons[s.platform] || ''}<span class="social__handle">${esc(s.handle || s.label)}</span>
                          </a>`,
                      )
                      .join('')}
                  </div>`
                : ''
            }
          </div>
        </div>
      </div>
    </section>

    <section class="section section--tight" style="padding-top:0">
      <div class="wrap">
        <div class="callout callout--accent" style="display:flex;justify-content:space-between;align-items:center;gap:1.4rem;flex-wrap:wrap;padding:clamp(1.2rem,3vw,2rem)">
          <div>
            <span class="eyebrow">${registration.open === false ? 'Registration closed' : 'Entries open'}</span>
            <h2 class="stub__title mt-1">
              ${registration.open === false ? 'Registration for this season is closed.' : 'Bring the thing you made.'}
            </h2>
            <p class="lede small" style="max-width:46ch">
              ${
                registration.open === false
                  ? esc(registration.closedMessage || 'Contact the coordination desk to be told when the next season opens.')
                  : 'Teams register in minutes. You keep control of your profile, your team and your field — and you can change all of it from your dashboard.'
              }
            </p>
          </div>
          <div class="row">
            ${
              registration.open === false
                ? `<a class="btn btn--solid" href="#/contact" data-link>Contact the organisers</a>`
                : `<a class="btn btn--accent" href="${student ? '#/dashboard' : '#/register'}" data-link>
                     ${student ? 'My dashboard' : 'Register a team'} <span class="btn__arrow" aria-hidden="true">↗</span>
                   </a>
                   <a class="btn btn--ghost" href="#/login" data-link>Sign in</a>`
            }
          </div>
        </div>
      </div>
    </section>
  </div>`;
}

/** Allow a single emphasised word in the admin-controlled headline. */
function richInk(headline) {
  const safe = esc(headline || '');
  const words = safe.split(' ');
  if (words.length < 3) return safe;
  const last = words.pop();
  return `${words.join(' ')} <em>${last}</em>`;
}

export function mountHome(root) {
  mountFaq(root);
  // Loads the 3D scene once the hero is on screen. Any failure leaves the
  // poster image in place, which is the whole fallback strategy.
  bootHero3D();
  const close = root.querySelector('[data-dismiss-notice]');
  close?.addEventListener('click', () => {
    const bar = close.closest('.notice-bar');
    bar.style.transition = 'opacity 180ms ease';
    bar.style.opacity = '0';
    setTimeout(() => bar.remove(), 180);
  });
}
