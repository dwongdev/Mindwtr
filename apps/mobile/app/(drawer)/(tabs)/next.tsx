import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTaskStore, PRESET_CONTEXTS, PRESET_TAGS, sortTasksBy, matchesHierarchicalToken, type Task, type Project, type TaskPriority, type TaskSortBy, type TaskStatus, type TimeEstimate } from '@mindwtr/core';
import { TaskEditModal } from '@/components/task-edit-modal';

import { useTheme } from '../../../contexts/theme-context';
import { useLanguage } from '../../../contexts/language-context';

import { useThemeColors } from '@/hooks/use-theme-colors';
import { SwipeableTaskItem } from '@/components/swipeable-task-item';


export default function NextActionsScreen() {
  const router = useRouter();
  const { tasks, projects, updateTask, deleteTask, settings, highlightTaskId, setHighlightTask } = useTaskStore();
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<TaskPriority[]>([]);
  const [selectedTimeEstimates, setSelectedTimeEstimates] = useState<TimeEstimate[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tc = useThemeColors();
  const sortBy = (settings?.taskSortBy ?? 'default') as TaskSortBy;

  // Get all unique contexts/tags from tasks (merge with presets)
  const allTokens = useMemo(() => Array.from(new Set([
    ...PRESET_CONTEXTS,
    ...PRESET_TAGS,
    ...tasks
      .filter((t) => !t.deletedAt && t.status === 'next')
      .flatMap(t => [...(t.contexts || []), ...(t.tags || [])]),
  ])).sort(), [tasks]);

  const projectMap = useMemo(() => {
    return projects.reduce((acc, project) => {
      acc[project.id] = project;
      return acc;
    }, {} as Record<string, Project>);
  }, [projects]);

  // For sequential projects, find the first (oldest) next task per project
  const sequentialProjectFirstTasks = useMemo(() => {
    const sequentialProjects = projects.filter(p => p.isSequential);
    const firstTaskIds = new Set<string>();

    for (const project of sequentialProjects) {
      const projectTasks = tasks
        .filter(t => t.projectId === project.id && t.status === 'next' && !t.deletedAt)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      if (projectTasks.length > 0) {
        firstTaskIds.add(projectTasks[0].id);
      }
    }
    return firstTaskIds;
  }, [tasks, projects]);

  const priorityOptions: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
  const timeEstimateOptions: TimeEstimate[] = ['5min', '10min', '15min', '30min', '1hr', '2hr', '3hr', '4hr', '4hr+'];
  const formatEstimate = (estimate: TimeEstimate) => {
    if (estimate.endsWith('min')) return estimate.replace('min', 'm');
    if (estimate.endsWith('hr+')) return estimate.replace('hr+', 'h+');
    if (estimate.endsWith('hr')) return estimate.replace('hr', 'h');
    return estimate;
  };
  const hasFilters = selectedTokens.length > 0 || selectedPriorities.length > 0 || selectedTimeEstimates.length > 0;
  const showFiltersPanel = filtersOpen || hasFilters;
  const toggleToken = (token: string) => {
    setSelectedTokens((prev) => (
      prev.includes(token) ? prev.filter((item) => item !== token) : [...prev, token]
    ));
  };
  const togglePriority = (priority: TaskPriority) => {
    setSelectedPriorities((prev) => (
      prev.includes(priority) ? prev.filter((item) => item !== priority) : [...prev, priority]
    ));
  };
  const toggleEstimate = (estimate: TimeEstimate) => {
    setSelectedTimeEstimates((prev) => (
      prev.includes(estimate) ? prev.filter((item) => item !== estimate) : [...prev, estimate]
    ));
  };
  const clearFilters = () => {
    setSelectedTokens([]);
    setSelectedPriorities([]);
    setSelectedTimeEstimates([]);
  };

  const nextTasks = sortTasksBy(tasks.filter(t => {
    if (t.deletedAt) return false;
    if (t.status !== 'next') return false;
    const taskTokens = [...(t.contexts || []), ...(t.tags || [])];
    if (selectedTokens.length > 0) {
      const matchesAll = selectedTokens.every((token) =>
        taskTokens.some((taskToken) => matchesHierarchicalToken(token, taskToken))
      );
      if (!matchesAll) return false;
    }
    if (selectedPriorities.length > 0 && (!t.priority || !selectedPriorities.includes(t.priority))) return false;
    if (selectedTimeEstimates.length > 0 && (!t.timeEstimate || !selectedTimeEstimates.includes(t.timeEstimate))) return false;
    // Sequential project filter
    if (t.projectId) {
      const project = projectMap[t.projectId];
      if (project?.isSequential && !sequentialProjectFirstTasks.has(t.id)) return false;
    }
    return true;
  }), sortBy);

  const onEdit = useCallback((task: Task) => {
    setEditingTask(task);
    setIsModalVisible(true);
  }, []);

  const onSaveTask = useCallback((taskId: string, updates: Partial<Task>) => {
    updateTask(taskId, updates);
  }, [updateTask]);

  const renderContextFilter = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.contextBar, { backgroundColor: tc.cardBg, borderBottomColor: tc.border }]}
      contentContainerStyle={styles.contextBarContent}
    >
      <TouchableOpacity
        style={[
          styles.contextChip,
          { backgroundColor: selectedTokens.length === 0 ? tc.tint : tc.filterBg, borderColor: tc.border },
        ]}
        onPress={() => setSelectedTokens([])}
      >
        <Text style={[
          styles.contextChipText,
          { color: selectedTokens.length === 0 ? '#FFFFFF' : tc.text }
        ]}>
          {t('common.all')}
        </Text>
      </TouchableOpacity>
      {allTokens.map(token => {
        const count = tasks.filter(t =>
          t.status === 'next' &&
          !t.deletedAt &&
          [...(t.contexts || []), ...(t.tags || [])].some((item) => matchesHierarchicalToken(token, item))
        ).length;
        const isActive = selectedTokens.includes(token);
        return (
          <TouchableOpacity
            key={token}
            style={[
              styles.contextChip,
              { backgroundColor: isActive ? tc.tint : tc.filterBg, borderColor: tc.border },
            ]}
            onPress={() => toggleToken(token)}
          >
            <Text style={[
              styles.contextChipText,
              { color: isActive ? '#FFFFFF' : tc.text }
            ]}>
              {token} {count > 0 && `(${count})`}
            </Text>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity
        style={[
          styles.contextChip,
          { backgroundColor: showFiltersPanel ? tc.tint : tc.filterBg, borderColor: tc.border },
        ]}
        onPress={() => setFiltersOpen((prev) => !prev)}
      >
        <Text style={[
          styles.contextChipText,
          { color: showFiltersPanel ? '#FFFFFF' : tc.text }
        ]}>
          {showFiltersPanel ? t('filters.hide') : t('filters.show')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderNextItem = useCallback(({ item }: { item: Task }) => (
    <SwipeableTaskItem
      task={item}
      isDark={isDark}
      tc={tc}
      onPress={() => onEdit(item)}
      onStatusChange={(status) => updateTask(item.id, { status: status as TaskStatus })}
      onDelete={() => deleteTask(item.id)}
      isHighlighted={item.id === highlightTaskId}
    />
  ), [onEdit, tc, updateTask, deleteTask, isDark, highlightTaskId]);

  useEffect(() => {
    if (!highlightTaskId) return;
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = setTimeout(() => {
      setHighlightTask(null);
    }, 3500);
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, [highlightTaskId, setHighlightTask]);

  return (
    <View style={[styles.container, { backgroundColor: tc.bg }]}>
      {renderContextFilter()}
      {showFiltersPanel && (
        <View style={[styles.filterPanel, { backgroundColor: tc.cardBg, borderBottomColor: tc.border }]}>
          <View style={styles.filterHeader}>
            <Text style={[styles.filterTitle, { color: tc.secondaryText }]}>{t('filters.label')}</Text>
            {hasFilters && (
              <TouchableOpacity onPress={clearFilters}>
                <Text style={[styles.filterAction, { color: tc.secondaryText }]}>{t('filters.clear')}</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: tc.secondaryText }]}>{t('filters.priority')}</Text>
            <View style={styles.filterChips}>
              {priorityOptions.map((priority) => {
                const isActive = selectedPriorities.includes(priority);
                return (
                  <TouchableOpacity
                    key={priority}
                    style={[
                      styles.contextChip,
                      { backgroundColor: isActive ? tc.tint : tc.filterBg, borderColor: tc.border },
                    ]}
                    onPress={() => togglePriority(priority)}
                  >
                    <Text style={[
                      styles.contextChipText,
                      { color: isActive ? '#FFFFFF' : tc.text }
                    ]}>
                      {t(`priority.${priority}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: tc.secondaryText }]}>{t('filters.timeEstimate')}</Text>
            <View style={styles.filterChips}>
              {timeEstimateOptions.map((estimate) => {
                const isActive = selectedTimeEstimates.includes(estimate);
                return (
                  <TouchableOpacity
                    key={estimate}
                    style={[
                      styles.contextChip,
                      { backgroundColor: isActive ? tc.tint : tc.filterBg, borderColor: tc.border },
                    ]}
                    onPress={() => toggleEstimate(estimate)}
                  >
                    <Text style={[
                      styles.contextChipText,
                      { color: isActive ? '#FFFFFF' : tc.text }
                    ]}>
                      {formatEstimate(estimate)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      )}

      {/* Next Actions Warning */}
      {nextTasks.length > 15 && (
        <View style={[styles.warningBanner, { backgroundColor: isDark ? '#78350F' : '#FEF3C7', borderColor: '#F59E0B' }]}>
          <Text style={[styles.warningText, { color: isDark ? '#FCD34D' : '#92400E' }]}>
            ⚠️ {nextTasks.length} {t('next.warningCount')}
          </Text>
          <Text style={[styles.warningHint, { color: isDark ? '#FCD34D' : '#92400E' }]}>
            {t('next.warningHint')}
          </Text>
        </View>
      )}

      <FlatList
        data={nextTasks}
        renderItem={renderNextItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: tc.secondaryText }]}>
              {hasFilters ? t('filters.noMatch') : t('next.noTasks')}
            </Text>
          </View>
        }
      />

      <TaskEditModal
        visible={isModalVisible}
        task={editingTask}
        onClose={() => setIsModalVisible(false)}
        onSave={onSaveTask}
        defaultTab="view"
        onFocusMode={(taskId) => {
          setIsModalVisible(false);
          router.push(`/check-focus?id=${taskId}`);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contextBar: {
    minHeight: 50,
    flexGrow: 0,
    zIndex: 10,
    elevation: 5,
  },
  contextBarContent: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    gap: 6,
    alignItems: 'center',
  },
  contextChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginRight: 6,
    borderWidth: 1,
  },
  contextChipActive: {
    backgroundColor: '#3B82F6',
  },
  contextChipText: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'none',
  },
  contextChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionSubtitle: {
    fontSize: 12,
  },
  contextBadge: {
    fontSize: 12,
    fontWeight: '500',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  todoSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  todoContent: {
    flex: 1,
  },
  todoTitle: {
    fontSize: 14,
  },
  promoteButton: {
    padding: 8,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  warningBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  warningText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  warningHint: {
    marginTop: 6,
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.95,
  },
  filterPanel: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterAction: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterSection: {
    marginBottom: 10,
  },
  filterLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});
