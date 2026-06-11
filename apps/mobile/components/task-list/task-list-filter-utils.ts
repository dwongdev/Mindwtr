import type { MultiValueFilterMatchMode, Task, TaskEnergyLevel, TaskPriority, TimeEstimate } from '@mindwtr/core';
import { matchesHierarchicalToken, matchesTask, parseSearchQuery, timeEstimateToFilterBucket } from '@mindwtr/core';

export type MobileTaskListFilters = {
  energyLevels: TaskEnergyLevel[];
  locationQuery: string;
  priorities: TaskPriority[];
  searchQuery: string;
  timeEstimates: TimeEstimate[];
  tokens: string[];
  contextMatchMode: MultiValueFilterMatchMode;
};

const normalize = (value: string | undefined): string => value?.trim().toLowerCase() ?? '';

export const countActiveMobileTaskFilters = (filters: MobileTaskListFilters): number => (
  (normalize(filters.searchQuery) ? 1 : 0)
  + (normalize(filters.locationQuery) ? 1 : 0)
  + filters.tokens.length
  + filters.priorities.length
  + filters.energyLevels.length
  + filters.timeEstimates.length
);

export const taskMatchesMobileTaskFilters = (
  task: Task,
  filters: MobileTaskListFilters,
): boolean => {
  const searchQuery = normalize(filters.searchQuery);
  if (searchQuery) {
    const parsedSearch = parseSearchQuery(searchQuery);
    const hasFieldedTerm = parsedSearch.clauses.some((clause) =>
      clause.terms.some((term) => term.field !== null)
    );
    if (hasFieldedTerm) {
      const now = new Date();
      const matchesSearch = parsedSearch.clauses.some((clause) =>
        clause.terms.every((term) => matchesTask(term, task, null, now))
      );
      if (!matchesSearch) return false;
    } else {
      const searchable = `${task.title} ${task.description ?? ''}`.toLowerCase();
      if (!searchable.includes(searchQuery)) return false;
    }
  }

  if (filters.tokens.length > 0) {
    const contextTokens = filters.tokens.filter((token) => token.trim().startsWith('@'));
    const tagTokens = filters.tokens.filter((token) => token.trim().startsWith('#'));
    const matchesContext = contextTokens.length === 0 || (
      filters.contextMatchMode === 'any'
        ? contextTokens.some((token) => (task.contexts ?? []).some((taskToken) => matchesHierarchicalToken(token, taskToken)))
        : contextTokens.every((token) => (task.contexts ?? []).some((taskToken) => matchesHierarchicalToken(token, taskToken)))
    );
    const matchesTags = tagTokens.every((token) =>
      (task.tags ?? []).some((taskToken) => matchesHierarchicalToken(token, taskToken))
    );
    if (!matchesContext || !matchesTags) return false;
  }

  if (filters.priorities.length > 0 && (!task.priority || !filters.priorities.includes(task.priority))) {
    return false;
  }

  if (filters.energyLevels.length > 0 && (!task.energyLevel || !filters.energyLevels.includes(task.energyLevel))) {
    return false;
  }

  if (filters.timeEstimates.length > 0) {
    const bucket = timeEstimateToFilterBucket(task.timeEstimate);
    if (!bucket || !filters.timeEstimates.includes(bucket)) {
      return false;
    }
  }

  const locationQuery = normalize(filters.locationQuery);
  if (locationQuery && !normalize(task.location).includes(locationQuery)) {
    return false;
  }

  return true;
};
