import { describe, expect, it } from 'vitest';
import { arOverrides } from './locales/ar';
import { deOverrides } from './locales/de';
import { en } from './locales/en';
import { esOverrides } from './locales/es';
import { frOverrides } from './locales/fr';
import { hiOverrides } from './locales/hi';
import { itOverrides } from './locales/it';
import { jaOverrides } from './locales/ja';
import { koOverrides } from './locales/ko';
import { nlOverrides } from './locales/nl';
import { plOverrides } from './locales/pl';
import { ptOverrides } from './locales/pt';
import { ruOverrides } from './locales/ru';
import { trOverrides } from './locales/tr';
import { zhHans } from './locales/zh-Hans';
import { zhHant } from './locales/zh-Hant';
import { acceptedLocaleFallbacks } from './locale-fallbacks';

const fullParityLocales: Record<string, Record<string, string>> = {
    zh: zhHans,
    'zh-Hant': zhHant,
};

const overrideLocales: Record<string, Record<string, string>> = {
    ar: arOverrides,
    de: deOverrides,
    es: esOverrides,
    fr: frOverrides,
    hi: hiOverrides,
    it: itOverrides,
    ja: jaOverrides,
    ko: koOverrides,
    nl: nlOverrides,
    pl: plOverrides,
    pt: ptOverrides,
    ru: ruOverrides,
    tr: trOverrides,
};

const reviewedFallbackRegressionKeys = [
    'calendar.invalidTimeRange',
    'calendar.enterTaskTitle',
    'calendar.chooseTask',
    'calendar.saveTaskFailed',
    'calendar.noFreeTimeTitle',
    'calendar.timeConflictTitle',
    'calendar.cannotOpenEventTitle',
    'calendar.openDeviceEventOnly',
    'calendar.openUnsupported',
    'calendar.openFromCalendarApp',
    'share.unavailable',
    'share.readFailed',
    'shortcuts.captureUnavailable',
    'shortcuts.missingTitle',
    'settings.menuDesc.general',
    'settings.menuDesc.gtd',
    'settings.menuDesc.manage',
    'settings.menuDesc.notifications',
    'settings.menuDesc.sync',
    'settings.menuDesc.data',
    'settings.menuDesc.advanced',
    'settings.menuDesc.about',
    'settings.menuDesc.ai',
    'settings.menuDesc.calendar',
    'settings.notificationsDisabled',
    'settings.notificationsDisabledMessage',
    'settings.startDateNotifications',
    'settings.startDateNotificationsDesc',
    'settings.dueDateNotifications',
    'settings.dueDateNotificationsDesc',
    'common.rename',
    'common.name',
    'settings.deleteNamed',
    'settings.unassignedAreaColor',
    'settings.unassignedAreaColorDesc',
    'contexts.empty',
    'tags.title',
    'areas.edit',
] as const;

describe('locale parity', () => {
    it('keeps every shipped locale in key parity with English or an explicit fallback allowlist', () => {
        const englishKeys = Object.keys(en);
        const shippedLocales = {
            ...fullParityLocales,
            ...overrideLocales,
        };

        for (const [language, translations] of Object.entries(shippedLocales)) {
            const acceptedFallbacks = new Set(acceptedLocaleFallbacks[language] ?? []);
            const missing = englishKeys.filter((key) => !translations[key] && !acceptedFallbacks.has(key));
            expect(missing, `Missing translations in ${language}`).toEqual([]);

            const staleFallbacks = Array.from(acceptedFallbacks)
                .filter((key) => translations[key] || !englishKeys.includes(key));
            expect(staleFallbacks, `Stale accepted fallbacks in ${language}`).toEqual([]);
        }
    });

    it('does not hide reviewed fallback keys behind verbatim English placeholders', () => {
        for (const [language, translations] of Object.entries(overrideLocales)) {
            const placeholders = reviewedFallbackRegressionKeys.filter((key) => translations[key] === en[key]);
            expect(placeholders, `Verbatim English placeholders in ${language}`).toEqual([]);
        }
    });

    it('only allowlists fallbacks for shipped non-English locales', () => {
        const shippedLocaleKeys = new Set([
            ...Object.keys(fullParityLocales),
            ...Object.keys(overrideLocales),
        ]);
        for (const language of Object.keys(acceptedLocaleFallbacks)) {
            expect(shippedLocaleKeys.has(language), `Unknown locale fallback allowlist: ${language}`).toBe(true);
        }
    });
});
