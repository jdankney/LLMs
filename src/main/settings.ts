import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { Settings } from '../shared/types';
import { allProviders, setExtraProviders } from './providers';

const file = () => path.join(app.getPath('userData'), 'settings.json');

const defaults = (): Settings => ({
  order: allProviders().map((p) => p.id),
  disabled: [],
  custom: [],
  split: [],
  zoom: {},
  lastActive: null,
  keepAliveMinutes: 30,
  nativeFrame: false,
});

let current: Settings;
let saveTimer: NodeJS.Timeout | undefined;

export function loadSettings(): Settings {
  let stored: Partial<Settings> = {};
  try {
    stored = JSON.parse(fs.readFileSync(file(), 'utf8'));
  } catch {
    // First run or unreadable file: fall back to defaults.
  }
  current = { ...defaults(), ...stored };
  setExtraProviders(current.custom);

  // Drop ids that no longer exist and append providers added in an update.
  const all = allProviders();
  const known = new Set(all.map((p) => p.id));
  current.order = current.order.filter((id) => known.has(id));
  for (const p of all) if (!current.order.includes(p.id)) current.order.push(p.id);
  current.disabled = current.disabled.filter((id) => known.has(id));
  current.split = current.split.filter((id) => known.has(id) && !current.disabled.includes(id));
  if (current.split.length < 2) current.split = [];
  return current;
}

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  current = { ...current, ...patch };
  if (patch.custom) setExtraProviders(current.custom);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 300);
  return current;
}

export function saveNow(): void {
  clearTimeout(saveTimer);
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), JSON.stringify(current, null, 2));
  } catch (err) {
    console.error('Failed to save settings', err);
  }
}
