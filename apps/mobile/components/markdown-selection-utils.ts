import {
    applyMarkdownPairInsertion,
    applyMarkdownUrlPaste,
    type MarkdownSelection,
    type MarkdownToolbarResult,
} from '@mindwtr/core';

type MarkdownSelectionReplacement = {
    result: MarkdownToolbarResult;
    baseSelection: MarkdownSelection;
};

export const isRangeSelection = (selection: MarkdownSelection | null | undefined): selection is MarkdownSelection => (
    selection != null && selection.start !== selection.end
);

const getSelectionCandidates = (
    primarySelection: MarkdownSelection,
    fallbackSelection?: MarkdownSelection | null,
): MarkdownSelection[] => {
    if (
        !fallbackSelection
        || (
            fallbackSelection.start === primarySelection.start
            && fallbackSelection.end === primarySelection.end
        )
    ) {
        return [primarySelection];
    }
    return [primarySelection, fallbackSelection];
};

const applyWithSelectionCandidates = (
    previousValue: string,
    nextValue: string,
    primarySelection: MarkdownSelection,
    fallbackSelection: MarkdownSelection | null | undefined,
    apply: (
        previousValue: string,
        nextValue: string,
        selection: MarkdownSelection,
    ) => MarkdownToolbarResult | null,
): MarkdownSelectionReplacement | null => {
    for (const selection of getSelectionCandidates(primarySelection, fallbackSelection)) {
        const result = apply(previousValue, nextValue, selection);
        if (result) {
            return {
                result,
                baseSelection: selection,
            };
        }
    }
    return null;
};

export const applyMarkdownUrlPasteWithSelectionFallback = (
    previousValue: string,
    nextValue: string,
    primarySelection: MarkdownSelection,
    fallbackSelection?: MarkdownSelection | null,
): MarkdownSelectionReplacement | null => (
    applyWithSelectionCandidates(previousValue, nextValue, primarySelection, fallbackSelection, applyMarkdownUrlPaste)
);

export const applyMarkdownPairInsertionWithSelectionFallback = (
    previousValue: string,
    nextValue: string,
    primarySelection: MarkdownSelection,
    fallbackSelection?: MarkdownSelection | null,
): MarkdownSelectionReplacement | null => (
    applyWithSelectionCandidates(previousValue, nextValue, primarySelection, fallbackSelection, applyMarkdownPairInsertion)
);
