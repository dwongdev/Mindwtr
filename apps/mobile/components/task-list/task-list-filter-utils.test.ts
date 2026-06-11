import { describe, expect, it } from 'vitest';
import type { Task } from '@mindwtr/core';

import {
  countActiveMobileTaskFilters,
  taskMatchesMobileTaskFilters,
  type MobileTaskListFilters,
} from './task-list-filter-utils';

const emptyFilters: MobileTaskListFilters = {
  energyLevels: [],
  locationQuery: '',
  priorities: [],
  searchQuery: '',
  timeEstimates: [],
  tokens: [],
  contextMatchMode: 'all',
};

const task: Task = {
  contexts: ['@work/deep'],
  createdAt: '2026-05-27T10:00:00.000Z',
  description: 'Draft launch notes',
  energyLevel: 'high',
  id: 'c5290e2c-1b77-4f77-8927-6d187e141891',
  location: 'Office',
  priority: 'urgent',
  status: 'next',
  tags: ['#client/acme'],
  timeEstimate: '30min',
  title: 'Prepare release checklist',
  updatedAt: '2026-05-27T10:00:00.000Z',
};

describe('task-list-filter-utils', () => {
  it('counts active filters across text and chip dimensions', () => {
    expect(countActiveMobileTaskFilters(emptyFilters)).toBe(0);
    expect(countActiveMobileTaskFilters({
      ...emptyFilters,
      energyLevels: ['high'],
      locationQuery: 'office',
      priorities: ['urgent'],
      searchQuery: 'release',
      timeEstimates: ['30min'],
      tokens: ['@work', '#client'],
    })).toBe(7);
  });

  it('matches search query against title and description', () => {
    expect(taskMatchesMobileTaskFilters(task, { ...emptyFilters, searchQuery: 'release' })).toBe(true);
    expect(taskMatchesMobileTaskFilters(task, { ...emptyFilters, searchQuery: 'launch notes' })).toBe(true);
    expect(taskMatchesMobileTaskFilters(task, { ...emptyFilters, searchQuery: 'vacation' })).toBe(false);
  });

  it('matches fielded task id searches with full and partial UUIDs', () => {
    expect(taskMatchesMobileTaskFilters(task, { ...emptyFilters, searchQuery: 'id:c5290e2c-1b77-4f77-8927-6d187e141891' })).toBe(true);
    expect(taskMatchesMobileTaskFilters(task, { ...emptyFilters, searchQuery: 'id:6d187e141891' })).toBe(true);
    expect(taskMatchesMobileTaskFilters(task, { ...emptyFilters, searchQuery: 'id:missing-task-id' })).toBe(false);
  });

  it('matches context and tag filters using hierarchy prefixes', () => {
    expect(taskMatchesMobileTaskFilters(task, { ...emptyFilters, tokens: ['@work', '#client'] })).toBe(true);
    expect(taskMatchesMobileTaskFilters(task, { ...emptyFilters, tokens: ['@workshop'] })).toBe(false);
    expect(taskMatchesMobileTaskFilters(task, { ...emptyFilters, tokens: ['#ops'] })).toBe(false);
  });

  it('can match any selected context while keeping tag filters required', () => {
    expect(taskMatchesMobileTaskFilters(task, {
      ...emptyFilters,
      tokens: ['@work', '@phone'],
      contextMatchMode: 'all',
    })).toBe(false);
    expect(taskMatchesMobileTaskFilters(task, {
      ...emptyFilters,
      tokens: ['@work', '@phone'],
      contextMatchMode: 'any',
    })).toBe(true);
    expect(taskMatchesMobileTaskFilters(task, {
      ...emptyFilters,
      tokens: ['@work', '@phone', '#ops'],
      contextMatchMode: 'any',
    })).toBe(false);
  });

  it('matches priority, energy, time estimate, and location filters', () => {
    expect(taskMatchesMobileTaskFilters(task, {
      ...emptyFilters,
      energyLevels: ['high'],
      locationQuery: 'off',
      priorities: ['urgent'],
      timeEstimates: ['30min'],
    })).toBe(true);

    expect(taskMatchesMobileTaskFilters(task, { ...emptyFilters, priorities: ['low'] })).toBe(false);
    expect(taskMatchesMobileTaskFilters(task, { ...emptyFilters, energyLevels: ['low'] })).toBe(false);
    expect(taskMatchesMobileTaskFilters(task, { ...emptyFilters, timeEstimates: ['5min'] })).toBe(false);
    expect(taskMatchesMobileTaskFilters(task, { ...emptyFilters, locationQuery: 'home' })).toBe(false);
  });

  it('matches custom time estimates by their coarse bucket', () => {
    const customTask = { ...task, timeEstimate: 'custom:150' as const };
    expect(taskMatchesMobileTaskFilters(customTask, { ...emptyFilters, timeEstimates: ['3hr'] })).toBe(true);
    expect(taskMatchesMobileTaskFilters(customTask, { ...emptyFilters, timeEstimates: ['2hr'] })).toBe(false);
  });
});
