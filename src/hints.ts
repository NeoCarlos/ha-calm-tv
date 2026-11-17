import { dashboardMode } from './config';

// Every bit of on-screen wording that names the remote's keys, next to what it says on a touch
// screen (the Home Assistant dashboard, see docs/dashboard.md). Keeping them together means a new
// feature's hint can't forget the dashboard: add a pair here and use hint('name').

const HINTS = {
  doorbellClose: ['Back to dismiss', 'Tap to close'],
  signIn: ['Press OK to sign in', 'Tap to sign in'],
  signInRow: ['Not signed in · OK to sign in', 'Not signed in · tap to sign in'],
  signOutAgain: ['Press OK again to sign out', 'Tap again to sign out'],
  chooseBackgroundRow: [' · OK to choose', ''],
  backgroundPicker: ['OK to choose · Back when done', 'Tap to choose'],
  closeControl: ['Back to close', 'Tap outside to close'],
  thermostat: ['▲ ▼ to adjust · Back to close', 'Tap outside to close'],
  scenes: ['▲ ▼ to choose · OK to set · Back to close', 'Tap a scene to set it'],
  dimmer: ['◀ ▶ brightness · OK on/off', 'Drag the bar to dim · tap the name to switch'],
  musicClose: ['Back to close', 'Close'],
  musicUp: ['Back to go back', 'Back'],
  musicDone: ['Back when done', 'Done'],
  groupSpeakers: ['OK to add or remove · Back when done', 'Tap to add or remove'],
} as const satisfies Record<string, readonly [remote: string, touch: string]>;

/** The wording `name`, for the remote on the TV or for touch on the dashboard. */
export const hint = (name: keyof typeof HINTS): string => HINTS[name][dashboardMode ? 1 : 0];
