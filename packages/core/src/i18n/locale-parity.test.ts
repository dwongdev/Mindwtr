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

const recurrenceEndKeys = [
    'recurrence.endsLabel',
    'recurrence.endsNever',
    'recurrence.endsOnDate',
    'recurrence.endsAfterCount',
    'recurrence.occurrenceUnit',
] as const;

const locales: Record<string, Record<string, string>> = {
    en,
    zh: zhHans,
    'zh-Hant': zhHant,
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

describe('locale parity', () => {
    it('defines recurrence end-condition copy for every shipped language', () => {
        for (const [language, translations] of Object.entries(locales)) {
            for (const key of recurrenceEndKeys) {
                expect(
                    translations[key],
                    `Missing ${key} in ${language}`
                ).toBeTruthy();
            }
        }
    });
});
