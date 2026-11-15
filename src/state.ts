const KEY = 'calmtv';

export interface Persist {
  /** Index of the selected wallpaper. */
  wp: number;
  /** Thermostat set point, in degrees. */
  setpoint: number;
  /** Background: a photo, or a looping video clip. */
  bg: 'photo' | 'video';
  /** Index of the selected video clip (older saves only; see vidName). */
  vid: number;
  /** Name of the selected video clip, so adding or removing clips doesn't change the choice. */
  vidName: string;
}

const defaults: Persist = { wp: 0, setpoint: 66, bg: 'photo', vid: 0, vidName: '' };

export function load(): Persist {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Persist>;
      return {
        wp: typeof p.wp === 'number' ? p.wp : defaults.wp,
        setpoint: typeof p.setpoint === 'number' ? p.setpoint : defaults.setpoint,
        bg: p.bg === 'video' ? 'video' : 'photo',
        vid: typeof p.vid === 'number' ? p.vid : defaults.vid,
        vidName: typeof p.vidName === 'string' ? p.vidName : defaults.vidName,
      };
    }
  } catch {
    /* ignore */
  }
  return { ...defaults };
}

export function save(p: Persist): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
