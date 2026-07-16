import { ListFilter } from 'lucide-react';
import { tFallback, type TaskStatus } from '@mindwtr/core';
import { cn } from '../../../lib/utils';
import { ToolbarSelect } from '../list/ToolbarSelect';

type ReviewFiltersBarProps = {
    filterStatus: TaskStatus | 'all';
    statusOptions: TaskStatus[];
    statusCounts: Record<string, number>;
    onSelect: (status: TaskStatus | 'all') => void;
    t: (key: string) => string;
};

export function ReviewFiltersBar({
    filterStatus,
    statusOptions,
    statusCounts,
    onSelect,
    t,
}: ReviewFiltersBarProps) {
    const statusLabel = tFallback(t, 'taskEdit.statusLabel', 'Status');
    const openTasksLabel = tFallback(t, 'review.openTasks', 'Open tasks');
    const renderFilterButton = (
        status: TaskStatus | 'all',
        label: string,
        count: number,
    ) => {
        const isActive = filterStatus === status;
        const activeFilterStyle = isActive
            ? {
                backgroundColor: 'hsl(var(--primary))',
                borderColor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))',
            }
            : undefined;

        return (
            <button
                key={status}
                type="button"
                onClick={() => onSelect(status)}
                aria-label={`${label} (${count})`}
                style={activeFilterStyle}
                className={cn(
                    "inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border transition-colors whitespace-nowrap shrink-0",
                    isActive
                        ? "bg-primary border-primary"
                        : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                )}
            >
                <span>{label}</span>
                <span className={cn(
                    "tabular-nums",
                    !isActive && "text-muted-foreground"
                )}>
                    ({count})
                </span>
            </button>
        );
    };

    return (
        <div className="min-w-0 shrink-0">
            <div className="review-status-filter__compact">
                <ToolbarSelect
                    className="min-w-[190px]"
                    label={statusLabel}
                    icon={<ListFilter className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
                    value={filterStatus}
                    options={[
                        { value: 'all', label: `${openTasksLabel} (${statusCounts.all ?? 0})` },
                        ...statusOptions.map((status) => ({
                            value: status,
                            label: `${t(`status.${status}`)} (${statusCounts[status] ?? 0})`,
                        })),
                    ]}
                    onChange={(next) => onSelect(next as TaskStatus | 'all')}
                />
            </div>
            <div className="review-status-filter__pills">
                {renderFilterButton('all', openTasksLabel, statusCounts.all ?? 0)}
                {statusOptions.map((status) => (
                    renderFilterButton(status, t(`status.${status}`), statusCounts[status] ?? 0)
                ))}
            </div>
        </div>
    );
}
