import { esc, richText } from '../ui.js';
import { state } from '../store.js';

export function fieldsPage() {
  const categories = state.content?.categories || [];
  return `<div class="view">
    <section class="page-hero">
      <div class="wrap page-hero__inner">
        <div>
          <nav class="breadcrumb" aria-label="Breadcrumb"><a href="#/" data-link>Home</a><span aria-hidden="true">/</span><span>Fields</span></nav>
          <h1 class="display display--sm">Pick the field<br><em>you actually built for.</em></h1>
        </div>
        <p class="page-hero__aside lede small">
          ${categories.length} fields of entry. Each team presents in one — the table, the judging rubric and the
          feedback all follow that choice.
        </p>
      </div>
    </section>

    <section class="content section--tight">
      <div class="wrap">
        <div class="grid grid--2">
          ${categories
            .map(
              (c, index) => `
            <a class="field-card reveal" data-delay="${Math.min(index, 3)}" href="#/fields/${esc(c.id)}" data-link style="min-height:17rem">
              <div class="field-card__top">
                <span class="field-card__index">${String(index + 1).padStart(2, '0')} / Field</span>
                <span class="field-card__symbol" aria-hidden="true">${esc(c.symbol)}</span>
              </div>
              <h3 style="font-size:1.4rem;margin-top:2rem">${esc(c.name)}</h3>
              <p style="font-size:.92rem;max-width:44ch">${esc(c.summary)}</p>
              <div class="field-card__foot">
                <span>Read the brief</span>
                <span class="field-card__arrow" aria-hidden="true">→</span>
              </div>
            </a>`,
            )
            .join('')}
        </div>
        <div class="callout callout--accent mt-3">
          <span class="callout__icon" aria-hidden="true">!</span>
          <div>
            A team cannot be split across fields, because the booth is judged as one entry. If you are already on a
            team, changing field sends a request to the organisers so the whole team moves together.
          </div>
        </div>
      </div>
    </section>
  </div>`;
}

export function fieldDetailPage({ id }) {
  const { categories, articles, registration } = state.content;
  const category = categories.find((c) => c.id === id);
  if (!category) return notFoundField();
  const index = categories.findIndex((c) => c.id === id);
  const related = (articles || []).slice(0, 2);

  return `<div class="view">
    <section class="page-hero">
      <div class="wrap page-hero__inner">
        <div>
          <nav class="breadcrumb" aria-label="Breadcrumb">
            <a href="#/" data-link>Home</a><span aria-hidden="true">/</span>
            <a href="#/fields" data-link>Fields</a><span aria-hidden="true">/</span>
            <span>${esc(category.name)}</span>
          </nav>
          <h1 class="display display--sm mt-2">${esc(category.name)}</h1>
          <p class="lede">${esc(category.summary)}</p>
        </div>
        <div class="page-hero__aside">
          <span class="field-card__symbol" style="font-size:3rem" aria-hidden="true">${esc(category.symbol)}</span>
          <p class="tiny muted mt-1">Field ${String(index + 1).padStart(2, '0')}</p>
        </div>
      </div>
    </section>

    <section class="section section--tight">
      <div class="wrap split split--wide">
        <div>
          <span class="eyebrow">The brief</span>
          <div class="prose mt-2">${richText(category.details || category.summary)}</div>
        </div>
        <aside class="aside-card" style="position:sticky">
          <h3>Entry rules</h3>
          <p class="small ink2">${esc(category.rules || 'Standard exhibition rules apply.')}</p>
          <div class="mt-2 stack stack--sm">
            <div class="aside-card__stat"><span>Team size</span><b>${(registration.minMembers ?? 2)}–${(registration.maxMembers ?? 4)}</b></div>
            <div class="aside-card__stat"><span>Registration</span><b>${registration.open === false ? 'Closed' : 'Open'}</b></div>
            <div class="aside-card__stat"><span>Presentation</span><b>2 min + questions</b></div>
          </div>
          ${
            registration.open === false
              ? `<p class="form-note mt-2">Entries for this field are closed. Speak to the coordination desk if you have already started a project.</p>`
              : `<a class="btn btn--solid btn--block mt-2" href="#/register?field=${esc(category.id)}" data-link>Register in this field <span class="btn__arrow" aria-hidden="true">↗</span></a>
                 <p class="tiny muted mt-1">You can change field later from your dashboard.</p>`
          }
        </aside>
      </div>

      ${
        related.length
          ? `<div class="wrap mt-3" style="margin-top:clamp(2.5rem,5vw,4rem)">
              <div class="section-head">
                <div><span class="eyebrow">Preparation</span><h2 class="h3 mt-1">Before you start building</h2></div>
                <a class="section-head__aside link-arrow small" href="#/journal" data-link>All notes <span aria-hidden="true">→</span></a>
              </div>
              <div class="journal-grid">
                ${related
                  .map(
                    (a) => `<a class="journal-card" href="#/journal/${esc(a.slug)}" data-link>
                      <div class="journal-card__meta"><span>${esc(a.label)}</span><span aria-hidden="true">·</span><span>${a.readMinutes} min</span></div>
                      <h3>${esc(a.title)}</h3>
                      <p>${esc(a.excerpt)}</p>
                      <span class="journal-card__cta">Read <span aria-hidden="true">↗</span></span>
                    </a>`,
                  )
                  .join('')}
              </div>
            </div>`
          : ''
      }
    </section>
  </div>`;
}

function notFoundField() {
  return `<div class="view"><section class="section">
    <div class="wrap wrap--narrow center">
      <span class="eyebrow eyebrow--plain">404</span>
      <h1 class="display display--sm mt-2">That field does not exist.</h1>
      <p class="lede mt-2" style="margin-inline:auto">It may have been renamed or retired by the organisers.</p>
      <a class="btn btn--solid mt-2" href="#/fields" data-link>See all fields</a>
    </div>
  </section></div>`;
}
