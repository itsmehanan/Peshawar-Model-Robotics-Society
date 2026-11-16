import { esc, richText, mountFaq, socialIcons } from '../ui.js';
import { state } from '../store.js';

export function aboutPage() {
  const { event, faqs, contact, socials, footer } = state.content;

  return `<div class="view">
    <section class="page-hero">
      <div class="wrap page-hero__inner">
        <div>
          <nav class="breadcrumb" aria-label="Breadcrumb"><a href="#/" data-link>Home</a><span aria-hidden="true">/</span><span>About</span></nav>
          <h1 class="display display--sm mt-2">${esc(event.aboutTitle || 'About the exhibition')}</h1>
        </div>
        <p class="page-hero__aside lede small">${esc(event.intro)}</p>
      </div>
    </section>

    <section class="section section--tight">
      <div class="wrap split split--wide">
        <div class="prose">${richText(event.aboutBody)}</div>
        <aside class="stack">
          <div class="panel">
            <span class="eyebrow eyebrow--plain">The essentials</span>
            <dl class="mt-2" style="display:grid;gap:.9rem">
              <div>
                <dt class="tiny muted" style="text-transform:uppercase;letter-spacing:.1em">Date</dt>
                <dd style="margin:.2rem 0 0;font-family:var(--serif);font-size:1.1rem">${esc(event.dateLabel || 'To be announced')}</dd>
                <dd class="small muted" style="margin:.15rem 0 0">${esc(event.doorsLabel || '')}</dd>
              </div>
              <div>
                <dt class="tiny muted" style="text-transform:uppercase;letter-spacing:.1em">Venue</dt>
                <dd style="margin:.2rem 0 0;font-family:var(--serif);font-size:1.1rem">${esc(event.venue || 'To be announced')}</dd>
                <dd class="small muted" style="margin:.15rem 0 0">${esc(event.address || event.city || '')}</dd>
              </div>
              ${
                event.mapUrl
                  ? `<a class="link-arrow" href="${esc(event.mapUrl)}" target="_blank" rel="noopener noreferrer">Open in maps <span aria-hidden="true">↗</span></a>`
                  : ''
              }
            </dl>
          </div>
          <dl class="stats" style="grid-template-columns:1fr 1fr">
            ${(event.stats || [])
              .map(
                (s) => `<div class="stat"><dd class="stat__value">${esc(s.value)}</dd><dt class="stat__label">${esc(s.label)}</dt></div>`,
              )
              .join('')}
          </dl>
        </aside>
      </div>
    </section>

    <section class="section section--tight section--paper2">
      <div class="wrap split">
        <div>
          <span class="eyebrow">Common questions</span>
          <h2 class="h2 mt-1 mb-2">Good to know.</h2>
          <div class="faq">
            ${faqs
              .map(
                (f, i) => `
              <div class="faq__item">
                <button class="faq__q" data-faq-trigger aria-expanded="false" aria-controls="about-faq-${i}">
                  <span>${esc(f.question)}</span><span class="faq__icon" aria-hidden="true">+</span>
                </button>
                <div class="faq__a" id="about-faq-${i}" role="region"><div>${esc(f.answer)}</div></div>
              </div>`,
              )
              .join('')}
          </div>
        </div>
        <div class="stack">
          <div class="organiser">
            <span class="eyebrow eyebrow--plain">Organising desk</span>
            <p class="organiser__name">${esc(contact.organizerName || 'The organisers')}</p>
            <p class="small muted">${esc(contact.organizerRole || '')}</p>
            <p class="small ink2 mt-1">${esc(contact.organiserBody || '')}</p>
            <div class="row mt-1">
              ${contact.email ? `<a class="btn btn--solid btn--sm" href="mailto:${esc(contact.email)}">Email us</a>` : ''}
              <a class="btn btn--ghost btn--sm" href="#/contact" data-link>All contact details</a>
            </div>
          </div>
          ${
            socials.length
              ? `<div class="panel">
                  <span class="eyebrow eyebrow--plain">Follow the exhibition</span>
                  <div class="socials mt-2">
                    ${socials
                      .map(
                        (s) => `<a class="social" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">
                          ${socialIcons[s.platform] || ''}<span>${esc(s.label)}</span>
                          ${s.handle ? `<span class="social__handle">${esc(s.handle)}</span>` : ''}
                        </a>`,
                      )
                      .join('')}
                  </div>
                </div>`
              : ''
          }
          <p class="tiny muted">${esc(footer?.credit || '')}</p>
        </div>
      </div>
    </section>
  </div>`;
}

export function mountAbout(root) {
  mountFaq(root);
}
