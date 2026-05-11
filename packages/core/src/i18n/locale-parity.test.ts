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
import { hasTranslatableEnglishText } from './locale-quality';

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

const nonLatinOverrideLocales: Record<string, Record<string, string>> = {
    ar: arOverrides,
    hi: hiOverrides,
    ja: jaOverrides,
    ko: koOverrides,
    ru: ruOverrides,
};

const shippedLocales: Record<string, Record<string, string>> = {
    ...fullParityLocales,
    ...overrideLocales,
};

describe('locale parity', () => {
    it('keeps full-translation locales in key parity with English', () => {
        const englishKeys = Object.keys(en);

        for (const [language, translations] of Object.entries(fullParityLocales)) {
            const missing = englishKeys.filter((key) => !translations[key]);
            expect(missing, `Missing translations in ${language}`).toEqual([]);
        }
    });

    it('keeps shipped locales limited to known English keys', () => {
        const englishKeys = new Set(Object.keys(en));

        for (const [language, translations] of Object.entries(shippedLocales)) {
            const unknown = Object.keys(translations).filter((key) => !englishKeys.has(key));
            expect(unknown, `Unknown translation keys in ${language}`).toEqual([]);
        }
    });

    it('does not hide untranslated copy behind verbatim English placeholders', () => {
        for (const [language, translations] of Object.entries(shippedLocales)) {
            const placeholders = Object.keys(translations).filter((key) => (
                translations[key] === en[key] && hasTranslatableEnglishText(en[key])
            ));
            expect(placeholders, `Verbatim English placeholders in ${language}`).toEqual([]);
        }
    });

    it('does not ship mixed English fragments in non-Latin partial locales', () => {
        for (const [language, translations] of Object.entries(nonLatinOverrideLocales)) {
            const mixedEnglish = Object.keys(translations).filter((key) => (
                hasTranslatableEnglishText(translations[key])
            ));
            expect(mixedEnglish, `Mixed English fragments in ${language}`).toEqual([]);
        }
    });
});
