import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { Settings } from '../types.js';
import { DEFAULT_SETTINGS } from './defaults.js';

const CONFIG_PATH = resolve(process.cwd(), 'data/config.json');

let cached: Settings | null = null;

export function getSettings(): Settings {
  if (cached) return cached;

  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = readFileSync(CONFIG_PATH, 'utf-8');
      cached = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      return cached!;
    } catch {
      // fall through to defaults
    }
  }

  cached = { ...DEFAULT_SETTINGS };
  saveSettings(cached);
  return cached;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const current = getSettings();
  cached = { ...current, ...patch };
  saveSettings(cached);
  return cached;
}

function saveSettings(settings: Settings): void {
  const dir = dirname(CONFIG_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(settings, null, 2), 'utf-8');
}
