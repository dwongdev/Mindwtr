import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ListHeader } from './ListHeader';
import { openToolbarSelect } from '../../../test/toolbar-select';

const translations: Record<string, string> = {
    'bulk.select': 'Select',
    'common.tasks': 'tasks',
    'filters.label': 'Filters',
    'filters.priority': 'Priority',
    'focus.group.energy': 'Energy',
    'list.details': 'Details',
    'list.detailsOff': 'Details off',
    'list.density': 'Density',
    'list.densityComfortable': 'Comfortable',
    'list.densityCompact': 'Compact',
    'list.densityCondensed': 'Condensed',
    'list.groupBy': 'Group',
    'list.groupByArea': 'Area',
    'list.groupByContext': 'Context',
    'list.groupByNone': 'No grouping',
    'list.groupByProject': 'Project',
    'people.title': 'People',
    'sort.created': 'Oldest',
    'sort.created-desc': 'Newest',
    'sort.default': 'Default',
    'sort.due': 'Due date',
    'sort.label': 'Sort',
    'sort.review': 'Review',
    'sort.start': 'Start date',
    'sort.title': 'Title',
    'taskEdit.tagsLabel': 'Tags',
};

const t = (key: string) => translations[key] ?? key;

describe('ListHeader', () => {
    it('labels sort and group controls visibly inside the compact header controls', () => {
        render(
            <ListHeader
                title="Focus"
                showNextCount={false}
                nextCount={0}
                taskCount={3}
                hasFilters={false}
                filterSummaryLabel=""
                filterSummarySuffix=""
                sortBy="default"
                onChangeSortBy={vi.fn()}
                showGroupBy
                groupBy="none"
                onChangeGroupBy={vi.fn()}
                selectionMode={false}
                onToggleSelection={vi.fn()}
                showListDetails
                onToggleDetails={vi.fn()}
                densityMode="comfortable"
                onToggleDensity={vi.fn()}
                t={t}
            />
        );

        expect(screen.getByText('Sort')).toBeInTheDocument();
        expect(screen.getByText('Group')).toBeInTheDocument();
        expect(screen.getByTestId('list-sort-icon')).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'Sort' })).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'Group' })).toBeInTheDocument();
    });

    it('wraps translated titles instead of truncating them', () => {
        render(
            <ListHeader
                title="Algum dia/Talvez"
                showNextCount={false}
                nextCount={0}
                taskCount={12}
                hasFilters={false}
                filterSummaryLabel=""
                filterSummarySuffix=""
                sortBy="default"
                onChangeSortBy={vi.fn()}
                selectionMode={false}
                onToggleSelection={vi.fn()}
                showListDetails={false}
                onToggleDetails={vi.fn()}
                densityMode="compact"
                onToggleDensity={vi.fn()}
                t={t}
            />
        );

        const title = screen.getByRole('heading', { level: 2, name: 'Algum dia/Talvez' });
        expect(title).toHaveClass('break-words');
        expect(title).not.toHaveClass('truncate');
    });

    it('renders supplied group-by options including tags', () => {
        render(
            <ListHeader
                title="Focus"
                showNextCount={false}
                nextCount={0}
                taskCount={3}
                hasFilters={false}
                filterSummaryLabel=""
                filterSummarySuffix=""
                sortBy="default"
                onChangeSortBy={vi.fn()}
                showGroupBy
                groupBy="none"
                groupByOptions={['none', 'tag']}
                onChangeGroupBy={vi.fn()}
                selectionMode={false}
                onToggleSelection={vi.fn()}
                showListDetails
                onToggleDetails={vi.fn()}
                densityMode="comfortable"
                onToggleDensity={vi.fn()}
                t={t}
            />
        );

        openToolbarSelect('Group');
        expect(screen.getByRole('option', { name: 'Tags' })).toBeInTheDocument();
    });

    it('omits the Filters toggle unless the view opts in', () => {
        render(
            <ListHeader
                title="Completed"
                showNextCount={false}
                nextCount={0}
                taskCount={3}
                hasFilters={false}
                filterSummaryLabel=""
                filterSummarySuffix=""
                sortBy="default"
                onChangeSortBy={vi.fn()}
                showGroupBy
                groupBy="none"
                onChangeGroupBy={vi.fn()}
                selectionMode={false}
                onToggleSelection={vi.fn()}
                showListDetails
                onToggleDetails={vi.fn()}
                densityMode="comfortable"
                onToggleDensity={vi.fn()}
                t={t}
            />
        );

        expect(screen.queryByRole('button', { name: 'Filters' })).not.toBeInTheDocument();
    });

    it('shows the condensed density label and marks the control active when condensed', () => {
        render(
            <ListHeader
                title="Focus"
                showNextCount={false}
                nextCount={0}
                taskCount={3}
                hasFilters={false}
                filterSummaryLabel=""
                filterSummarySuffix=""
                sortBy="default"
                onChangeSortBy={vi.fn()}
                showGroupBy
                groupBy="none"
                onChangeGroupBy={vi.fn()}
                selectionMode={false}
                onToggleSelection={vi.fn()}
                showListDetails
                onToggleDetails={vi.fn()}
                densityMode="condensed"
                onToggleDensity={vi.fn()}
                t={t}
            />
        );

        const button = screen.getByRole('button', { name: 'Condensed' });
        expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('renders a Filters toggle that reflects and drives the panel open state', () => {
        const onToggleFilters = vi.fn();
        render(
            <ListHeader
                title="Completed"
                showNextCount={false}
                nextCount={0}
                taskCount={3}
                hasFilters={false}
                filterSummaryLabel=""
                filterSummarySuffix=""
                sortBy="default"
                onChangeSortBy={vi.fn()}
                showGroupBy
                groupBy="none"
                onChangeGroupBy={vi.fn()}
                showFiltersButton
                filtersOpen={false}
                onToggleFilters={onToggleFilters}
                selectionMode={false}
                onToggleSelection={vi.fn()}
                showListDetails
                onToggleDetails={vi.fn()}
                densityMode="comfortable"
                onToggleDensity={vi.fn()}
                t={t}
            />
        );

        const button = screen.getByRole('button', { name: 'Filters' });
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(button).toHaveAttribute('aria-controls', 'list-filters-panel');

        fireEvent.click(button);
        expect(onToggleFilters).toHaveBeenCalledTimes(1);
    });
});
