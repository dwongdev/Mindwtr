import { describe, expect, it } from 'vitest';
import { buildReviewAnalysisPrompt, MAX_REVIEW_ANALYSIS_ITEMS } from './prompts';
import type { ReviewSnapshotItem } from './types';

const createItem = (index: number): ReviewSnapshotItem => ({
    id: `task-${index}`,
    title: `Task ${index}`,
    daysStale: 100 - index,
    status: 'next',
});

describe('buildReviewAnalysisPrompt', () => {
    it('caps review analysis input to the stalest items', () => {
        const items = Array.from({ length: MAX_REVIEW_ANALYSIS_ITEMS + 5 }, (_unused, index) => createItem(index));
        const prompt = buildReviewAnalysisPrompt(items);
        const [, jsonPayload = '[]'] = prompt.user.split('Items:\n');
        const scopedItems = JSON.parse(jsonPayload) as ReviewSnapshotItem[];

        expect(scopedItems).toHaveLength(MAX_REVIEW_ANALYSIS_ITEMS);
        expect(scopedItems[0]?.id).toBe('task-0');
        expect(scopedItems[scopedItems.length - 1]?.id).toBe(`task-${MAX_REVIEW_ANALYSIS_ITEMS - 1}`);
        expect(prompt.user).toContain(`Ignore the remaining 5 items`);
    });
});
