import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

import { isTaskInActiveProject, shallow, useTaskStore } from '@mindwtr/core';
import { TaskList } from '../../../components/task-list';
import { InboxProcessingModal } from '../../../components/inbox-processing-modal';
import { ErrorBoundary } from '../../../components/ErrorBoundary';

import { useLanguage } from '../../../contexts/language-context';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useMobileAreaFilter } from '@/hooks/use-mobile-area-filter';
import { taskMatchesAreaFilter } from '@mindwtr/core';
import { useQuickCapture } from '../../../contexts/quick-capture-context';

export default function InboxScreen() {
  const { tasks, projects, settings } = useTaskStore((state) => ({
    tasks: state.tasks,
    projects: state.projects,
    settings: state.settings,
  }), shallow);
  const { t } = useLanguage();
  const tc = useThemeColors();
  const { openQuickCapture } = useQuickCapture();
  const router = useRouter();
  const [showProcessing, setShowProcessing] = useState(false);
  const { areaById, resolvedAreaFilter } = useMobileAreaFilter();
  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  const inboxTasks = useMemo(() => {
    return tasks.filter(t => {
      if (t.deletedAt) return false;
      if (t.status !== 'inbox') return false;
      if (!isTaskInActiveProject(t, projectById)) return false;
      if (!taskMatchesAreaFilter(t, resolvedAreaFilter, projectById, areaById)) return false;
      return true;
    });
  }, [tasks, resolvedAreaFilter, projectById, areaById]);

  const defaultCaptureMethod = settings.gtd?.defaultCaptureMethod ?? 'text';
  const emptyHint = defaultCaptureMethod === 'audio'
    ? t('inbox.emptyAddHintVoice')
    : t('inbox.emptyAddHint');
  const emptyActionLabel = defaultCaptureMethod === 'audio'
    ? t('quickAdd.audioCaptureLabel')
    : t('nav.addTask');

  const headerButtons = (
    <View style={styles.headerButtonsRow}>
      <TouchableOpacity
        style={[styles.processHeaderButton, styles.mindSweepButton, { borderColor: tc.tint }]}
        onPress={() => router.push('/mind-sweep-modal')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('mindSweep.launchButton')}
      >
        <Text style={[styles.mindSweepButtonText, { color: tc.tint }]}>
          {t('mindSweep.launchButton')}
        </Text>
      </TouchableOpacity>
      {inboxTasks.length > 0 ? (
        <TouchableOpacity
          style={[styles.processHeaderButton, { backgroundColor: tc.tint }]}
          onPress={() => setShowProcessing(true)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('inbox.processButton')}
        >
          <Text style={styles.processHeaderButtonText}>
            ▷ {t('inbox.processButton')} ({inboxTasks.length})
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: tc.bg }]}>
      <TaskList
        statusFilter="inbox"
        title={t('inbox.title')}
        showHeader={false}
        enableBulkActions
        enableInboxBulkOrganize
        allowAdd={false}
        showQuickAddHelp={false}
        emptyText={t('inbox.empty')}
        emptyHint={emptyHint}
        emptyActionLabel={emptyActionLabel}
        onEmptyAction={() => openQuickCapture({ autoRecord: defaultCaptureMethod === 'audio' })}
        headerAccessory={headerButtons}
        defaultEditTab="task"
      />
      <ErrorBoundary>
        <InboxProcessingModal
          visible={showProcessing}
          onClose={() => setShowProcessing(false)}
        />
      </ErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  processHeaderButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  processHeaderButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  mindSweepButton: {
    borderWidth: 1,
  },
  mindSweepButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
