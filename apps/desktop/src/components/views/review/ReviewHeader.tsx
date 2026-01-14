import { cn } from '../../../lib/utils';

type ReviewHeaderProps = {
    title: string;
    taskCountLabel: string;
    selectionMode: boolean;
    onToggleSelection: () => void;
    onShowDailyGuide: () => void;
    onShowGuide: () => void;
    labels: {
        select: string;
        exitSelect: string;
        dailyReview: string;
        weeklyReview: string;
    };
};

export function ReviewHeader({
    title,
    taskCountLabel,
    selectionMode,
    onToggleSelection,
    onShowDailyGuide,
    onShowGuide,
    labels,
}: ReviewHeaderProps) {
    return (
        <header className="flex items-center justify-between">
            <div className="space-y-1">
                <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
                <p className="text-sm text-muted-foreground">{taskCountLabel}</p>
            </div>
            <div className="flex items-center gap-3">
                <button
                    onClick={onToggleSelection}
                    className={cn(
                        "text-xs px-3 py-1 rounded-md border transition-colors",
                        selectionMode
                            ? "bg-primary/10 text-primary border-primary"
                            : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground",
                    )}
                >
                    {selectionMode ? labels.exitSelect : labels.select}
                </button>
                <button
                    onClick={onShowDailyGuide}
                    className="bg-muted/50 text-foreground px-4 py-2 rounded-md hover:bg-muted transition-colors"
                >
                    {labels.dailyReview}
                </button>
                <button
                    onClick={onShowGuide}
                    className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
                >
                    {labels.weeklyReview}
                </button>
            </div>
        </header>
    );
}
