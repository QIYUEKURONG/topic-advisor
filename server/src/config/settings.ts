import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import type { Settings } from '../types.js';
import { DEFAULT_SETTINGS } from './defaults.js';

function getConfigPath(): string {
  if (process.env.TOPIC_ADVISOR_DATA) {
    return join(process.env.TOPIC_ADVISOR_DATA, 'config.json');
  }
  if (process.env.NODE_ENV === 'production') {
    return join(homedir(), '.topic-advisor', 'config.json');
  }
  return join(process.cwd(), 'data', 'config.json');
}

const CONFIG_PATH = getConfigPath();

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
