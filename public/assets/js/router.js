/**
 * Hash router. Hash routing keeps the app deployable as a single Node service
 * (or static host + API) without server-side route rewriting.
 */
const routes = [];
let fallback = null;
let hook = null;

export function route(pattern, handler) {
  const keys = [];
  const regex = new RegExp(
    `^${pattern
      .replace(/\/$/, '')
      .replace(/\./g, '\\.')
      .replace(/:(\w+)/g, (_, key) => {
        keys.push(key);
        return '([^/]+)';
      })}/?$`,
  );
  routes.push({ regex, keys, handler });
}

export function setFallback(handler) {
  fallback = handler;
}

export function beforeNavigate(fn) {
  hook = fn;
}

export function currentPath() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return `/${hash}`.replace(/\/+$/, '') || '/';
}

export function parseQuery(path) {
  const [, queryString = ''] = path.split('?');
  return new URLSearchParams(queryString);
}

export function navigate(to, { replace = false } = {}) {
  const target = to.startsWith('#') ? to : `#${to}`;
  if (replace) window.location.replace(target);
  else window.location.hash = target.slice(1);
}

let running = false;

export async function resolve() {
  const full = currentPath();
  const [pathOnly] = full.split('?');
  const query = parseQuery(full);
  const clean = pathOnly || '/';

  for (const entry of routes) {
    const match = entry.regex.exec(clean);
    if (!match) continue;
    const params = Object.fromEntries(entry.keys.map((key, i) => [key, decodeURIComponent(match[i + 1])]));
    running = true;
    try {
      if (hook) await hook(clean, params, query);
      await entry.handler(params, query);
    } finally {
      running = false;
    }
    return;
  }
  if (fallback) await fallback();
}

export const isResolving = () => running;
