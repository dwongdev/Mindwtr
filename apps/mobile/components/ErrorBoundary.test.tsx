import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import renderer from 'react-test-renderer';

import { ErrorBoundary } from './ErrorBoundary';

vi.mock('../lib/app-log', () => ({
  logError: vi.fn().mockResolvedValue(undefined),
}));

function Boom() {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    consoleError.mockClear();
  });

  afterEach(() => {
    consoleError.mockClear();
  });

  it('renders a fallback even without theme or language providers', () => {
    let tree: renderer.ReactTestRenderer | null = null;

    expect(() => {
      renderer.act(() => {
        tree = renderer.create(
          <ErrorBoundary>
            <Boom />
          </ErrorBoundary>
        );
      });
    }).not.toThrow();

    expect(JSON.stringify(tree?.toJSON())).toContain('Something went wrong');
    expect(JSON.stringify(tree?.toJSON())).toContain('boom');
  });
});
