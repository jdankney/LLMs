import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { CustomProvider, Settings } from '../shared/types';
import { allProviders, setExtraProviders } from './providers';

const file = () => path.join(app.getPath('userData'), 'settings.json');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function isCustomProvider(value: unknown): value is CustomProvider {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.url === 'string' &&
    typeof value.partition === 'string' &&
    typeof value.color === 'string' &&
    Array.isArray(value.hosts) &&
    value.hosts.every((host) => typeof host === 'string') &&
    (value.base === undefined || typeof value.base === 'string') &&
    (value.icon === undefined || typeof value.icon === 'string')
  );
}

function readBounds(value: unknown): Settings['bounds'] {
  if (!isRecord(value)) return undefined;
  const { x, y, width, height } = value;
  if ([x, y, width, height].every((n) => typeof n === 'number' && Number.isFinite(n))) {
    return { x: x as number, y: y as number, width: width as number, height: height as number };
  }
  return undefined;
}

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
  let stored: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file(), 'utf8'));
    if (isRecord(parsed)) stored = parsed;
  } catch {
    // First run or unreadable file: fall back to defaults.
  }

  const base = defaults();
  const zoom: Record<string, number> = {};
  if (isRecord(stored.zoom)) {
    for (const [id, value] of Object.entries(stored.zoom)) {
      if (typeof value === 'number' && Number.isFinite(value)) zoom[id] = value;
    }
  }

  current = {
    order: stringList(stored.order),
    disabled: stringList(stored.disabled),
    custom: Array.isArray(stored.custom) ? stored.custom.filter(isCustomProvider) : [],
    split: stringList(stored.split),
    zoom,
    lastActive: typeof stored.lastActive === 'string' ? stored.lastActive : null,
    keepAliveMinutes:
      typeof stored.keepAliveMinutes === 'number' && Number.isFinite(stored.keepAliveMinutes)
        ? stored.keepAliveMinutes
        : base.keepAliveMinutes,
    nativeFrame: typeof stored.nativeFrame === 'boolean' ? stored.nativeFrame : base.nativeFrame,
    bounds: readBounds(stored.bounds),
    maximized: typeof stored.maximized === 'boolean' ? stored.maximized : undefined,
  };
  setExtraProviders(current.custom);

  // Drop ids that no longer exist and append providers added in an update.
  const all = allProviders();
  const known = new Set(all.map((p) => p.id));
  current.order = [...new Set(current.order.filter((id) => known.has(id)))];
  for (const p of all) if (!current.order.includes(p.id)) current.order.push(p.id);
  current.disabled = [...new Set(current.disabled.filter((id) => known.has(id)))];
  current.split = [...new Set(current.split.filter((id) => known.has(id) && !current.disabled.includes(id)))];
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
