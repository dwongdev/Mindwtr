import { tFallback } from '@mindwtr/core';
import { cn } from '../../../lib/utils';
import { ToolbarSelect } from './ToolbarSelect';
import { getGroupAxisLabel, type TaskGroupAxis } from './next-grouping';

type GroupBySelectProps<Axis extends TaskGroupAxis> = {
    value: Axis;
    axes: readonly Axis[];
    disabledAxes?: readonly Axis[];
    onChange: (value: Axis) => void;
    t: (key: string) => string;
    className?: string;
};

/** The labeled GROUP select shared by every list toolbar. */
export function GroupBySelect<Axis extends TaskGroupAxis>({
    value,
    axes,
    disabledAxes = [],
    onChange,
    t,
    className,
}: GroupBySelectProps<Axis>) {
    const groupLabel = tFallback(t, 'list.groupBy', 'Group');
    return (
        <ToolbarSelect
            className={cn('min-w-[180px]', className)}
            label={groupLabel}
            value={value}
            options={axes.map((axis) => ({
                value: axis,
                label: getGroupAxisLabel(axis, t),
                disabled: disabledAxes.includes(axis),
            }))}
            onChange={(next) => onChange(next as Axis)}
        />
    );
}
