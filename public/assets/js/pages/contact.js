import { esc, socialIcons } from '../ui.js';
import { state } from '../store.js';

export function contactPage() {
  const { contact, socials, event } = state.content;

  const rows = [
    contact.email && {
      term: 'Email',
      value: `<a class="underline" href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>`,
    },
    contact.phone && {
      term: 'Phone',
      value: `<a class="underline" href="tel:${esc(contact.phone.replace(/[^\d+]/g, ''))}">${esc(contact.phone)}</a>`,
    },
    contact.whatsapp && {
      term: 'WhatsApp',
      value: `<a class="underline" href="https://wa.me/${esc(contact.whatsapp.replace(/[^\d]/g, ''))}" target="_blank" rel="noopener noreferrer">${esc(contact.whatsapp)}</a>`,
    },
    contact.address && { term: 'Address', value: esc(contact.address) },
    contact.hours && { term: 'Office hours', value: esc(contact.hours) },
  ].filter(Boolean);

  return `<div class="view">
    <section class="page-hero">
      <div class="wrap page-hero__inner">
        <div>
          <nav class="breadcrumb" aria-label="Breadcrumb"><a href="#/" data-link>Home</a><span aria-hidden="true">/</span><span>Contact</span></nav>
          <h1 class="display display--sm mt-2">Talk to<br><em>a real person.</em></h1>
        </div>
        <p class="page-hero__aside lede small">
          ${esc(contact.organiserBody || 'Questions about eligibility, projects or visiting the exhibition? Write to the coordination desk.')}
        </p>
      </div>
    </section>

    <section class="section section--tight">
      <div class="wrap contact-grid">
        <div>
          <div class="organiser">
            <span class="eyebrow eyebrow--plain">Coordination desk</span>
            <p class="organiser__name">${esc(contact.organizerName || 'The organisers')}</p>
            <p class="small muted">${esc(contact.organizerRole || 'Olympiad coordination')}</p>
            <p class="small ink2">
              ${esc(state.content.site.fullName || 'The olympiad')} — one reply within two school days. For team changes, include your
              team name and school so we can find your record quickly.
            </p>
            ${contact.email ? `<a class="btn btn--solid btn--sm" style="width:max-content" href="mailto:${esc(contact.email)}?subject=${encodeURIComponent('ORBIT Olympiad enquiry')}">Write an email</a>` : ''}
          </div>

          ${
            rows.length
              ? `<dl class="contact-list mt-3">
                  ${rows.map((r) => `<div class="contact-row"><dt>${esc(r.term)}</dt><dd>${r.value}</dd></div>`).join('')}
                </dl>`
              : ''
          }
        </div>

        <div class="stack">
          ${
            socials.length
              ? `<div class="panel">
                  <span class="eyebrow eyebrow--plain">Social</span>
                  <h2 class="h3 mt-1 mb-2">Where we post during the season.</h2>
                  <div class="socials">
                    ${socials
                      .map(
                        (s) => `<a class="social" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(s.label)} — ${esc(s.handle || '')}">
                          ${socialIcons[s.platform] || ''}
                          <span>${esc(s.label)}</span>
                          ${s.handle ? `<span class="social__handle">${esc(s.handle)}</span>` : ''}
                        </a>`,
                      )
                      .join('')}
                  </div>
                  <p class="tiny muted mt-2">Only accounts the organisers have published appear here.</p>
                </div>`
              : `<div class="panel"><p class="small muted">Social accounts will be published closer to the event.</p></div>`
          }

          <div class="panel">
            <span class="eyebrow eyebrow--plain">Visiting</span>
            <h2 class="h3 mt-1">Coming to the exhibition</h2>
            <p class="small ink2 mt-1">
              Public viewing is free and open in the afternoon. Schools bringing a group of more than ten
              visitors should email the coordination desk so we can reserve seating.
            </p>
            <div class="kv mt-2">
              <div><dt>Venue</dt><dd>${esc(event.venue || 'To be announced')}</dd></div>
              <div><dt>Open to public</dt><dd>${esc(event.doorsLabel || 'See programme')}</dd></div>
            </div>
            ${event.mapUrl ? `<a class="link-arrow mt-2" href="${esc(event.mapUrl)}" target="_blank" rel="noopener noreferrer">Open in maps <span aria-hidden="true">↗</span></a>` : ''}
          </div>
        </div>
      </div>
    </section>
  </div>`;
}
