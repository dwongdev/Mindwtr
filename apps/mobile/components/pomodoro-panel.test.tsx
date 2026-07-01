import React from 'react';
import { Pressable, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PomodoroPanel } from './pomodoro-panel';

const { storeState } = vi.hoisted(() => ({
  storeState: {
    settings: {
      notificationsEnabled: false,
      gtd: {
        pomodoro: {},
      },
    },
  },
}));

vi.mock('@mindwtr/core', async () => {
  const actual = await vi.importActual<typeof import('@mindwtr/core')>('@mindwtr/core');
  const useTaskStore = Object.assign((selector?: (state: typeof storeState) => unknown) => (
    selector ? selector(storeState) : storeState
  ), {
    getState: () => storeState,
  });

  return {
    ...actual,
    useTaskStore,
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
  },
}));

vi.mock('../contexts/language-context', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('@/hooks/use-theme-colors', () => ({
  useThemeColors: () => ({
    bg: '#000000',
    cardBg: '#111827',
    inputBg: '#111827',
    filterBg: '#1f2937',
    border: '#334155',
    text: '#f8fafc',
    secondaryText: '#94a3b8',
    icon: '#94a3b8',
    tint: '#3b82f6',
    onTint: '#ffffff',
    danger: '#ef4444',
    success: '#10b981',
    warning: '#f59e0b',
  }),
}));

vi.mock('@/hooks/use-filled-button-colors', () => ({
  useFilledButtonColors: () => ({
    backgroundColor: '#3b82f6',
    textColor: '#ffffff',
  }),
}));

vi.mock('../lib/notification-service', () => ({
  cancelMobilePomodoroCompletionNotification: vi.fn(async () => undefined),
  scheduleMobilePomodoroCompletionNotification: vi.fn(async () => undefined),
}));

vi.mock('../lib/app-log', () => ({
  logWarn: vi.fn(async () => undefined),
}));

const flattenText = (value: unknown): string => {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map((item) => flattenText(item)).join('');
  if (value && typeof value === 'object') {
    const item = value as { children?: unknown; props?: { children?: unknown } };
    return flattenText(item.props?.children ?? item.children);
  }
  return '';
};

const flattenStyle = (style: unknown): Record<string, unknown> => {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.filter(Boolean).map(flattenStyle));
  }
  return style && typeof style === 'object' ? style as Record<string, unknown> : {};
};

const pressableText = (tree: renderer.ReactTestRenderer) => (
  tree.root.findAllByType(Pressable).map((node) => flattenText(node.props.children))
);

const renderPanel = async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<PomodoroPanel tasks={[]} onMarkDone={vi.fn()} />);
  });
  return tree;
};

describe('PomodoroPanel', () => {
  beforeEach(() => {
    storeState.settings = {
      notificationsEnabled: false,
      gtd: {
        pomodoro: {},
      },
    };
  });

  it('renders the phase as read-only status and names the next switch action', async () => {
    const tree = await renderPanel();

    const textValues = tree.root.findAllByType(Text).map((node) => flattenText(node.props.children));
    expect(textValues).toContain('Pomodoro Timer');
    expect(textValues).not.toContain('Pomodoro Focus');
    expect(pressableText(tree)).toContain('Switch to Break');
    expect(pressableText(tree)).not.toContain('Switch');

    const phaseText = tree.root.findAllByType(Text)
      .find((node) => flattenText(node.props.children) === 'Focus');
    expect(phaseText).toBeDefined();
    expect(phaseText?.parent?.type).toBe('View');
    expect(flattenStyle(phaseText?.parent?.props.style).borderWidth ?? 0).toBe(0);

    const switchButton = tree.root.findAllByType(Pressable)
      .find((node) => flattenText(node.props.children) === 'Switch to Break');
    expect(switchButton).toBeDefined();
    act(() => {
      switchButton?.props.onPress();
    });

    expect(pressableText(tree)).toContain('Switch to Focus');
    expect(tree.root.findAllByType(Text).some((node) => flattenText(node.props.children) === 'Break')).toBe(true);
  });
});
