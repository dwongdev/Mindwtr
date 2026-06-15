import { beforeEach, describe, expect, it, vi } from 'vitest';

const localStorageMock = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));

vi.mock('expo-constants', () => ({
  default: {
    appOwnership: 'standalone',
  },
}));

vi.mock('./widget-service', () => ({
  updateMobileWidgetFromData: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./app-log', () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock('./startup-profiler', () => ({
  markStartupPhase: vi.fn(),
  measureStartupPhase: vi.fn(async (_name: string, work: () => Promise<unknown>) => work()),
}));

describe('mobile storage adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: localStorageMock },
    });
  });

  it('preserves people when reading the JSON backup startup snapshot', async () => {
    const backup = {
      tasks: [],
      projects: [],
      sections: [],
      areas: [],
      people: [
        {
          id: 'person-1',
          name: 'Alex',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
      ],
      settings: {},
    };
    localStorageMock.getItem.mockImplementation((key: string) => (
      key === 'mindwtr-data' ? JSON.stringify(backup) : null
    ));

    const { getMobileStartupSnapshotFromBackup } = await import('./storage-adapter');
    const snapshot = await getMobileStartupSnapshotFromBackup();

    expect(snapshot?.people).toEqual(backup.people);
  }, 10_000);
});
