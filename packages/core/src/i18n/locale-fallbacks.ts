const insecureHttpFallbacks = [
    'settings.allowInsecureHttp',
    'settings.allowInsecureHttpHint',
    'settings.cleartextSyncWarningWebdav',
    'settings.cleartextSyncWarningCloud',
] as const;

export const acceptedLocaleFallbacks: Partial<Record<string, readonly string[]>> = {
    ar: insecureHttpFallbacks,
    de: insecureHttpFallbacks,
    es: insecureHttpFallbacks,
    fr: insecureHttpFallbacks,
    hi: insecureHttpFallbacks,
    it: insecureHttpFallbacks,
    ja: insecureHttpFallbacks,
    ko: insecureHttpFallbacks,
    nl: insecureHttpFallbacks,
    pl: insecureHttpFallbacks,
    pt: insecureHttpFallbacks,
    ru: insecureHttpFallbacks,
    tr: insecureHttpFallbacks,
};
