/**
 * Session + content state. The server is the source of truth; this module only
 * mirrors the latest response so views can render synchronously.
 *
 * "Registered" status is deliberately NOT stored in the browser: it is derived
 * from the session cookie on every load, so it survives refreshes, restarts and
 * different devices signed into the same account.
 */
import { api, loadContent } from './api.js';

const listeners = new Set();

export const state = {
  ready: false,
  student: null,
  admin: null,
  registration: {},
  content: null,
  online: navigator.onLine,
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  listeners.forEach((fn) => fn(state));
}

/** Content embedded by the server at render time — used for the first paint. */
function embeddedContent() {
  const node = document.getElementById('boot-content');
  if (!node) return null;
  try {
    const parsed = JSON.parse(node.textContent || 'null');
    return parsed && parsed.site ? parsed : null;
  } catch {
    return null;
  }
}

let booted = false;

export async function boot() {
  const inline = embeddedContent();
  // The embedded payload is complete, so it is a real first paint rather than
  // a placeholder. It is only used before the network copy arrives.
  if (inline && !booted) state.content = inline;
  booted = true;
  const [content, me] = await Promise.allSettled([loadContent(), api('/me')]);
  if (content.status === 'fulfilled') state.content = content.value;
  if (me.status === 'fulfilled') {
    state.student = me.value.student;
    state.admin = me.value.admin;
    state.registration = me.value.registration || {};
    // Session genuinely ended (expired cookie AND dead token) — forget the
    // fallback so we do not keep replaying a token the server rejects.
    if (!me.value.student && !me.value.admin) {
      try {
        sessionStorage.removeItem('orbit=student');
        sessionStorage.removeItem('orbit=admin');
      } catch {
        /* ignore */
      }
    }
  }
  state.ready = true;
  emit();
  return state;
}

export function setStudent(student) {
  state.student = student;
  emit();
}

export function setAdmin(admin) {
  state.admin = admin;
  emit();
}

export function setContent(content) {
  state.content = content;
  emit();
}

export const isStudent = () => Boolean(state.student);
export const isAdmin = () => Boolean(state.admin);
export const registrationOpen = () => {
  const reg = state.registration?.open ?? state.content?.registration?.open;
  return reg !== false;
};

export async function refreshStudent() {
  const me = await api('/me');
  state.student = me.student;
  state.admin = me.admin;
  state.registration = me.registration || {};
  emit();
  return state.student;
}

export async function refreshContent() {
  const { invalidateContent } = await import('./api.js');
  invalidateContent();
  state.content = await loadContent({ force: true });
  emit();
  return state.content;
}

export function onStatusChange(callback) {
  window.addEventListener('online', () => {
    state.online = true;
    emit();
    callback?.(true);
  });
  window.addEventListener('offline', () => {
    state.online = false;
    emit();
    callback?.(false);
  });
}

/** Fill header/footer auth affordances without a full re-render. */
export function syncChrome() {
  const student = state.student;
  document.querySelectorAll('[data-auth-in]').forEach((node) => {
    node.hidden = !student;
  });
  document.querySelectorAll('[data-auth-out]').forEach((node) => {
    node.hidden = Boolean(student);
  });
  const registerLink = document.querySelector('[data-register-link]');
  if (registerLink) {
    const open = registrationOpen();
    registerLink.textContent = open ? 'Register' : 'Registration closed';
    registerLink.classList.toggle('is-closed', !open);
    const arrow = document.createElement('span');
    arrow.className = 'btn__arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    registerLink.append(arrow);
  }
  document.querySelectorAll('[data-student-name]').forEach((n) => {
    n.textContent = student ? student.name.split(' ')[0] : '';
  });
}
