import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { TaskListHeader } from './TaskListHeader';

vi.mock('react-native', () => ({
  ScrollView: ({ children, contentContainerStyle, horizontal, showsHorizontalScrollIndicator, style, ...props }: any) =>
    React.createElement('div', props, children),
  StyleSheet: { create: (styles: any) => styles },
  Text: ({ accessibilityLabel, accessibilityRole, numberOfLines, ...props }: any) =>
    React.createElement('span', { ...props, 'aria-label': accessibilityLabel, role: accessibilityRole }, props.children),
  TouchableOpacity: ({ accessibilityLabel, accessibilityRole, hitSlop, onPress, style, ...props }: any) =>
    React.createElement('button', { ...props, 'aria-label': accessibilityLabel, role: accessibilityRole, onClick: onPress }, props.children),
  View: ({ accessibilityLabel, accessibilityRole, style, ...props }: any) =>
    React.createElement('div', { ...props, 'aria-label': accessibilityLabel, role: accessibilityRole }, props.children),
}));

vi.mock('lucide-react-native', () => ({
  ArrowUpDown: () => React.createElement('span', { 'data-icon': 'arrow-up-down' }),
  SlidersHorizontal: () => React.createElement('span', { 'data-icon': 'sliders-horizontal' }),
  X: () => React.createElement('span', { 'data-icon': 'x' }),
}));

const themeColors = {
  border: '#d1d5db',
  cardBg: '#ffffff',
  filterBg: '#f3f4f6',
  onTint: '#ffffff',
  secondaryText: '#6b7280',
  text: '#111827',
  tint: '#2563eb',
};

const renderHeader = (overrides: Partial<React.ComponentProps<typeof TaskListHeader>> = {}) => renderToStaticMarkup(
  <TaskListHeader
    activeFilterChips={[]}
    count={3}
    enableBulkActions={false}
    filterActiveCount={0}
    hasActiveFilters={false}
    onClearFilters={vi.fn()}
    onOpenFilters={vi.fn()}
    onOpenSort={vi.fn()}
    onToggleSelectionMode={vi.fn()}
    selectionMode={false}
    showHeader={false}
    showSort
    sortByLabel="Created (newest)"
    t={(key) => ({
      'common.clear': 'Clear',
      'common.tasks': 'tasks',
      'filters.label': 'Filters',
      'sort.label': 'Sort',
    }[key] ?? key)}
    themeColors={themeColors}
    title="Inbox"
    {...overrides}
  />
);

describe('TaskListHeader', () => {
  it('keeps the sort control visible for compact headerless task lists', () => {
    const html = renderHeader();

    expect(html).toContain('aria-label="Sort: Created (newest)"');
    expect(html).toContain('data-icon="arrow-up-down"');
    expect(html).toContain('aria-label="Filters"');
    expect(html).toContain('data-icon="sliders-horizontal"');
    expect(html).not.toContain('Inbox');
  });

  it('keeps the filter control available when sorting is disabled', () => {
    const html = renderHeader({ showSort: false });

    expect(html).not.toContain('aria-label="Sort');
    expect(html).not.toContain('data-icon="arrow-up-down"');
    expect(html).toContain('aria-label="Filters"');
    expect(html).toContain('data-icon="sliders-horizontal"');
  });

  it('shows active filter chips and a count badge', () => {
    const html = renderHeader({
      activeFilterChips: [
        { id: 'search', label: 'Search: errand', onPress: vi.fn() },
        { id: 'priority:high', label: 'High', onPress: vi.fn() },
      ],
      filterActiveCount: 2,
      hasActiveFilters: true,
    });

    expect(html).toContain('aria-label="Filters: 2"');
    expect(html).toContain('aria-label="Remove filter: Search: errand"');
    expect(html).toContain('aria-label="Remove filter: High"');
    expect(html).toContain('Search: errand');
    expect(html).toContain('High');
    expect(html).toContain('Clear');
    expect(html).toContain('data-icon="x"');
  });
});
