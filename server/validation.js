/**
 * Server-side validation. Every rule the browser enforces is repeated here,
 * because the browser can be bypassed and the database cannot.
 */

export class ValidationError extends Error {
  constructor(message, fields = {}) {
    super(message);
    this.status = 422;
    this.code = 'validation_failed';
    this.fields = fields;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export const str = (value, { min = 0, max = 200, field = 'value', required = false } = {}) => {
  const out = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!out && required) throw new ValidationError(`${field} is required.`, { [field]: 'required' });
  if (out.length > max) throw new ValidationError(`${field} must be under ${max} characters.`, { [field]: 'too_long' });
  if (out && out.length < min) throw new ValidationError(`${field} must be at least ${min} characters.`, { [field]: 'too_short' });
  return out;
};

export const multiline = (value, { max = 8000, field = 'text' } = {}) => {
  const out = String(value ?? '').replace(/\r\n/g, '\n').trim();
  if (out.length > max) throw new ValidationError(`${field} is too long (${max} max).`, { [field]: 'too_long' });
  return out;
};

export const email = (value, field = 'Email') => {
  const out = String(value ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(out) || out.length > 160) {
    throw new ValidationError('Enter a valid email address.', { email: 'invalid' });
  }
  return out;
};

export const password = (value) => {
  const out = String(value ?? '');
  if (out.length < 8) throw new ValidationError('Password must be at least 8 characters.', { password: 'too_short' });
  if (out.length > 200) throw new ValidationError('Password is too long.', { password: 'too_long' });
  if (!/[a-zA-Z]/.test(out) || !/[0-9]/.test(out)) {
    throw new ValidationError('Password needs at least one letter and one number.', { password: 'weak' });
  }
  return out;
};

export const phone = (value) => {
  const out = String(value ?? '').trim();
  if (!out) return '';
  if (!/^[+()\-\s0-9]{6,24}$/.test(out)) throw new ValidationError('Enter a valid phone number.', { phone: 'invalid' });
  return out;
};

export const url = (value, { field = 'URL', allowEmpty = true } = {}) => {
  const out = String(value ?? '').trim();
  if (!out) {
    if (allowEmpty) return '';
    throw new ValidationError(`${field} is required.`, { [field]: 'required' });
  }
  if (out.startsWith('data:')) {
    // Inline SVG data URLs are the only inline format we accept (favicon).
    if (!/^data:image\/(png|jpeg|svg\+xml|webp|x-icon);base64,/i.test(out)) {
      throw new ValidationError(`${field} has an unsupported format.`, { [field]: 'invalid' });
    }
    return out;
  }
  // Uploaded assets use a same-origin URL. Accept only the database asset
  // endpoint and committed /assets files; reject arbitrary relative paths.
  if (out.startsWith('/')) {
    const safeAssetPath =
      /^\/api\/assets\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(out) ||
      /^\/assets\/[a-z0-9._/-]+$/i.test(out);
    if (safeAssetPath && !out.split('/').includes('..')) return out;
    throw new ValidationError(`${field} must be a valid same-site asset path or full URL.`, { [field]: 'invalid' });
  }
  let parsed;
  try {
    parsed = new URL(out);
  } catch {
    throw new ValidationError(`${field} must be a full URL.`, { [field]: 'invalid' });
  }
  if (!['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
    throw new ValidationError(`${field} must use http or https.`, { [field]: 'invalid' });
  }
  return parsed.toString();
};

export const int = (value, { min = 0, max = 100000, field = 'value' } = {}) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ValidationError(`${field} must be a whole number between ${min} and ${max}.`, { [field]: 'range' });
  }
  return n;
};

export const oneOf = (value, allowed, field = 'value') => {
  if (!allowed.includes(value)) throw new ValidationError(`Choose a valid ${field}.`, { [field]: 'invalid' });
  return value;
};

export const bool = (value) => value === true || value === 'true' || value === 'on' || value === 1;

export const slug = (value, field = 'slug') => {
  const out = String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);
  if (!out) throw new ValidationError('That name cannot be turned into a link.', { [field]: 'invalid' });
  return out;
};

/** Reject a submission with a 409 when the client's row version is stale. */
export function assertVersion(current, provided) {
  if (provided === undefined || provided === null) return;
  if (String(current) !== String(provided)) {
    const error = new ValidationError('This record changed while you were editing. Reload and try again.');
    error.status = 409;
    error.code = 'stale';
    throw error;
  }
}
