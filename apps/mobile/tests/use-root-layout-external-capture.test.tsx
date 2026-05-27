import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useRootLayoutExternalCapture } from '@/hooks/root-layout/use-root-layout-external-capture';

vi.mock('@/lib/app-log', () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

type RouterMock = {
  canGoBack: ReturnType<typeof vi.fn>;
  push: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
};

function TestHarness({
  incomingUrl,
  router,
  showToast,
}: {
  incomingUrl: string | null;
  router: RouterMock;
  showToast: ReturnType<typeof vi.fn>;
}) {
  useRootLayoutExternalCapture({
    dataReady: true,
    hasShareIntent: false,
    incomingUrl,
    resolveText: (_key: string, fallback: string) => fallback,
    resetShareIntent: vi.fn(),
    router,
    shareText: null,
    shareWebUrl: null,
    showToast,
  });
  return null;
}

describe('useRootLayoutExternalCapture', () => {
  let router: RouterMock;
  let showToast: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    router = {
      canGoBack: vi.fn(() => false),
      push: vi.fn(),
      replace: vi.fn(),
    };
    showToast = vi.fn();
  });

  it('opens a confirmation modal for App Actions capture links', () => {
    act(() => {
      create(
        <TestHarness
          incomingUrl="mindwtr:///capture?title=Call%20dentist&note=Tomorrow&tags=phone&project=Home"
          router={router}
          showToast={showToast}
        />
      );
    });

    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/capture-modal',
      params: {
        initialValue: 'Call%20dentist',
        initialProps: expect.any(String),
        project: 'Home',
      },
    });
    const params = router.replace.mock.calls[0][0].params;
    expect(JSON.parse(decodeURIComponent(params.initialProps))).toEqual({
      description: 'Tomorrow',
      tags: ['#phone'],
    });
  });

  it('handles repeated App Actions captures when the request id changes', () => {
    let tree!: ReturnType<typeof create>;

    act(() => {
      tree = create(
        <TestHarness
          incomingUrl="mindwtr:///capture?title=Call%20dentist&requestId=first"
          router={router}
          showToast={showToast}
        />
      );
    });

    act(() => {
      tree.update(
        <TestHarness
          incomingUrl="mindwtr:///capture?title=Call%20dentist&requestId=second"
          router={router}
          showToast={showToast}
        />
      );
    });

    expect(router.replace).toHaveBeenCalledTimes(2);
    expect(router.replace).toHaveBeenNthCalledWith(1, {
      pathname: '/capture-modal',
      params: {
        initialValue: 'Call%20dentist',
      },
    });
    expect(router.replace).toHaveBeenNthCalledWith(2, {
      pathname: '/capture-modal',
      params: {
        initialValue: 'Call%20dentist',
      },
    });
  });

  it('routes App Actions feature links through the feature inventory map', () => {
    act(() => {
      create(
        <TestHarness
          incomingUrl="mindwtr:///open-feature?feature=focus"
          router={router}
          showToast={showToast}
        />
      );
    });

    expect(router.replace).toHaveBeenCalledWith('/focus');
    expect(router.push).not.toHaveBeenCalled();
  });
});
