import { esc, richText, socialIcons, mountFaq } from '../ui.js';
import { state } from '../store.js';

const pad = (n) => String(n).padStart(2, '0');

function orbitalPlate({ venue, city, kicker }) {
  return `
  <figure class="plate reveal" data-delay="1" data-plate aria-label="Cover plate: orbital diagram of the exhibition">
    <div class="plate__stage" aria-hidden="true">
      <div class="plate__rings">
        <span class="plate__ring plate__ring--a"></span>
        <span class="plate__ring plate__ring--b"></span>
        <span class="plate__ring plate__ring--c"></span>
        <span class="plate__ring plate__ring--d"></span>
      </div>
      <span class="plate__meridian"></span>
      <span class="plate__core"></span>
      <span class="plate__satellite plate__satellite--1"></span>
      <span class="plate__satellite plate__satellite--2"></span>
      <span class="plate__satellite plate__satellite--3"></span>
      <span class="plate__ticks"><span></span><span></span><span></span><span></span></span>
    </div>
    <figcaption class="plate__label plate__label--tl">
      ${esc((kicker || 'Season 04').toUpperCase())}
      <b>Exhibition</b>
    </figcaption>
    <div class="plate__label plate__label--br">
      ${esc((venue || 'Main hall').toUpperCase())}
      <b>${esc(city || '—')}</b>
    </div>
    <span class="plate__caption">Orbital diagram · plate 01</span>
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
  <a class="field-card reveal" data-delay="${Math.min(index, 4)}" data-tilt href="#/fields/${esc(category.id)}" data-link>
    <div class="field-card__top">
      <span class="field-card__index">${pad(index + 1)} / Field</span>
      <span class="field-card__symbol" aria-hidden="true">${esc(category.symbol || '◇')}</span>
    </div>
    <h3>${esc(category.name)}</h3>
    <p class="small ink2">${esc(category.summary)}</p>
    <div class="field-card__foot">
      <span>Explore</span>
      <span class="field-card__arrow" aria-hidden="true">→</span>
    </div>
  </a>`;
}

function journalCard(article, index) {
  return `
  <a class="journal-card reveal" data-delay="${Math.min(index + 1, 4)}" data-tilt href="#/journal/${esc(article.slug)}" data-link>
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
          <div class="hero__date">
            <span class="dot" aria-hidden="true"></span>
            ${esc(event.dateLabel || 'Date to be announced')}
            <span aria-hidden="true">·</span>
            ${esc(event.city || '')}
          </div>
          <h1 class="display">${richInk(event.headline)}</h1>
          <p class="lede hero__lede">${esc(event.intro)}</p>
          <div class="hero__actions">
            <a class="btn btn--solid btn--lg" href="${primaryCta}" data-link>
              ${esc(ctaLabel)} <span class="btn__arrow" aria-hidden="true">↗</span>
            </a>
            <a class="btn btn--ghost btn--lg" href="#/about" data-link>About the exhibition</a>
          </div>
          <dl class="hero__facts">
            ${facts
              .map(
                (f) => `<div class="hero__fact"><dt>${esc(f.term)}</dt><dd>${esc(f.value)}</dd></div>`,
              )
              .join('')}
          </dl>
        </div>
        ${orbitalPlate({ venue: event.venue, city: event.city, kicker: event.kicker })}
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
          <article class="step">
            <span class="step__num">Step 01</span>
            <h3>Create your account</h3>
            <p>Name, class, school, one field of entry. About forty seconds, and you can edit all of it later.</p>
          </article>
          <article class="step">
            <span class="step__num">Step 02</span>
            <h3>Start or join a team</h3>
            <p>Leaders create a team, set its size and share the passcode. Everyone else joins with that code — same school, same field.</p>
          </article>
          <article class="step">
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
  mountPlate(root);
  const close = root.querySelector('[data-dismiss-notice]');
  close?.addEventListener('click', () => {
    const bar = close.closest('.notice-bar');
    bar.style.transition = 'opacity 180ms ease';
    bar.style.opacity = '0';
    setTimeout(() => bar.remove(), 180);
  });
}

/**
 * Pointer parallax for the cover plate.
 *
 * The plate is decorative and fixed — it is deliberately not admin-editable,
 * because it is the one piece of the identity that should look the same in
 * every deployment. Movement is capped so it reads as a heavy object settling,
 * not a toy. Skipped entirely for reduced-motion users and touch devices.
 */
function mountPlate(root) {
  const plate = root.querySelector('[data-plate]');
  if (!plate) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const stage = plate.querySelector('.plate__stage');
  if (!stage) return;

  let frame = 0;
  const onMove = (event) => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const rect = plate.getBoundingClientRect();
      const dx = (event.clientX - (rect.left + rect.width / 2)) / rect.width;
      const dy = (event.clientY - (rect.top + rect.height / 2)) / rect.height;
      stage.style.setProperty('--ry', `${(-12 - dx * 14).toFixed(2)}deg`);
      stage.style.setProperty('--rx', `${(14 + dy * 10).toFixed(2)}deg`);
    });
  };
  const reset = () => {
    stage.style.removeProperty('--ry');
    stage.style.removeProperty('--rx');
  };
  plate.addEventListener('pointermove', onMove);
  plate.addEventListener('pointerleave', reset);
}
