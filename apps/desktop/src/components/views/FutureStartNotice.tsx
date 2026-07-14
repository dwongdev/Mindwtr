interface FutureStartNoticeProps {
    count: number;
    shown: boolean;
    onToggle: () => void;
    resolveText: (key: string, fallback: string) => string;
}

/**
 * Shared "N tasks hidden (future start)" banner with its Show/Hide toggle.
 * Focus and the Next list both defer future-start tasks, so the notice that
 * makes them reachable lives in one place instead of once per view.
 */
export function FutureStartNotice({ count, shown, onToggle, resolveText }: FutureStartNoticeProps) {
    if (count <= 0) return null;

    const template = shown
        ? (count === 1
            ? resolveText('agenda.futureStartsShownOne', '1 future-start task shown')
            : resolveText('agenda.futureStartsShownMany', '{count} future-start tasks shown'))
        : (count === 1
            ? resolveText('agenda.futureStartsHiddenOne', '1 task hidden (future start)')
            : resolveText('agenda.futureStartsHiddenMany', '{count} tasks hidden (future start)'));

    return (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/25 px-3 py-2 text-sm">
            <span className="text-muted-foreground">
                {template.replace('{count}', String(count))}
            </span>
            <button
                type="button"
                className="text-sm font-medium text-primary hover:text-primary/80"
                onClick={onToggle}
            >
                {shown
                    ? resolveText('agenda.hideFutureStarts', 'Hide')
                    : resolveText('agenda.showFutureStarts', 'Show')}
            </button>
        </div>
    );
}
