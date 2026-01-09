import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { safeParseDate, type Task, type TaskStatus, useTaskStore } from '@mindwtr/core';

import { useLanguage } from '../contexts/language-context';
import { useTheme } from '../contexts/theme-context';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { SwipeableTaskItem } from './swipeable-task-item';

const buildSections = (tasks: Task[]) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const used = new Set<string>();

  const focused = tasks.filter((task) => task.isFocusedToday);
  focused.forEach((task) => used.add(task.id));

  const overdue = tasks.filter((task) => {
    if (used.has(task.id)) return false;
    const due = safeParseDate(task.dueDate);
    return Boolean(due && due < startOfToday);
  });
  overdue.forEach((task) => used.add(task.id));

  const dueToday = tasks.filter((task) => {
    if (used.has(task.id)) return false;
    const due = safeParseDate(task.dueDate);
    return Boolean(due && due >= startOfToday && due <= endOfToday);
  });
  dueToday.forEach((task) => used.add(task.id));

  const starting = tasks.filter((task) => {
    if (used.has(task.id)) return false;
    const start = safeParseDate(task.startTime);
    return Boolean(start && start <= endOfToday);
  });

  return [
    { key: 'focus', titleKey: 'agenda.todaysFocus', data: focused.slice(0, 3) },
    { key: 'overdue', titleKey: 'agenda.overdue', data: overdue },
    { key: 'dueToday', titleKey: 'agenda.dueToday', data: dueToday },
    { key: 'starting', titleKey: 'agenda.starting', data: starting },
  ].filter((section) => section.data.length > 0);
};

export function AgendaPreview({ onEdit }: { onEdit: (task: Task) => void }) {
  const { tasks, updateTask, deleteTask } = useTaskStore();
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const tc = useThemeColors();

  const agendaTasks = useMemo(() => {
    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return tasks.filter((task) => {
      if (task.deletedAt) return false;
      if (task.status === 'done') return false;
      const due = safeParseDate(task.dueDate);
      const start = safeParseDate(task.startTime);
      return Boolean(task.isFocusedToday)
        || Boolean(due && due <= endOfToday)
        || Boolean(start && start <= endOfToday);
    });
  }, [tasks]);

  const sections = useMemo(() => buildSections(agendaTasks), [agendaTasks]);

  if (sections.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: tc.text }]}>{t('agenda.title')}</Text>
      {sections.map((section) => (
        <View key={section.key} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: tc.secondaryText }]}>{t(section.titleKey)}</Text>
          <View style={styles.sectionList}>
            {section.data.map((task) => (
              <SwipeableTaskItem
                key={task.id}
                task={task}
                isDark={isDark}
                tc={tc}
                onPress={() => onEdit(task)}
                onStatusChange={(status: TaskStatus) => updateTask(task.id, { status })}
                onDelete={() => deleteTask(task.id)}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
  },
  heading: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  sectionList: {
    gap: 10,
    paddingHorizontal: 16,
  },
  emptyCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
});
