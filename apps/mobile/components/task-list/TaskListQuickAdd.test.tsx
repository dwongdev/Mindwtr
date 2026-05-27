import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { TaskListQuickAdd } from './TaskListQuickAdd';

vi.mock('react-native', () => ({
  ActivityIndicator: ({ color, size }: any) => React.createElement('span', { 'data-activity': size, style: { color } }),
  StyleSheet: { create: (styles: any) => styles },
  Text: ({ accessibilityLabel, accessibilityRole, ...props }: any) =>
    React.createElement('span', { ...props, 'aria-label': accessibilityLabel, role: accessibilityRole }, props.children),
  TextInput: ({
    accessibilityHint,
    accessibilityLabel,
    autoCapitalize,
    autoCorrect,
    onChangeText,
    onSelectionChange,
    onSubmitEditing,
    placeholderTextColor,
    returnKeyType,
    style,
    value,
    ...props
  }: any) =>
    React.createElement('input', { ...props, 'aria-description': accessibilityHint, 'aria-label': accessibilityLabel, defaultValue: value }),
  TouchableOpacity: ({ accessibilityLabel, accessibilityRole, accessibilityState, activeOpacity, hitSlop, onPress, style, ...props }: any) =>
    React.createElement('button', { ...props, 'aria-label': accessibilityLabel, 'aria-selected': accessibilityState?.selected, disabled: accessibilityState?.disabled, role: accessibilityRole, onClick: onPress }, props.children),
  View: ({ accessibilityLabel, accessibilityRole, style, ...props }: any) =>
    React.createElement('div', { ...props, 'aria-label': accessibilityLabel, role: accessibilityRole }, props.children),
}));

vi.mock('lucide-react-native', () => ({
  CheckCircle2: () => React.createElement('span', { 'data-icon': 'check-circle' }),
  Plus: () => React.createElement('span', { 'data-icon': 'plus' }),
  Sparkles: () => React.createElement('span', { 'data-icon': 'sparkles' }),
}));

const themeColors = {
  border: '#d1d5db',
  inputBg: '#ffffff',
  onTint: '#ffffff',
  secondaryText: '#6b7280',
  text: '#111827',
  tint: '#2563eb',
};

const renderQuickAdd = (overrides: Partial<React.ComponentProps<typeof TaskListQuickAdd>> = {}) => renderToStaticMarkup(
  <TaskListQuickAdd
    aiEnabled
    applyTypeaheadOption={vi.fn()}
    copilotApplied={false}
    copilotSuggestion={null}
    copilotTags={[]}
    copilotThinking={false}
    enableCopilot
    handleAddTask={vi.fn()}
    newTaskTitle="Call Alex"
    onApplyCopilot={vi.fn()}
    onChangeText={vi.fn()}
    onSelectionChange={vi.fn()}
    setTypeaheadIndex={vi.fn()}
    showQuickAddHelp={false}
    t={(key) => ({
      'copilot.applyHint': 'Apply',
      'copilot.applied': 'Applied',
      'copilot.suggested': 'Suggested',
      'inbox.addPlaceholder': 'Add a task',
      'nav.addTask': 'Add Task',
      'projects.addTaskPlaceholder': 'Add a project task',
      'quickAdd.help': 'Help',
      'quickAdd.inputHint': 'Type a task title, then press add or the return key.',
      'quickAdd.inputLabel': 'Task title',
    }[key] ?? key)}
    themeColors={themeColors}
    title="Inbox"
    trigger={null}
    typeaheadIndex={0}
    typeaheadOpen={false}
    typeaheadOptions={[]}
    {...overrides}
  />
);

describe('TaskListQuickAdd', () => {
  it('uses an icon add control instead of a text plus marker', () => {
    const html = renderQuickAdd();

    expect(html).toContain('data-icon="plus"');
    expect(html).toContain('aria-label="Add Task"');
    expect(html).not.toContain('>+</');
  });

  it('uses iconography for typeahead and copilot suggestion states', () => {
    const html = renderQuickAdd({
      copilotSuggestion: { context: '@work', tags: ['#focus'] },
      trigger: { type: 'project', query: 'Foo', start: 0, end: 4 },
      typeaheadOpen: true,
      typeaheadOptions: [{ kind: 'create', label: 'Create Foo', value: 'Foo' }],
    });

    expect(html).toContain('data-icon="sparkles"');
    expect(html).toContain('Create Foo');
    expect(html).toContain('Suggested @work #focus');
    expect(html).not.toContain('✨');
  });

  it('uses iconography for the copilot applied state', () => {
    const html = renderQuickAdd({
      copilotApplied: true,
      copilotContext: '@work',
      copilotTags: ['#focus'],
    });

    expect(html).toContain('data-icon="check-circle"');
    expect(html).toContain('Applied @work #focus');
    expect(html).not.toContain('✅');
  });
});
