import { existsSync } from 'fs';
import { homedir } from 'os';
import { join, resolve } from 'path';

const APP_ID = 'tech.dongdongbh.mindwtr';
const APP_DIR = 'mindwtr';

function getLinuxConfigHome() {
  return process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
}

function getLinuxDataHome() {
  return process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share');
}

function getWindowsAppDataHome() {
  return process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
}

function getMacAppSupportHome() {
  return join(homedir(), 'Library', 'Application Support');
}

function getConfigHome(): string {
  const platform = process.platform;
  if (platform === 'win32') return getWindowsAppDataHome();
  if (platform === 'darwin') return getMacAppSupportHome();
  return getLinuxConfigHome();
}

function getDataHome(): string {
  const platform = process.platform;
  if (platform === 'win32') return getWindowsAppDataHome();
  if (platform === 'darwin') return getMacAppSupportHome();
  return getLinuxDataHome();
}

function firstExisting(paths: string[]): string | null {
  for (const candidate of paths) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function resolveMindwtrDbPath(overridePath?: string): string {
  const explicit = overridePath || process.env.MINDWTR_DB_PATH || process.env.MINDWTR_DB;
  if (explicit) return resolve(explicit);

  const configHome = getConfigHome();
  const dataHome = getDataHome();
  const candidates = [
    join(dataHome, APP_DIR, 'mindwtr.db'),
    join(configHome, APP_DIR, 'mindwtr.db'),
    join(dataHome, APP_ID, 'mindwtr.db'),
    join(configHome, APP_ID, 'mindwtr.db'),
  ];

  return firstExisting(candidates) || candidates[0];
}
