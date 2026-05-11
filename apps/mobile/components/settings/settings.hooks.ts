import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getI18nKeyForEnglishText, translateText } from '@mindwtr/core';

import { useLanguage } from '@/contexts/language-context';

import { styles } from './settings.styles';

export function useSettingsLocalization() {
    const { language, t, setLanguage } = useLanguage();
    const isChineseLanguage = language === 'zh' || language === 'zh-Hant';
    const localize = useMemo(
        () => (enText: string, zhText?: string) => {
            const key = getI18nKeyForEnglishText(enText);
            if (key) {
                const translated = t(key);
                if (translated && translated !== key) return translated;
            }
            if (language === 'zh' && zhText) return zhText;
            return translateText(enText, language);
        },
        [language, t],
    );

    return {
        isChineseLanguage,
        language,
        localize,
        setLanguage,
        t,
    };
}

export function useSettingsScrollContent(paddingBottom = 16) {
    const insets = useSafeAreaInsets();

    return useMemo(
        () => [styles.scrollContent, { paddingBottom: paddingBottom + insets.bottom }],
        [insets.bottom, paddingBottom],
    );
}
