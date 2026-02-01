import type { AppData } from '@mindwtr/core';

export type DesktopThemeMode = 'system' | 'light' | 'dark' | 'eink' | 'nord' | 'sepia';

export const THEME_STORAGE_KEY = 'mindwtr-theme';

const isDesktopThemeMode = (value: string | null | undefined): value is DesktopThemeMode => (
    value === 'system'
    || value === 'light'
    || value === 'dark'
    || value === 'eink'
    || value === 'nord'
    || value === 'sepia'
);

export const coerceDesktopThemeMode = (value: string | null | undefined): DesktopThemeMode | null => {
    if (!value) return null;
    if (isDesktopThemeMode(value)) return value;
    if (value === 'material3-dark' || value === 'oled') return 'dark';
    if (value === 'material3-light') return 'light';
    return null;
};

export const mapSyncedThemeToDesktop = (value: AppData['settings']['theme'] | null | undefined): DesktopThemeMode | null => {
    if (!value) return null;
    if (isDesktopThemeMode(value)) return value;
    if (value === 'material3-dark' || value === 'oled') return 'dark';
    if (value === 'material3-light') return 'light';
    return null;
};

export const applyThemeMode = (mode: DesktopThemeMode | null) => {
    const root = document.documentElement;
    root.classList.remove('theme-eink', 'theme-nord', 'theme-sepia');

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (mode === 'system' || mode === null) {
        root.classList.toggle('dark', prefersDark);
    } else if (mode === 'dark' || mode === 'nord') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }

    if (mode === 'eink') root.classList.add('theme-eink');
    if (mode === 'nord') root.classList.add('theme-nord');
    if (mode === 'sepia') root.classList.add('theme-sepia');
};

export const resolveNativeTheme = (mode: DesktopThemeMode | null): 'light' | 'dark' | null => {
    if (!mode || mode === 'system') return null;
    if (mode === 'dark' || mode === 'nord') return 'dark';
    return 'light';
};
