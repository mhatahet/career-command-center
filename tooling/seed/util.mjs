/**
 * Shared helpers for the seed authors.
 *
 * Two rules everything here obeys:
 *  1. Deterministic — re-running the seed produces byte-identical files, so a
 *     reseed is a diffable operation rather than a mystery.
 *  2. Date-relative — every date derives from PROGRAMME_START, so shifting the
 *     start date moves the whole plan coherently.
 */

/** Day the 24-month programme begins. Everything else is relative to this. */
export const PROGRAMME_START = '2026-07-01'

/** "Today" as the seed understands it. Kept explicit so output stays reproducible. */
export const SEED_TODAY = '2026-07-30'

export const HORIZON_MONTHS = 24

/* ----------------------------------------------------------------- dates -- */

/** Parse `YYYY-MM-DD` into a UTC-noon Date, which sidesteps DST edge cases. */
export function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

export function toISO(date) {
  return date.toISOString().slice(0, 10)
}

export function addDays(iso, days) {
  const d = parseDate(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return toISO(d)
}

export function addMonths(iso, months) {
  const d = parseDate(iso)
  d.setUTCMonth(d.getUTCMonth() + months)
  return toISO(d)
}

/** First day of programme month `n` (1-based). */
export function monthStart(n) {
  return addMonths(PROGRAMME_START, n - 1)
}

/** Last day of programme month `n` (1-based). */
export function monthEnd(n) {
  return addDays(addMonths(PROGRAMME_START, n), -1)
}

export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000)
}

/** A stable timestamp derived from a date, so seeds never call Date.now(). */
export function stampAt(iso, hour = 19, minute = 30) {
  const hh = String(hour).padStart(2, '0')
  const mm = String(minute).padStart(2, '0')
  return `${iso}T${hh}:${mm}:00.000Z`
}

/* -------------------------------------------------------------- randomness */

/**
 * Seeded PRNG (mulberry32). Used only to give charts lifelike texture —
 * activity hours, impression counts. Deterministic by construction.
 */
export function rng(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pick(random, list) {
  return list[Math.floor(random() * list.length)]
}

export function round(n, places = 1) {
  const f = 10 ** places
  return Math.round(n * f) / f
}

/* --------------------------------------------------------------------- ids */

/** Slugify a label into a readable, stable id. */
export function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

/** Namespaced id, e.g. `sk_product-sense`. Prefix makes types obvious in JSON. */
export function id(prefix, label) {
  return `${prefix}_${slug(label)}`
}

/** Sequential id for rows without a natural name, e.g. `t_m01_003`. */
export function seqId(prefix, n, width = 3) {
  return `${prefix}${String(n).padStart(width, '0')}`
}
