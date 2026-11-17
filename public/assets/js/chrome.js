/** Header/footer rendering. Footer content is fully admin-driven. */
import { esc, socialIcons } from './ui.js';
import { state, registrationOpen } from './store.js';

export function renderFooter() {
  const host = document.getElementById('siteFoot');
  if (!host) return;
  const { site, contact, socials, footer, event, categories } = state.content || {};
  if (!site) return;

  const year = new Date().getFullYear();

  host.innerHTML = `
    <div class="wrap">
      <div class="foot__top">
        <div class="foot__brand">
          <a class="brand" href="#/" data-link>
            <span class="brand__mark" aria-hidden="true"><span>${esc(site.logoMark || 'O')}</span></span>
            <span class="brand__text">
              <span class="brand__name">${esc(site.name)}</span>
              <span class="brand__sub">${esc((event?.kicker || 'School Olympiad').replace(/^Season \d+ — /i, ''))}</span>
            </span>
          </a>
          <p class="foot__note">${esc(site.footerNote || site.description || '')}</p>
          ${
            socials?.length
              ? `<div class="socials mt-2">
                  ${socials
                    .map(
                      (s) => `<a class="social" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(s.label)}">
                        ${socialIcons[s.platform] || ''}<span class="sr-only">${esc(s.label)}</span>
                      </a>`,
                    )
                    .join('')}
                </div>`
              : ''
          }
        </div>

        <div class="foot__col">
          <h3>Exhibition</h3>
          <ul>
            <li><a href="#/fields" data-link>Fields of entry</a></li>
            <li><a href="#/journal" data-link>Journal</a></li>
            <li><a href="#/about" data-link>About &amp; FAQ</a></li>
            <li><a href="#/contact" data-link>Visit &amp; contact</a></li>
          </ul>
        </div>

        <div class="foot__col">
          <h3>Take part</h3>
          <ul>
            <li><a href="${registrationOpen() ? '#/register' : '#/contact'}" data-link>${registrationOpen() ? 'Register a team' : 'Registration enquiry'}</a></li>
            <li><a href="#/login" data-link>Student sign in</a></li>
            <li><a href="#/dashboard" data-link>My dashboard</a></li>
            <li><a href="#/admin" data-link>Organiser access</a></li>
          </ul>
        </div>

        <div class="foot__col">
          <h3>Contact</h3>
          <ul>
            ${contact?.email ? `<li><a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a></li>` : ''}
            ${contact?.phone ? `<li><a href="tel:${esc(contact.phone.replace(/[^\d+]/g, ''))}">${esc(contact.phone)}</a></li>` : ''}
            ${contact?.address ? `<li><span class="small muted">${esc(contact.address)}</span></li>` : ''}
            ${categories?.length ? `<li><span class="small muted">${categories.length} fields · ${esc(event?.dateLabel || '')}</span></li>` : ''}
          </ul>
        </div>
      </div>

      <div class="foot__wordmark" aria-hidden="true">${esc(site.name)}</div>

      <div class="foot__bottom">
        <span>© ${year} ${esc(footer?.copyright || site.fullName || site.name)}. All rights reserved.</span>
        <span>${esc(footer?.credit || '')}${footer?.credit ? ' · ' : ''}Designed and built for the exhibition.</span>
      </div>
    </div>`;
}

export function syncActiveNav(route) {
  document.querySelectorAll('.nav a, .mobile-nav a').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const target = href.replace(/^#\//, '').split('/')[0];
    const routeRoot = route.split('/')[0];
    link.classList.toggle('is-active', Boolean(target) && target === routeRoot);
  });
}

export function setMobileNav(open) {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('mobileNav');
  if (!toggle || !nav) return;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  nav.hidden = !open;
}
