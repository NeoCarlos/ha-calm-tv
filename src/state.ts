import * as v from 'valibot';

const KEY = 'calmtv';

/**
 * What the app remembers between starts (in localStorage). Decoded with fallbacks, so a missing
 * or damaged value falls back to its default without losing the others.
 */
const PersistSchema = v.object({
  /** Index of the selected photo (older saves only; see wpName). */
  wp: v.fallback(v.number(), 0),
  /** Name of the selected photo, so adding or removing photos doesn't change the choice. */
  wpName: v.fallback(v.string(), ''),
  /** Thermostat set point, in degrees. */
  setpoint: v.fallback(v.number(), 66),
  /** Index of the selected video clip (older saves only; see vidName). */
  vid: v.fallback(v.number(), 0),
  /** Name of the selected video clip, so adding or removing clips doesn't change the choice. */
  vidName: v.fallback(v.string(), ''),
});

export type Persist = v.InferOutput<typeof PersistSchema>;

export function load(): Persist {
  let saved = null;

  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    /* unreadable: start from the defaults */
  }

  return v.parse(PersistSchema, saved ?? {});
}

export function save(p: Persist): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
