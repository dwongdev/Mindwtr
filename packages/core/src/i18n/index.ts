export type { Language } from './i18n-types';
export { translateText } from './i18n-translate';

export type TranslateFn = (key: string) => string;

export function translateWithFallback(t: TranslateFn, key: string, fallback: string): string {
    const translated = t(key);
    return translated && translated !== key ? translated : fallback;
}

export function formatI18nTemplate(
    template: string,
    values: Record<string, string | number | boolean | null | undefined>,
): string {
    return template.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (match, key: string) => (
        Object.prototype.hasOwnProperty.call(values, key)
            ? String(values[key] ?? '')
            : match
    ));
}

export const tFallback = translateWithFallback;
