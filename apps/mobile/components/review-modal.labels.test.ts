import { describe, expect, it } from 'vitest';

import { getReviewLabels } from './review-modal.labels';

describe('review modal labels', () => {
    it('uses typed i18n keys instead of the old Chinese-only table', () => {
        const translations: Record<string, string> = {
            'nav.calendar': '日曆',
            'nav.inbox': '收件匣',
            'review.aiStep': 'AI 洞察',
            'review.waitingStep': '等待中',
        };

        const labels = getReviewLabels((key) => translations[key] ?? key);

        expect(labels.calendar).toBe('日曆');
        expect(labels.inbox).toBe('收件匣');
        expect(labels.ai).toBe('AI 洞察');
        expect(labels.waiting).toBe('等待中');
    });

    it('falls back to English defaults when no typed key exists', () => {
        const labels = getReviewLabels((key) => key);

        expect(labels.calendarTasks).toBe('Mindwtr tasks (next 7 days)');
        expect(labels.moreItems).toBe('more items');
    });
});
