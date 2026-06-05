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

export type IgnoredNativePairChange = {
    nativeValue: string;
    duplicateNativeValues: string[];
    appliedValue: string;
    selection: MarkdownSelection;
};

export const isRangeSelection = (selection: MarkdownSelection | null | undefined): selection is MarkdownSelection => (
    selection != null && selection.start !== selection.end
);

const replaceSelectionWithText = (value: string, selection: MarkdownSelection, text: string): string => (
    `${value.slice(0, selection.start)}${text}${value.slice(selection.end)}`
);

export const createIgnoredNativePairChange = (
    previousValue: string,
    key: string,
    baseSelection: MarkdownSelection,
    result: MarkdownToolbarResult,
): IgnoredNativePairChange => {
    const duplicateNativeValue = replaceSelectionWithText(result.value, result.selection, key);
    const duplicatePairedValue = applyMarkdownPairInsertion(
        result.value,
        duplicateNativeValue,
        result.selection,
    )?.value;
    const duplicateNativeValues = duplicatePairedValue && duplicatePairedValue !== duplicateNativeValue
        ? [duplicateNativeValue, duplicatePairedValue]
        : [duplicateNativeValue];

    return {
        nativeValue: replaceSelectionWithText(previousValue, baseSelection, key),
        duplicateNativeValues,
        appliedValue: result.value,
        selection: result.selection,
    };
};

export const shouldIgnoreNativePairChange = (
    nextValue: string,
    currentValue: string,
    ignoredChange: IgnoredNativePairChange,
): boolean => (
    currentValue === ignoredChange.appliedValue
    && (
        nextValue === ignoredChange.nativeValue
        || ignoredChange.duplicateNativeValues.includes(nextValue)
    )
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

export const applyMarkdownPairKeyPressWithSelectionFallback = (
    previousValue: string,
    key: string,
    primarySelection: MarkdownSelection,
    fallbackSelection?: MarkdownSelection | null,
): MarkdownSelectionReplacement | null => {
    if (!key || key.length > 1) return null;

    const selections = getSelectionCandidates(primarySelection, fallbackSelection);
    const orderedSelections = [
        ...selections.filter(isRangeSelection),
        ...selections.filter((selection) => !isRangeSelection(selection)),
    ];
    for (const selection of orderedSelections) {
        const nextValue = `${previousValue.slice(0, selection.start)}${key}${previousValue.slice(selection.end)}`;
        const result = applyMarkdownPairInsertion(previousValue, nextValue, selection);
        if (result) {
            return {
                result,
                baseSelection: selection,
            };
        }
    }
    return null;
};
