import { esc, richText, formatDate } from '../ui.js';
import { state } from '../store.js';

export function journalPage() {
  const { articles } = state.content;
  if (!articles.length) {
    return `<div class="view"><section class="section"><div class="wrap center">
      <span class="eyebrow eyebrow--plain">Journal</span>
      <h1 class="display display--sm mt-2">Nothing published yet.</h1>
      <p class="lede mt-2" style="margin-inline:auto">The organisers are still writing the first notes.</p>
    </div></section></div>`;
  }
  const [lead, ...rest] = articles;

  return `<div class="view">
    <section class="page-hero">
      <div class="wrap page-hero__inner">
        <div>
          <nav class="breadcrumb" aria-label="Breadcrumb"><a href="#/" data-link>Home</a><span aria-hidden="true">/</span><span>Journal</span></nav>
          <h1 class="display display--sm mt-2">Field notes<br><em>from the floor.</em></h1>
        </div>
        <p class="page-hero__aside lede small">Practical writing for students who are building something for the first time — judging, teamwork, and how to stand behind a table for six hours.</p>
      </div>
    </section>

    <section class="section section--tight">
      <div class="wrap">
        <a class="journal-card" href="#/journal/${esc(lead.slug)}" data-link style="grid-template-columns:minmax(0,1fr);padding-top:0;border-top:0">
          <div class="journal-card__meta"><span>${esc(lead.label)}</span><span aria-hidden="true">·</span><span>${lead.readMinutes} min read</span></div>
          <h3 style="font-size:clamp(1.7rem,3.4vw,2.6rem);max-width:30ch">${esc(lead.title)}</h3>
          <p style="font-size:1rem;max-width:60ch">${esc(lead.excerpt)}</p>
          <span class="journal-card__cta">Read the piece <span aria-hidden="true">↗</span></span>
        </a>

        ${
          rest.length
            ? `<div class="journal-grid mt-3" style="margin-top:clamp(2.5rem,5vw,4rem)">
                ${rest
                  .map(
                    (a) => `<a class="journal-card" href="#/journal/${esc(a.slug)}" data-link>
                      <div class="journal-card__meta"><span>${esc(a.label)}</span><span aria-hidden="true">·</span><span>${a.readMinutes} min</span></div>
                      <h3>${esc(a.title)}</h3>
                      <p>${esc(a.excerpt)}</p>
                      <span class="journal-card__cta">Read <span aria-hidden="true">↗</span></span>
                    </a>`,
                  )
                  .join('')}
              </div>`
            : ''
        }
      </div>
    </section>
  </div>`;
}

export function articlePage({ slug }) {
  const { articles } = state.content;
  const article = articles.find((a) => a.slug === slug);
  if (!article) {
    return `<div class="view"><section class="section"><div class="wrap wrap--narrow center">
      <span class="eyebrow eyebrow--plain">404</span>
      <h1 class="display display--sm mt-2">That piece is not here.</h1>
      <a class="btn btn--solid mt-2" href="#/journal" data-link>Back to the journal</a>
    </div></section></div>`;
  }
  const others = articles.filter((a) => a.slug !== slug).slice(0, 2);

  return `<div class="view">
    <article>
      <section class="page-hero">
        <div class="wrap wrap--narrow">
          <nav class="breadcrumb" aria-label="Breadcrumb">
            <a href="#/" data-link>Home</a><span aria-hidden="true">/</span>
            <a href="#/journal" data-link>Journal</a><span aria-hidden="true">/</span>
            <span>${esc(article.label)}</span>
          </nav>
          <h1 class="display display--sm mt-2">${esc(article.title)}</h1>
          <p class="lede">${esc(article.excerpt)}</p>
          <div class="row small muted mt-2">
            <span>${esc(article.label)}</span><span aria-hidden="true">·</span>
            <span>${article.readMinutes} min read</span><span aria-hidden="true">·</span>
            <span>${formatDate(article.createdAt)}</span>
          </div>
        </div>
      </section>

      <section class="section section--tight">
        <div class="wrap wrap--narrow">
          <div class="prose">${richText(article.body)}</div>
          <div class="rule mt-3" style="margin:2.5rem 0 1.5rem"></div>
          <div class="row row--between">
            <a class="link-arrow" href="#/journal" data-link><span aria-hidden="true">←</span> All journal entries</a>
            <a class="link-arrow" href="#/register" data-link>Register a team <span aria-hidden="true">→</span></a>
          </div>
        </div>
      </section>
    </article>

    ${
      others.length
        ? `<section class="section section--tight section--paper2">
            <div class="wrap">
              <div class="section-head"><div><span class="eyebrow">Keep reading</span><h2 class="h3 mt-1">More field notes</h2></div></div>
              <div class="journal-grid">
                ${others
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
            </div>
          </section>`
        : ''
    }
  </div>`;
}
