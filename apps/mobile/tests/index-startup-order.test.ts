import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('mobile index startup order', () => {
  it('loads Expo Metro runtime before background task modules', () => {
    const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
    const metroRuntimeIndex = source.indexOf("require('@expo/metro-runtime')");
    const backgroundTaskIndex = source.indexOf("require('./lib/background-sync-task')");

    expect(metroRuntimeIndex).toBeGreaterThanOrEqual(0);
    expect(backgroundTaskIndex).toBeGreaterThanOrEqual(0);
    expect(metroRuntimeIndex).toBeLessThan(backgroundTaskIndex);
  });
});
