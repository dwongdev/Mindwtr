import React from 'react';
import { TextInput } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import renderer, { act } from 'react-test-renderer';

import { ExpandedMarkdownEditor } from './expanded-markdown-editor';

vi.mock('@mindwtr/core', async () => {
  const actual = await vi.importActual<typeof import('@mindwtr/core')>('@mindwtr/core');
  const storeState = {
    _allTasks: [],
    tasks: [],
    projects: [],
  };
  const useTaskStore = Object.assign((selector?: (state: typeof storeState) => unknown) => {
    return selector ? selector(storeState) : storeState;
  }, {
    getState: () => storeState,
  });
  return {
    ...actual,
    useTaskStore,
  };
});

vi.mock('@/hooks/use-theme-colors', () => ({
  useThemeColors: () => ({
    bg: '#000',
    cardBg: '#111',
    inputBg: '#111',
    filterBg: '#222',
    border: '#333',
    text: '#fff',
    secondaryText: '#aaa',
    icon: '#aaa',
    tint: '#3b82f6',
  }),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: (props: any) => React.createElement('SafeAreaView', props, props.children),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('expo-linking', () => ({
  openURL: vi.fn(),
}));

vi.mock('expo-router', () => ({
  router: {
    push: vi.fn(),
    navigate: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  },
}));

describe('ExpandedMarkdownEditor', () => {
  it('enables native spell checking in edit mode', () => {
    let tree: renderer.ReactTestRenderer;

    act(() => {
      tree = renderer.create(
        <ExpandedMarkdownEditor
          isOpen
          onClose={vi.fn()}
          value="Fix teh typo"
          onChange={vi.fn()}
          title="Description"
          placeholder="Description"
          t={(key) => key}
          initialMode="edit"
          selection={{ start: 0, end: 0 }}
          onSelectionChange={vi.fn()}
          canUndo={false}
          onUndo={() => undefined}
        />
      );
    });

    const input = tree!.root.findByType(TextInput);

    expect(input.props.spellCheck).toBe(true);
    expect(input.props.autoCorrect).toBe(true);

    act(() => {
      tree!.unmount();
    });
  });

  it('keeps paired text when Android sends a delayed raw replacement after key press', () => {
    const onChange = vi.fn();
    const onSelectionChange = vi.fn();
    let tree: renderer.ReactTestRenderer;

    act(() => {
      tree = renderer.create(
        <ExpandedMarkdownEditor
          isOpen
          onClose={vi.fn()}
          value="read docs"
          onChange={onChange}
          title="Description"
          placeholder="Description"
          t={(key) => key}
          initialMode="edit"
          selection={{ start: 5, end: 9 }}
          onSelectionChange={onSelectionChange}
          canUndo={false}
          onUndo={() => undefined}
        />
      );
    });

    act(() => {
      tree!.root.findByType(TextInput).props.onKeyPress({
        nativeEvent: { key: '[' },
        preventDefault: vi.fn(),
      });
    });

    expect(onChange).toHaveBeenCalledWith('read [docs]');
    expect(onSelectionChange).toHaveBeenCalledWith({ start: 6, end: 10 });

    act(() => {
      tree!.root.findByType(TextInput).props.onChangeText('read [');
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(tree!.root.findByType(TextInput).props.value).toBe('read [docs]');

    act(() => {
      tree!.unmount();
    });
  });
});
