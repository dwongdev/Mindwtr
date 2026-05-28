import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useRootLayoutContextAutomation } from '@/hooks/root-layout/use-root-layout-context-automation';

const {
  mockStoreState,
  sendMobileImmediateNotification,
} = vi.hoisted(() => ({
  mockStoreState: {
    tasks: [] as any[],
    projects: [] as any[],
  },
  sendMobileImmediateNotification: vi.fn(async () => undefined),
}));

vi.mock('@mindwtr/core', async () => {
  const actual = await vi.importActual<typeof import('@mindwtr/core')>('@mindwtr/core');
  return {
    ...actual,
    useTaskStore: {
      getState: () => mockStoreState,
    },
  };
});

vi.mock('@/lib/notification-service', () => ({
  sendMobileImmediateNotification,
}));

const resolveText = (_key: string, fallback: string) => fallback;

function TestHarness({
  incomingUrl,
  router,
  showToast,
}: {
  incomingUrl: string | null;
  router: { replace: ReturnType<typeof vi.fn> };
  showToast: ReturnType<typeof vi.fn>;
}) {
  useRootLayoutContextAutomation({
    dataReady: true,
    incomingUrl,
    resolveText,
    router,
    showToast,
  });
  return null;
}

describe('useRootLayoutContextAutomation', () => {
  beforeEach(() => {
    mockStoreState.tasks = [];
    mockStoreState.projects = [];
    sendMobileImmediateNotification.mockClear();
  });

  it('notifies and routes context activation URLs', async () => {
    const router = { replace: vi.fn() };
    const showToast = vi.fn();
    mockStoreState.tasks = [
      {
        id: 'task-1',
        title: 'Call mom',
        status: 'next',
        tags: [],
        contexts: ['@parents'],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'task-2',
        title: 'Waiting task',
        status: 'waiting',
        tags: [],
        contexts: ['@parents'],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    await act(async () => {
      create(
        <TestHarness
          incomingUrl="mindwtr://contexts?token=%40parents&contextAction=activate"
          router={router}
          showToast={showToast}
        />
      );
    });

    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/contexts',
      params: { token: '@parents' },
    });
    expect(sendMobileImmediateNotification).toHaveBeenCalledWith(
      '@parents next action',
      'Call mom',
      {
        kind: 'context-automation',
        context: '@parents',
      }
    );
    expect(showToast).not.toHaveBeenCalled();
  });

  it('routes deactivation URLs without sending a notification', async () => {
    const router = { replace: vi.fn() };
    const showToast = vi.fn();

    await act(async () => {
      create(
        <TestHarness
          incomingUrl="mindwtr:///context/deactivate/parents"
          router={router}
          showToast={showToast}
        />
      );
    });

    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/contexts',
      params: { token: '@parents' },
    });
    expect(sendMobileImmediateNotification).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith({
      title: 'Context deactivated',
      message: '@parents is no longer active.',
      tone: 'success',
    });
  });
});
