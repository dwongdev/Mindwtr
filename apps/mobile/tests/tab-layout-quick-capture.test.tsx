import React from 'react';
import { TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import TabLayout from '../app/(drawer)/(tabs)/_layout';

vi.mock('expo-router', () => {
  function LinkMock({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  }
  function TabsScreenMock() {
    return null;
  }
  const Tabs = ({ children, tabBar }: any) => React.createElement(
    'Tabs',
    null,
    tabBar({
      state: {
        index: 0,
        key: 'tabs',
        routes: [
          { key: 'inbox-key', name: 'inbox' },
          { key: 'focus-key', name: 'focus' },
          { key: 'capture-key', name: 'capture' },
          { key: 'review-key', name: 'review-tab' },
          { key: 'menu-key', name: 'menu' },
        ],
      },
      descriptors: {
        'inbox-key': { options: {} },
        'focus-key': { options: {} },
        'capture-key': { options: {} },
        'review-key': { options: {} },
        'menu-key': { options: {} },
      },
      navigation: {
        emit: vi.fn(() => ({ defaultPrevented: false })),
        dispatch: vi.fn(),
      },
    }),
    children,
  );
  Tabs.Screen = TabsScreenMock;
  return {
    Link: LinkMock,
    Tabs,
  };
});

vi.mock('@react-navigation/native', () => ({
  CommonActions: {
    navigate: vi.fn((route) => ({ type: 'NAVIGATE', payload: route })),
  },
}));

vi.mock('@mindwtr/core', () => ({
  useTaskStore: () => ({
    settings: {
      gtd: {
        defaultCaptureMethod: 'text',
      },
    },
  }),
}));

vi.mock('@/components/haptic-tab', () => ({
  HapticTab: (props: any) => React.createElement('HapticTab', props, props.children),
}));

vi.mock('@/components/mobile-area-switcher', () => ({
  MobileAreaSwitcher: () => React.createElement('MobileAreaSwitcher'),
}));

vi.mock('@/components/mobile-header-sync-bar', () => ({
  MobileHeaderSyncBar: () => React.createElement('MobileHeaderSyncBar'),
}));

vi.mock('@/components/SyncActivityIndicator', () => ({
  SyncActivityIndicator: () => React.createElement('SyncActivityIndicator'),
}));

vi.mock('@/components/quick-capture-sheet', () => ({
  QuickCaptureSheet: (props: any) => React.createElement('QuickCaptureSheet', props),
}));

vi.mock('@/hooks/use-mobile-area-filter', () => ({
  useMobileAreaFilter: () => ({ selectedAreaIdForNewTasks: null }),
}));

vi.mock('@/hooks/use-mobile-sync-badge', () => ({
  useMobileSyncBadge: () => ({ syncBadgeAccessibilityLabel: '', syncBadgeColor: '' }),
}));

vi.mock('@/hooks/use-theme-colors', () => ({
  useThemeColors: () => ({
    bg: '#0f172a',
    border: '#334155',
    cardBg: '#111827',
    onTint: '#ffffff',
    tabIconDefault: '#94a3b8',
    tabIconSelected: '#f8fafc',
    text: '#f8fafc',
    tint: '#3b82f6',
  }),
}));

vi.mock('../contexts/language-context', () => ({
  useLanguage: () => ({
    t: (key: string) => ({
      'nav.addTask': 'Add task',
      'quickAdd.audioCaptureLabel': 'Audio capture',
      'search.title': 'Search',
      'tab.inbox': 'Inbox',
      'tab.menu': 'Menu',
      'tab.next': 'Next',
      'tab.review': 'Review',
    }[key] ?? key),
  }),
}));

vi.mock('../contexts/quick-capture-context', () => ({
  QuickCaptureProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const getAddTaskButton = (tree: ReturnType<typeof create>) => {
  const button = tree.root.findAllByType(TouchableOpacity).find(
    (node) => node.props.accessibilityLabel === 'Add task'
  );
  if (!button) throw new Error('Add task button not found');
  return button;
};

describe('mobile tab quick capture', () => {
  it('unmounts the quick capture sheet after close so the next plus tap gets a fresh modal', () => {
    let tree!: ReturnType<typeof create>;

    act(() => {
      tree = create(<TabLayout />);
    });

    expect(tree.root.findAllByType('QuickCaptureSheet')).toHaveLength(0);

    act(() => {
      getAddTaskButton(tree).props.onPress();
    });

    let sheets = tree.root.findAllByType('QuickCaptureSheet');
    expect(sheets).toHaveLength(1);
    expect(sheets[0]?.props.visible).toBe(true);

    act(() => {
      sheets[0]?.props.onClose();
    });

    expect(tree.root.findAllByType('QuickCaptureSheet')).toHaveLength(0);

    act(() => {
      getAddTaskButton(tree).props.onPress();
    });

    sheets = tree.root.findAllByType('QuickCaptureSheet');
    expect(sheets).toHaveLength(1);
    expect(sheets[0]?.props.visible).toBe(true);
  });
});
