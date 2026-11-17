/**
 * School-name matching.
 *
 * Teams are scoped to a school: you may only join a team from the school you
 * registered under. The naive implementation compares the two strings with
 * `lower()`, which fails on differences that mean nothing to a human — a campus
 * suffix, a comma, "The", or the city appended after the name. The student then
 * gets "You can only join a team from your own school" while looking at a team
 * from their own school, and there is no way forward.
 *
 * The rule here is deliberately conservative in one direction only: differences
 * that cannot change which school is meant are normalised away; anything that
 * could name a different school is kept. So "Peshawar Public School" and
 * "Peshawar Model School" stay different — silently merging them would let a
 * student join a team from another school, which is a worse failure than the one
 * being fixed.
 */

/**
 * Words that describe what KIND of institution it is, not which one.
 *
 * This list is deliberately short. Dropping words like "public", "model" or a
 * city name looks like harmless tidying and is not: it collapses "Peshawar Model
 * School" and "Warsak Model School" to the same key, which would let a student
 * join a team from a different school. Only genuine type-words are removed.
 */
const TYPE_WORDS = new Set([
  'the',
  'school',
  'scl',
  'sch',
  'system',
  'campus',
  'branch',
  'for',
  'and',
  'of',
  '&',
]);

/**
 * Reduce a school name to its identifying words, dropping parentheticals.
 *
 * "Peshawar Model School (Warsak Road)" -> "peshawar model"
 * "The Peshawar Model School, Peshawar" -> "peshawar model peshawar"
 *
 * A campus note in brackets is a location, not a different school, so it goes.
 * Everything outside brackets is kept, because it is what tells two schools
 * apart.
 */
export function schoolKey(name) {
  const words = String(name ?? '')
    .toLowerCase()
    .normalize('NFKD')
    // drop diacritics rather than the letters carrying them
    .replace(/[\u0300-\u036f]/g, '')
    // parenthetical campus notes: "(Warsak Road)", "[Campus 2]"
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9&]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .filter((w) => !TYPE_WORDS.has(w));

  return words.join(' ');
}

/** Falls back to the full normalised string if nothing identifying survives. */
function keyFor(name) {
  const key = schoolKey(name);
  if (key) return key;
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * True when two names refer to the same school.
 *
 * Exact match on the identifying words, or one being a clean word-boundary
 * prefix of the other ("model" vs "model science"). Prefix matching is what
 * handles "…Model School" against "…Model School & College" without letting
 * "model" match "modern".
 */
export function sameSchool(a, b) {
  const ka = keyFor(a);
  const kb = keyFor(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;

  const [short, long] = ka.length <= kb.length ? [ka, kb] : [kb, ka];
  if (short.length < 3) return false;
  // must match on a word boundary, not mid-word
  return long.startsWith(`${short} `);
}

/**
 * The value stored on a team when a leader registers.
 *
 * Kept as the student typed it: normalising on write would discard information
 * the organisers need on the printed roster.
 */
export const displaySchool = (name) => String(name ?? '').trim().replace(/\s+/g, ' ');
