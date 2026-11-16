/**
 * Thin fetch wrapper with a typed error. All state lives on the server; this
 * module never persists anything to localStorage — that was the original bug.
 */
export class ApiError extends Error {
  constructor(message, { status = 0, fields = {}, code = 'error' } = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
    this.code = code;
  }
}

let inflight = new Map();

export async function api(path, { method = 'GET', body, silent = false } = {}) {
  const key = `${method} ${path}`;
  const options = {
    method,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`/api${path}`, options);
  } catch {
    throw new ApiError('Network unavailable. Check your connection and try again.', { code: 'offline' });
  }

  const isJson = (response.headers.get('content-type') || '').includes('application/json');
  const payload = isJson ? await response.json().catch(() => ({})) : {};

  if (!response.ok || payload.ok === false) {
    throw new ApiError(payload.error || `Request failed (${response.status}).`, {
      status: response.status,
      fields: payload.fields || {},
      code: payload.code || 'error',
    });
  }
  return payload;
}

export const get = (path) => api(path);
export const post = (path, body) => api(path, { method: 'POST', body });
export const patch = (path, body) => api(path, { method: 'PATCH', body });
export const put = (path, body) => api(path, { method: 'PUT', body });
export const del = (path, body) => api(path, { method: 'DELETE', body });

/**
 * Public content cache: exactly one request per page load. The server also
 * embeds a copy in the document so the header/footer can paint before this
 * resolves (see store.js) — that copy lacks lists, so we always fetch once here.
 */
let contentPromise = null;

export function loadContent({ force = false } = {}) {
  if (!contentPromise || force) contentPromise = fetchContent();
  return contentPromise;
}

function fetchContent() {
  return api('/content').catch((error) => {
    contentPromise = null;
    throw error;
  });
}

export function invalidateContent() {
  contentPromise = null;
}

export function download(path) {
  const a = document.createElement('a');
  a.href = `/api${path}`;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
}
