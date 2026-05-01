import { BackHandler, View, Text, ScrollView, Pressable, StyleSheet, TouchableOpacity, Modal, TextInput, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTaskStore, sortTasksBy, type Task, type TaskStatus, type TaskSortBy } from '@mindwtr/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../contexts/theme-context';
import { useLanguage } from '../../contexts/language-context';
import { useMobileAreaFilter } from '@/hooks/use-mobile-area-filter';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { taskMatchesAreaFilter } from '@/lib/area-filter';
import { openContextsScreen, openProjectScreen } from '@/lib/task-meta-navigation';
import { ReviewModal } from '../../components/review-modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { logError } from '../../lib/app-log';

import { TaskEditModal } from '@/components/task-edit-modal';
import { SwipeableTaskItem } from '@/components/swipeable-task-item';
import { buildReviewTaskGroups } from '@/components/review/review-task-groups';

const STATUS_OPTIONS: TaskStatus[] = ['inbox', 'next', 'waiting', 'someday', 'done'];

export default function ReviewScreen() {
  const router = useRouter();
  const { tasks, projects, updateTask, deleteTask, batchMoveTasks, batchDeleteTasks, batchUpdateTasks, settings } = useTaskStore();
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [expandedAreaIds, setExpandedAreaIds] = useState<Set<string>>(new Set());
  const [expandedReviewProjectIds, setExpandedReviewProjectIds] = useState<Set<string>>(new Set());

  const tc = useThemeColors();
  const insets = useSafeAreaInsets();
  const { areaById, resolvedAreaFilter, sortedAreas } = useMobileAreaFilter();
  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const areaOrderById = useMemo(
    () => new Map(sortedAreas.map((area, index) => [area.id, index])),
    [sortedAreas],
  );

  const tasksById = useMemo(() => {
    return tasks.reduce((acc, task) => {
      acc[task.id] = task;
      return acc;
    }, {} as Record<string, Task>);
  }, [tasks]);

  const selectedIdsArray = useMemo(() => Array.from(multiSelectedIds), [multiSelectedIds]);
  const hasSelection = selectedIdsArray.length > 0;

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setMultiSelectedIds(new Set());
  }, []);

  useEffect(() => {
    exitSelectionMode();
  }, [filterStatus, exitSelectionMode]);

  useFocusEffect(
    useCallback(() => {
      setExpandedAreaIds(new Set());
      setExpandedReviewProjectIds(new Set());
      return undefined;
    }, []),
  );

  useEffect(() => {
    const handleBackPress = () => {
      if (isModalVisible || tagModalVisible || moveModalVisible || showReviewModal) {
        return false;
      }
      if (!selectionMode) return false;
      exitSelectionMode();
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => subscription.remove();
  }, [selectionMode, exitSelectionMode, isModalVisible, tagModalVisible, moveModalVisible, showReviewModal]);

  const toggleMultiSelect = useCallback((taskId: string) => {
    if (!selectionMode) setSelectionMode(true);
    setMultiSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, [selectionMode]);

  const handleBatchMove = useCallback(async (newStatus: TaskStatus) => {
    if (!hasSelection) return;
    await batchMoveTasks(selectedIdsArray, newStatus);
    exitSelectionMode();
  }, [batchMoveTasks, selectedIdsArray, hasSelection, exitSelectionMode]);

  const handleBatchDelete = useCallback(async () => {
    if (!hasSelection) return;
    await batchDeleteTasks(selectedIdsArray);
    exitSelectionMode();
  }, [batchDeleteTasks, selectedIdsArray, hasSelection, exitSelectionMode]);

  const handleBatchShare = useCallback(async () => {
    if (!hasSelection) return;
    const selectedTasks = selectedIdsArray.map((id) => tasksById[id]).filter(Boolean);
    const lines: string[] = [];

    selectedTasks.forEach((task) => {
      lines.push(`- ${task.title}`);
      if (task.checklist?.length) {
        task.checklist.forEach((item) => {
          if (!item.title) return;
          lines.push(`  - ${item.isCompleted ? '[x]' : '[ ]'} ${item.title}`);
        });
      }
    });

    const message = lines.join('\n').trim();
    if (!message) return;

    try {
      await Share.share({ message });
      exitSelectionMode();
    } catch (error) {
      void logError(error, { scope: 'review', extra: { message: 'Share failed' } });
    }
  }, [hasSelection, selectedIdsArray, tasksById, exitSelectionMode]);

  const handleBatchAddTag = useCallback(async () => {
    const input = tagInput.trim();
    if (!hasSelection || !input) return;
    const tag = input.startsWith('#') ? input : `#${input}`;
    await batchUpdateTasks(selectedIdsArray.map((id) => {
      const task = tasksById[id];
      const existingTags = task?.tags || [];
      const nextTags = Array.from(new Set([...existingTags, tag]));
      return { id, updates: { tags: nextTags } };
    }));
    setTagInput('');
    setTagModalVisible(false);
    exitSelectionMode();
  }, [batchUpdateTasks, selectedIdsArray, tasksById, tagInput, hasSelection, exitSelectionMode]);

  const bulkStatuses: TaskStatus[] = ['inbox', 'next', 'waiting', 'someday', 'reference', 'done'];

  // Filter out deleted tasks first, then apply status filter
  const activeTasks = tasks.filter((task) => (
    !task.deletedAt
    && task.status !== 'reference'
    && taskMatchesAreaFilter(task, resolvedAreaFilter, projectById, areaById)
  ));
  const filteredTasks = activeTasks.filter((task) =>
    filterStatus === 'all' ? true : task.status === filterStatus
  );

  const sortBy = (settings?.taskSortBy ?? 'default') as TaskSortBy;
  const sortedTasks = sortTasksBy(filteredTasks, sortBy);
  const noAreaLabel = t('review.noArea');
  const singleActionsLabel = t('review.singleActions');
  const translateOr = useCallback((key: string, fallback: string) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  }, [t]);
  const unassignedLabel = translateOr('review.unassigned', 'Unassigned');
  const projectsLabel = translateOr('review.projectsLabel', 'projects');
  const needsActionLabel = translateOr('review.needsActionSummary', 'needs action');
  const withoutAreaLabel = translateOr('review.withoutArea', 'without an area');
  const activeTasksLabel = translateOr('review.activeTasks', 'active tasks');
  const reviewTaskGroups = useMemo(() => {
    return buildReviewTaskGroups({
      areaById,
      areaOrderById,
      noAreaLabel: unassignedLabel || noAreaLabel,
      projectById,
      singleActionsLabel,
      sortedTasks,
      tintColor: tc.tint,
    });
  }, [areaById, areaOrderById, noAreaLabel, projectById, singleActionsLabel, sortedTasks, tc.tint, unassignedLabel]);

  const toggleAreaExpanded = useCallback((areaId: string) => {
    setExpandedAreaIds((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);
      return next;
    });
  }, []);

  const toggleReviewProjectExpanded = useCallback((projectGroupId: string) => {
    setExpandedReviewProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectGroupId)) next.delete(projectGroupId);
      else next.add(projectGroupId);
      return next;
    });
  }, []);

  const renderReviewTaskItem = (task: Task) => (
    <SwipeableTaskItem
      key={task.id}
      task={task}
      isDark={isDark}
      tc={tc}
      onPress={() => {
        setEditingTask(task);
        setIsModalVisible(true);
      }}
      selectionMode={selectionMode}
      isMultiSelected={multiSelectedIds.has(task.id)}
      onToggleSelect={() => toggleMultiSelect(task.id)}
      onStatusChange={(status) => updateTask(task.id, { status: status as TaskStatus })}
      onDelete={() => deleteTask(task.id)}
      onProjectPress={openProjectScreen}
      onContextPress={openContextsScreen}
      onTagPress={openContextsScreen}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: tc.bg }]}>
      <View style={[styles.toolbar, { backgroundColor: tc.cardBg, borderBottomColor: tc.border }]}>
        <TouchableOpacity
          style={[
            styles.selectButton,
            { borderColor: tc.border, backgroundColor: selectionMode ? tc.filterBg : 'transparent' }
          ]}
          onPress={() => (selectionMode ? exitSelectionMode() : setSelectionMode(true))}
        >
          <Text style={[styles.selectButtonText, { color: tc.text }]}>
            {selectionMode ? t('bulk.exitSelect') : t('bulk.select')}
          </Text>
        </TouchableOpacity>

        <View style={styles.headerButtonsRow}>
          <TouchableOpacity
            style={[styles.guideButton, { borderColor: tc.border, backgroundColor: tc.filterBg }]}
            onPress={() => router.push('/daily-review')}
          >
            <Text
              style={[styles.guideButtonText, { color: tc.text }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t('dailyReview.title')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.guideButtonPrimary, { backgroundColor: tc.tint }]}
            onPress={() => setShowReviewModal(true)}
          >
            <Text style={styles.guideButtonPrimaryText} numberOfLines={1} ellipsizeMode="tail">
              {t('review.openGuide')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal style={[styles.filterBar, { backgroundColor: tc.cardBg, borderBottomColor: tc.border }]} showsHorizontalScrollIndicator={false}>
        <Pressable
          style={[
            styles.filterButton,
            { backgroundColor: filterStatus === 'all' ? tc.tint : tc.filterBg },
          ]}
          onPress={() => setFilterStatus('all')}
        >
          <Text style={[styles.filterText, { color: filterStatus === 'all' ? '#FFFFFF' : tc.secondaryText }]}>
            {t('common.all')} ({activeTasks.length})
          </Text>
        </Pressable>
        {STATUS_OPTIONS.map((status) => (
          <Pressable
            key={status}
            style={[
              styles.filterButton,
              { backgroundColor: filterStatus === status ? tc.tint : tc.filterBg },
            ]}
            onPress={() => setFilterStatus(status)}
          >
            <Text style={[styles.filterText, { color: filterStatus === status ? '#FFFFFF' : tc.secondaryText }]}>
              {t(`status.${status}`)} ({activeTasks.filter((t) => t.status === status).length})
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {selectionMode && (
        <View style={[styles.bulkBar, { backgroundColor: tc.cardBg, borderBottomColor: tc.border }]}>
          <Text style={[styles.bulkCount, { color: tc.secondaryText }]}>
            {selectedIdsArray.length} {t('bulk.selected')}
          </Text>
          <View style={styles.bulkActions}>
            <TouchableOpacity
              onPress={() => setMoveModalVisible(true)}
              disabled={!hasSelection}
              style={[styles.bulkActionButton, { backgroundColor: tc.filterBg, opacity: hasSelection ? 1 : 0.5 }]}
            >
              <Text style={[styles.bulkActionText, { color: tc.text }]}>{t('bulk.moveTo')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTagModalVisible(true)}
              disabled={!hasSelection}
              style={[styles.bulkActionButton, { backgroundColor: tc.filterBg, opacity: hasSelection ? 1 : 0.5 }]}
            >
              <Text style={[styles.bulkActionText, { color: tc.text }]}>{t('bulk.addTag')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleBatchShare}
              disabled={!hasSelection}
              style={[styles.bulkActionButton, { backgroundColor: tc.filterBg, opacity: hasSelection ? 1 : 0.5 }]}
            >
              <Text style={[styles.bulkActionText, { color: tc.text }]}>{t('common.share')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleBatchDelete}
              disabled={!hasSelection}
              style={[styles.bulkActionButton, { backgroundColor: tc.filterBg, opacity: hasSelection ? 1 : 0.5 }]}
            >
              <Text style={[styles.bulkActionText, { color: tc.text }]}>{t('bulk.delete')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView style={styles.taskList} contentContainerStyle={{ paddingBottom: 16 + insets.bottom }}>
        {filterStatus === 'all' ? (
          reviewTaskGroups.map((areaGroup) => {
            const areaExpanded = expandedAreaIds.has(areaGroup.id);
            const taskSummary = areaGroup.isUnassigned
              ? `${areaGroup.taskCount} ${t('common.tasks')} ${withoutAreaLabel}`
              : `${areaGroup.taskCount} ${t('common.tasks')}`;
            return (
              <View key={areaGroup.id} style={styles.reviewAreaSection}>
                <Pressable
                  style={[
                    styles.reviewAreaHeader,
                    {
                      backgroundColor: tc.cardBg,
                      borderColor: tc.border,
                      borderLeftColor: areaGroup.color,
                    },
                  ]}
                  onPress={() => toggleAreaExpanded(areaGroup.id)}
                >
                  <View style={styles.reviewAreaHeaderMain}>
                    <View style={[styles.reviewAreaDot, { backgroundColor: areaGroup.color }]} />
                    <View style={styles.reviewAreaTextBlock}>
                      <Text style={[styles.reviewAreaTitle, { color: tc.text }]} numberOfLines={1}>
                        {areaGroup.title}
                      </Text>
                      <View style={styles.reviewAreaSummaryRow}>
                        {areaGroup.projectCount > 0 && (
                          <View style={[styles.reviewSummaryPill, { backgroundColor: tc.filterBg }]}>
                            <Text style={[styles.reviewSummaryPillText, { color: tc.secondaryText }]}>
                              {areaGroup.projectCount} {projectsLabel}
                            </Text>
                          </View>
                        )}
                        {areaGroup.needsActionCount > 0 && (
                          <View style={[styles.reviewSummaryPill, styles.reviewNeedsSummaryPill]}>
                            <Text style={[styles.reviewSummaryPillText, styles.reviewNeedsSummaryText]}>
                              {areaGroup.needsActionCount} {needsActionLabel}
                            </Text>
                          </View>
                        )}
                        <View style={[styles.reviewSummaryPill, { backgroundColor: tc.filterBg }]}>
                          <Text style={[styles.reviewSummaryPillText, { color: tc.secondaryText }]}>
                            {taskSummary}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  {areaExpanded
                    ? <ChevronDown size={20} color={tc.secondaryText} strokeWidth={2.4} />
                    : <ChevronRight size={20} color={tc.secondaryText} strokeWidth={2.4} />}
                </Pressable>

                {areaExpanded && (
                  <View style={styles.reviewAreaBody}>
                    {areaGroup.projectGroups.map((projectGroup) => {
                      const projectExpanded = expandedReviewProjectIds.has(projectGroup.id);
                      return (
                        <View key={projectGroup.id} style={[styles.reviewProjectGroup, { borderLeftColor: areaGroup.color }]}>
                          <Pressable
                            style={[
                              styles.reviewProjectHeader,
                              {
                                backgroundColor: tc.filterBg,
                                borderColor: tc.border,
                              },
                            ]}
                            onPress={() => toggleReviewProjectExpanded(projectGroup.id)}
                          >
                            <View style={styles.reviewProjectHeaderTop}>
                              <View style={styles.reviewProjectTitleRow}>
                                <Text style={[styles.reviewProjectTitle, { color: tc.text }]} numberOfLines={1}>
                                  {projectGroup.title}
                                </Text>
                                {projectGroup.projectId ? (
                                  <View style={[
                                    styles.reviewStatusBadge,
                                    { backgroundColor: projectGroup.hasNextAction ? '#10B98120' : '#EF444420' },
                                  ]}>
                                    <Text style={[
                                      styles.reviewStatusText,
                                      { color: projectGroup.hasNextAction ? '#10B981' : '#EF4444' },
                                    ]} numberOfLines={1}>
                                      {projectGroup.hasNextAction ? t('review.hasNextAction') : t('review.needsAction')}
                                    </Text>
                                  </View>
                                ) : (
                                  <View style={[styles.reviewSingleActionsBadge, { backgroundColor: tc.cardBg }]}>
                                    <Text style={[styles.reviewSingleActionsText, { color: tc.secondaryText }]}>
                                      {singleActionsLabel}
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <Text style={[styles.reviewProjectCount, { color: tc.secondaryText }]}>
                                {projectGroup.tasks.length}
                              </Text>
                            </View>
                            <View style={styles.reviewProjectMetaRow}>
                              <Text style={[styles.reviewProjectMetaText, { color: tc.secondaryText }]} numberOfLines={1}>
                                {projectGroup.isSingleActions
                                  ? `${projectGroup.tasks.length} ${t('common.tasks')}`
                                  : `${projectGroup.tasks.length} ${activeTasksLabel}`}
                              </Text>
                              {projectExpanded
                                ? <ChevronDown size={16} color={tc.secondaryText} strokeWidth={2.3} />
                                : <ChevronRight size={16} color={tc.secondaryText} strokeWidth={2.3} />}
                            </View>
                          </Pressable>
                          {projectExpanded && (
                            <View style={styles.reviewGroupedTasks}>
                              {projectGroup.tasks.map(renderReviewTaskItem)}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        ) : (
          sortedTasks.map(renderReviewTaskItem)
        )}
        {sortedTasks.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: tc.secondaryText }]}>{t('review.noTasks')}</Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={moveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMoveModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMoveModalVisible(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: tc.cardBg }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: tc.text }]}>{t('bulk.moveTo')}</Text>
            <View style={styles.moveOptions}>
              {bulkStatuses.map((status) => (
                <TouchableOpacity
                  key={status}
                  onPress={async () => {
                    setMoveModalVisible(false);
                    await handleBatchMove(status);
                  }}
                  disabled={!hasSelection}
                  style={[
                    styles.moveOptionButton,
                    { backgroundColor: tc.filterBg, borderColor: tc.border, opacity: hasSelection ? 1 : 0.5 },
                  ]}
                >
                  <Text style={[styles.moveOptionText, { color: tc.text }]}>{t(`status.${status}`)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => setMoveModalVisible(false)}
                style={styles.modalButton}
              >
                <Text style={[styles.modalButtonText, { color: tc.secondaryText }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={tagModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTagModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setTagModalVisible(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: tc.cardBg }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: tc.text }]}>{t('bulk.addTag')}</Text>
            <TextInput
              value={tagInput}
              onChangeText={setTagInput}
              placeholder={t('taskEdit.tagsLabel')}
              placeholderTextColor={tc.secondaryText}
              style={[styles.modalInput, { backgroundColor: tc.filterBg, color: tc.text, borderColor: tc.border }]}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => {
                  setTagModalVisible(false);
                  setTagInput('');
                }}
                style={styles.modalButton}
              >
                <Text style={[styles.modalButtonText, { color: tc.secondaryText }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleBatchAddTag}
                disabled={!tagInput.trim()}
                style={[styles.modalButton, !tagInput.trim() && styles.modalButtonDisabled]}
              >
                <Text style={[styles.modalButtonText, { color: tc.tint }]}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <TaskEditModal
        visible={isModalVisible}
        task={editingTask}
        onClose={() => setIsModalVisible(false)}
        onSave={(taskId, updates) => updateTask(taskId, updates)}
        defaultTab="view"
        onProjectNavigate={openProjectScreen}
        onContextNavigate={openContextsScreen}
        onTagNavigate={openContextsScreen}
        onFocusMode={(taskId) => {
          setIsModalVisible(false);
          router.push(`/check-focus?id=${taskId}`);
        }}
      />

      <ReviewModal
        visible={showReviewModal}
        onClose={() => setShowReviewModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  filterBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    maxHeight: 56,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    marginRight: 8,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  taskList: {
    flex: 1,
    padding: 16,
  },
  reviewAreaSection: {
    marginBottom: 12,
  },
  reviewAreaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  reviewAreaHeaderMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  reviewAreaTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  reviewAreaDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  reviewAreaTitle: {
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  reviewAreaSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reviewSummaryPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reviewSummaryPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  reviewNeedsSummaryPill: {
    backgroundColor: '#EF444420',
  },
  reviewNeedsSummaryText: {
    color: '#EF4444',
  },
  reviewAreaBody: {
    marginTop: 10,
  },
  reviewProjectGroup: {
    borderLeftWidth: 3,
    marginLeft: 14,
    marginBottom: 10,
    paddingLeft: 10,
  },
  reviewProjectHeader: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  reviewProjectHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  reviewProjectTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  reviewProjectTitle: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  reviewProjectCount: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 20,
    textAlign: 'right',
  },
  reviewProjectMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  reviewProjectMetaText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  reviewStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  reviewStatusText: {
    fontSize: 11,
    fontWeight: '700',
    maxWidth: 120,
  },
  reviewSingleActionsBadge: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  reviewSingleActionsText: {
    fontSize: 11,
    fontWeight: '700',
  },
  reviewGroupedTasks: {
    marginTop: 8,
    gap: 8,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  guideButton: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  guideButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  guideButtonPrimary: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  guideButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  headerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    flexShrink: 1,
  },
  selectButton: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bulkBar: {
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  bulkCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  bulkMoveRow: {
    gap: 6,
    paddingVertical: 2,
  },
  bulkMoveButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  bulkMoveText: {
    fontSize: 12,
    fontWeight: '500',
  },
  bulkActions: {
    flexDirection: 'row',
    gap: 8,
  },
  bulkActionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  bulkActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  moveOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moveOptionButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  moveOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
