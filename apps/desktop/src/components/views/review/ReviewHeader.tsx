import type { ReactNode } from 'react';
import { CheckSquare, List } from 'lucide-react';
import type { TaskSortBy } from '@mindwtr/core';
import type { ContextsGroupBy } from '../list/next-grouping';
import { GroupBySelect } from '../list/GroupBySelect';
import { SortBySelect, ToolbarButton } from '../list/list-toolbar';

type ReviewHeaderProps = {
    title: string;
    taskCountLabel: string;
    onShowDailyGuide: () => void;
    onShowGuide: () => void;
    /** Status chips, promoted into the header's middle gap. */
    filters?: ReactNode;
    labels: {
        dailyReview: string;
        weeklyReview: string;
    };
};

// The header carries only the review actions themselves; list utilities
// (sort/group/select/details) live in ReviewListControls beside the status
// chips, next to the list they operate on.
export function ReviewHeader({
    title,
    taskCountLabel,
    onShowDailyGuide,
    onShowGuide,
    filters,
    labels,
}: ReviewHeaderProps) {
    return (
        <header className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="space-y-1">
                <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
                <p className="text-sm text-muted-foreground">{taskCountLabel}</p>
            </div>
            {filters && <div className="order-3 min-w-0 basis-full xl:order-none xl:flex-1">{filters}</div>}
            <div className="flex w-full flex-wrap items-center gap-3 sm:ml-auto sm:w-auto">
                <button
                    onClick={onShowDailyGuide}
                    className="whitespace-nowrap rounded-lg bg-muted/50 px-4 py-2 text-foreground transition-colors hover:bg-muted"
                >
                    {labels.dailyReview}
                </button>
                <button
                    onClick={onShowGuide}
                    className="whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
                >
                    {labels.weeklyReview}
                </button>
            </div>
        </header>
    );
}

type ReviewListControlsProps = {
    selectionMode: boolean;
    onToggleSelection: () => void;
    sortBy: TaskSortBy;
    onChangeSortBy: (value: TaskSortBy) => void;
    groupBy: ContextsGroupBy;
    onChangeGroupBy: (value: ContextsGroupBy) => void;
    showListDetails: boolean;
    onToggleDetails: () => void;
    t: (key: string) => string;
    labels: {
        select: string;
        exitSelect: string;
    };
};

export function ReviewListControls({
    selectionMode,
    onToggleSelection,
    sortBy,
    onChangeSortBy,
    groupBy,
    onChangeGroupBy,
    showListDetails,
    onToggleDetails,
    t,
    labels,
}: ReviewListControlsProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <SortBySelect value={sortBy} onChange={onChangeSortBy} t={t} />
            <GroupBySelect
                value={groupBy}
                axes={['none', 'status', 'tag', 'context', 'area', 'project'] as const}
                onChange={onChangeGroupBy}
                t={t}
            />
            <ToolbarButton
                active={selectionMode}
                onClick={onToggleSelection}
                aria-pressed={selectionMode}
                icon={<CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />}
            >
                {selectionMode ? labels.exitSelect : labels.select}
            </ToolbarButton>
            <ToolbarButton
                active={showListDetails}
                onClick={onToggleDetails}
                aria-pressed={showListDetails}
                title={showListDetails ? (t('list.details') || 'Details on') : (t('list.detailsOff') || 'Details off')}
                icon={<List className="h-3.5 w-3.5" aria-hidden="true" />}
            >
                {showListDetails ? (t('list.details') || 'Details') : (t('list.detailsOff') || 'Details off')}
            </ToolbarButton>
        </div>
    );
}
