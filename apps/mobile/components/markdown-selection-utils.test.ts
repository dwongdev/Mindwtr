import { describe, expect, it } from 'vitest';

import {
    applyMarkdownPairInsertionWithSelectionFallback,
    applyMarkdownUrlPasteWithSelectionFallback,
} from './markdown-selection-utils';

describe('markdown selection replacement fallbacks', () => {
    it('uses the last range selection when mobile paste collapses the current selection first', () => {
        expect(
            applyMarkdownUrlPasteWithSelectionFallback(
                'read docs today',
                'read https://example.com today',
                { start: 24, end: 24 },
                { start: 5, end: 9 },
            ),
        ).toEqual({
            result: {
                value: 'read [docs](https://example.com) today',
                selection: { start: 32, end: 32 },
            },
            baseSelection: { start: 5, end: 9 },
        });
    });

    it('does not use a stale range when the text change is not a matching replacement', () => {
        expect(
            applyMarkdownUrlPasteWithSelectionFallback(
                'read docs today',
                'read docs today https://example.com',
                { start: 35, end: 35 },
                { start: 5, end: 9 },
            ),
        ).toBeNull();
    });

    it('also keeps pair insertion working when selection collapses before the text change', () => {
        expect(
            applyMarkdownPairInsertionWithSelectionFallback(
                'read docs',
                'read [',
                { start: 6, end: 6 },
                { start: 5, end: 9 },
            ),
        ).toEqual({
            result: {
                value: 'read [docs]',
                selection: { start: 6, end: 10 },
            },
            baseSelection: { start: 5, end: 9 },
        });
    });
});
