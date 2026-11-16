/** Small DOM + interaction helpers shared by every page. */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Escape then convert a tiny subset of markdown (bold, italics, links, ##). */
export function richText(value) {
  const safe = esc(value);
  return safe
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (/^##\s+/.test(trimmed)) return `<h2>${inline(trimmed.replace(/^##\s+/, ''))}</h2>`;
      if (/^###\s+/.test(trimmed)) return `<h3>${inline(trimmed.replace(/^###\s+/, ''))}</h3>`;
      if (/^[-•]\s+/m.test(trimmed)) {
        const items = trimmed.split('\n').map((l) => l.replace(/^[-•]\s+/, ''));
        return `<ul>${items.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`;
      }
      return `<p>${inline(trimmed).replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
}

function inline(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\s)_([^_]+)_/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

export const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] || '')
    .join('')
    .toUpperCase() || '·';

export function formatDate(value, { style = 'long' } = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: style === 'short' ? 'short' : 'long',
    year: 'numeric',
  });
}

export function relative(value) {
  const date = new Date(value);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} d ago`;
  return formatDate(value, { style: 'short' });
}

/* ------------------------------------------------------------------ toast */
const ICONS = { ok: '✓', error: '!', info: '·' };

export function toast(message, kind = 'info', timeout = 4200) {
  const stack = $('#toastStack');
  if (!stack) return;
  const node = document.createElement('div');
  node.className = `toast toast--${kind === 'info' ? 'ok' : kind}`;
  node.innerHTML = `<span class="toast__icon" aria-hidden="true">${ICONS[kind] || ICONS.info}</span><span>${esc(message)}</span>`;
  stack.append(node);
  const remove = () => {
    node.classList.add('is-out');
    setTimeout(() => node.remove(), 260);
  };
  const timer = setTimeout(remove, timeout);
  node.addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });
}

/* ------------------------------------------------------------------ modal */
let activeModal = null;

export function modal({ title, body, actions = [], onMount, size }) {
  closeModal();
  const root = $('#modalRoot');
  root.hidden = false;
  root.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" ${size === 'lg' ? 'style="width:min(46rem,100%)"' : ''}>
      <div class="modal__head">
        <h2 class="modal__title">${esc(title)}</h2>
        <button class="modal__close" data-modal-close aria-label="Close">✕</button>
      </div>
      <div class="modal__body">${body}</div>
      ${actions.length ? `<div class="modal__foot">${actions.map((a) => `<button class="btn ${a.cls || 'btn--ghost btn--sm'}" data-modal-action="${esc(a.id)}">${esc(a.label)}</button>`).join('')}</div>` : ''}
    </div>`;

  const dialog = root.querySelector('.modal');
  activeModal = { root, dialog, previousFocus: document.activeElement };

  const close = () => closeModal();
  root.querySelectorAll('[data-modal-close]').forEach((b) => b.addEventListener('click', close));
  root.addEventListener('mousedown', (e) => {
    if (e.target === root) close();
  });
  actions.forEach((action) => {
    root.querySelector(`[data-modal-action="${action.id}"]`)?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      button.classList.add('is-busy');
      try {
        const keepOpen = await action.onClick?.({ close, dialog });
        if (!keepOpen) close();
      } finally {
        button.classList.remove('is-busy');
      }
    });
  });
  linkLabels(dialog);
  onMount?.(dialog, close);

  const focusable = dialog.querySelector('input, select, textarea, button:not([data-modal-close])');
  (focusable || dialog.querySelector('[data-modal-close]'))?.focus({ preventScroll: true });
  return { dialog, close };
}

export function closeModal() {
  const root = $('#modalRoot');
  if (!root || root.hidden) return;
  root.hidden = true;
  root.innerHTML = '';
  activeModal?.previousFocus?.focus?.({ preventScroll: true });
  activeModal = null;
}

export const modalOpen = () => Boolean(activeModal);

/* -------------------------------------------------------------- confirm */
export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const { close } = modal({
      title,
      body: `<p style="font-size:.92rem;line-height:1.6;color:var(--ink-2)">${esc(message)}</p>`,
      actions: [
        { id: 'cancel', label: 'Cancel', onClick: () => resolve(false) },
        { id: 'ok', label: confirmLabel, cls: `btn ${danger ? 'btn--danger' : 'btn--solid'} btn--sm`, onClick: () => resolve(true) },
      ],
    });
    const observer = new MutationObserver(() => {
      if ($('#modalRoot').hidden && !answered) {
        answered = true;
        resolve(false);
        observer.disconnect();
      }
    });
    observer.observe($('#modalRoot'), { attributes: true, attributeFilter: ['hidden'] });
    void close;
  });
}

/* ---------------------------------------------------------- form errors */
export function clearFieldErrors(form) {
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  form.querySelectorAll('.field__error').forEach((el) => (el.textContent = ''));
}

export function applyFieldErrors(form, fields = {}) {
  let first = null;
  Object.entries(fields).forEach(([name, code]) => {
    const input = form.elements?.[name];
    if (!input) return;
    const target = input instanceof RadioNodeList ? null : input;
    target?.setAttribute('aria-invalid', 'true');
    const wrap = (target?.closest('.field') || target?.closest('.choice-grid')) ?? form;
    const errorNode = wrap.querySelector?.('.field__error');
    if (errorNode) errorNode.textContent = messageFor(name, code);
    if (target && !first) first = target;
  });
  first?.focus({ preventScroll: false });
  first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

const MESSAGES = {
  required: 'This field is required.',
  too_short: 'This is too short.',
  too_long: 'This is too long.',
  invalid: 'This value is not valid.',
  taken: 'That is already in use.',
  incorrect: 'That is not correct.',
  full: 'There is no space left.',
  same: 'This is already selected.',
  weak: 'Use at least 8 characters with a letter and a number.',
  missing: 'This is no longer available.',
  school_mismatch: 'You can only join a team from your own school.',
  team_mismatch: 'This must match your team’s details.',
  category_mismatch: 'Your field must match the team’s field.',
  team_full: 'This team is full.',
  below_member_count: 'This is below the number of people already on the team.',
  hand_over_first: 'Transfer leadership before leaving.',
  pending_exists: 'You already have a request awaiting review.',
  locked_by_team: 'Leave your team before changing this.',
};

const messageFor = (field, code) =>
  MESSAGES[code] || `${field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())} is invalid.`;

/**
 * Programmatically associate every visible `label` with its control.
 * Admin forms are generated from setting keys, so labels are written before
 * their inputs without ids; this pass guarantees `label[for]` everywhere
 * (which is also what screen readers rely on).
 */
let autoId = 0;
export function linkLabels(root = document) {
  root.querySelectorAll('label').forEach((label) => {
    if (label.getAttribute('for') || label.classList.contains('checkline')) return;
    let control = label.querySelector('input, select, textarea');
    if (!control) {
      let next = label.nextElementSibling;
      while (next && !control) {
        control = next.matches('input, select, textarea') ? next : next.querySelector('input, select, textarea');
        next = next.nextElementSibling;
      }
    }
    if (!control || control.type === 'hidden') return;
    if (!control.id) control.id = `f-${(autoId += 1)}`;
    label.setAttribute('for', control.id);
  });
}

/* -------------------------------------------------------------- helpers */
export function setBusy(button, busy) {
  if (!button) return;
  button.classList.toggle('is-busy', busy);
  button.disabled = busy;
}

/** Submit a form through an async handler with error surfacing + busy state. */
export function onSubmit(form, handler) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    clearFieldErrors(form);
    setBusy(submit, true);
    try {
      await handler(new FormData(form), form);
    } catch (error) {
      if (error.fields && Object.keys(error.fields).length) applyFieldErrors(form, error.fields);
      toast(error.message, 'error');
    } finally {
      setBusy(submit, false);
    }
  });
}

/** Reveal-on-scroll. One shared observer, disconnected when nodes leave. */
let revealObserver = null;
export function mountReveal(root = document) {
  const nodes = $$('.reveal:not(.is-in)', root);
  if (!nodes.length) return;
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    nodes.forEach((n) => n.classList.add('is-in'));
    return;
  }
  revealObserver ??= new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
  );
  nodes.forEach((n) => revealObserver.observe(n));
}

/** Accessible accordion behaviour for FAQ lists. */
export function mountFaq(root = document) {
  $$('[data-faq-trigger]', root).forEach((button) => {
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    if (!panel) return;
    panel.style.height = '0px';
    panel.style.transition = 'height 260ms cubic-bezier(.22,.61,.36,1)';
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!open));
      panel.style.height = open ? '0px' : `${panel.firstElementChild.scrollHeight}px`;
    });
  });
}

export function mountNavToggle() {
  const toggle = $('#navToggle');
  const nav = $('#mobileNav');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    nav.hidden = open;
    toggle.setAttribute('aria-label', open ? 'Open menu' : 'Close menu');
  });
}

export const socialIcons = {
  instagram:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2c3.2 0 3.6 0 4.9.07 1.2.06 1.8.25 2.2.42.6.22 1 .48 1.4.9.4.4.68.8.9 1.4.17.4.36 1 .42 2.2.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.06 1.2-.25 1.8-.42 2.2a3.7 3.7 0 0 1-.9 1.4 3.7 3.7 0 0 1-1.4.9c-.4.17-1 .36-2.2.42-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.06-1.8-.25-2.2-.42a3.7 3.7 0 0 1-1.4-.9 3.7 3.7 0 0 1-.9-1.4c-.17-.4-.36-1-.42-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.06-1.2.25-1.8.42-2.2.22-.6.5-1 .9-1.4.4-.4.8-.68 1.4-.9.4-.17 1-.36 2.2-.42C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.1 0-3.5 0-4.7.07-1 .04-1.5.2-1.8.33-.45.17-.77.38-1.1.72-.34.33-.55.65-.72 1.1-.13.3-.29.8-.33 1.8C3.2 8.5 3.2 8.9 3.2 12s0 3.5.07 4.7c.04 1 .2 1.5.33 1.8.17.45.38.77.72 1.1.33.34.65.55 1.1.72.3.13.8.29 1.8.33 1.2.06 1.6.07 4.7.07s3.5 0 4.7-.07c1-.04 1.5-.2 1.8-.33.45-.17.77-.38 1.1-.72.34-.33.55-.65.72-1.1.13-.3.29-.8.33-1.8.06-1.2.07-1.6.07-4.7s0-3.5-.07-4.7c-.04-1-.2-1.5-.33-1.8a3 3 0 0 0-.72-1.1 3 3 0 0 0-1.1-.72c-.3-.13-.8-.29-1.8-.33C15.5 4 15.1 4 12 4Zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8Zm0 1.8a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2Zm5.1-3a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z"/></svg>',
  facebook:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.1 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5h1.65V3.6c-.3-.04-1.3-.13-2.45-.13-2.43 0-4.1 1.48-4.1 4.2v2.24H8.2V13h2.55v8h3.35Z"/></svg>',
  youtube:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.6 7.2a2.5 2.5 0 0 0-1.75-1.77C18.25 5 12 5 12 5s-6.25 0-7.85.43A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.75 1.77C5.75 19 12 19 12 19s6.25 0 7.85-.43a2.5 2.5 0 0 0 1.75-1.77C22 15.2 22 12 22 12s0-3.2-.4-4.8ZM10 15.1V8.9l5.2 3.1-5.2 3.1Z"/></svg>',
  tiktok:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 3h-2.6v11.2a2.35 2.35 0 1 1-2-2.32V9.2a4.96 4.96 0 1 0 4.6 4.94V8.9a5.6 5.6 0 0 0 3.3 1.07V7.36a3.2 3.2 0 0 1-3.3-3.1V3Z"/></svg>',
  linkedin:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4v11H3v-11Zm6.5 0h3.8v1.5h.06a4.2 4.2 0 0 1 3.75-2c4 0 4.74 2.5 4.74 5.75v5.75h-4v-5.1c0-1.2-.02-2.75-1.7-2.75-1.7 0-1.96 1.3-1.96 2.65v5.2h-4v-11Z"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 3h3.2l-7 8 8.2 10h-6.4l-5-6.1-5.8 6.1H1.5l7.5-8.6L1.2 3h6.6l4.5 5.6L17.5 3Zm-1.1 16h1.8L7.7 4.8H5.8l10.6 14.2Z"/></svg>',
  whatsapp:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a9.9 9.9 0 0 0-8.5 15L2 22l5.1-1.4A9.9 9.9 0 1 0 12 2Zm0 1.8a8.1 8.1 0 1 1-4.2 15l-.3-.2-3 .8.8-2.9-.2-.3A8.1 8.1 0 0 1 12 3.8Zm-3.2 4c-.2 0-.5.1-.7.4-.3.3-.9.9-.9 2s.8 2.3 1 2.5c.1.2 1.6 2.5 3.9 3.4 1.9.8 2.3.6 2.7.6.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.1-.4-.2l-1.5-.7c-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1-.2-.1-.9-.3-1.7-1-.6-.5-1-1.2-1.1-1.4-.1-.2 0-.3.1-.4l.4-.4c.1-.1.1-.2.2-.4v-.3l-.7-1.6c-.2-.4-.3-.3-.5-.3h-.4Z"/></svg>',
};
