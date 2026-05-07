import { useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { tFallback, useTaskStore } from '@mindwtr/core';

import { useLanguage } from '../../../contexts/language-context';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { defaultListContentStyle, ListSectionHeader } from '@/components/list-layout';
import { IconSymbol } from '@/components/ui/icon-symbol';

function MenuRow({
  label,
  icon,
  iconColor,
  onPress,
  tc,
  isLast,
}: {
  label: string;
  icon: Parameters<typeof IconSymbol>[0]['name'];
  iconColor: string;
  onPress: () => void;
  tc: ReturnType<typeof useThemeColors>;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? tc.filterBg : 'transparent' },
        !isLast && { borderBottomWidth: 1, borderBottomColor: tc.border },
      ]}
    >
      <View style={styles.rowLeft}>
        <IconSymbol name={icon} size={18} color={iconColor} />
        <Text style={[styles.rowLabel, { color: tc.text }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <IconSymbol name="chevron.right" size={18} color={tc.secondaryText} />
    </Pressable>
  );
}

export default function MenuScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const tc = useThemeColors();
  const { settings } = useTaskStore();
  const [showTips, setShowTips] = useState(false);

  const savedSearches = settings?.savedSearches ?? [];
  const iconColors = {
    board: '#4F8CF7',
    calendar: '#35B8B1',
    projects: '#10B981',
    contexts: '#8B5CF6',
    waiting: '#F2B705',
    someday: '#6366F1',
    reference: '#0EA5E9',
    done: '#22C55E',
    archived: '#64748B',
    trash: '#EF4444',
    settings: '#64748B',
    help: '#0EA5E9',
    saved: '#4F8CF7',
  };
  const tips = useMemo(() => ({
    title: tFallback(t, 'mobileHelp.title', 'Mobile tips'),
    gesturesTitle: tFallback(t, 'mobileHelp.gesturesTitle', 'Gestures'),
    swipeRight: tFallback(t, 'mobileHelp.swipeRight', 'Swipe right on a task to move it forward.'),
    swipeLeft: tFallback(t, 'mobileHelp.swipeLeft', 'Swipe left to delete, restore, or send it back.'),
    longPressCapture: tFallback(t, 'mobileHelp.longPressCapture', 'Long-press + to use the alternate capture mode.'),
    shortcutsTitle: tFallback(t, 'mobileHelp.shortcutsTitle', 'Shortcuts'),
    appShortcuts: tFallback(t, 'mobileHelp.appShortcuts', 'Long-press the app icon for Add task, Focus, and Calendar shortcuts.'),
  }), [t]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: tc.bg }]} contentContainerStyle={defaultListContentStyle}>
      <ListSectionHeader title={t('nav.main')} tc={tc} />
      <View style={[styles.card, { backgroundColor: tc.cardBg, borderColor: tc.border }]}>
        <MenuRow label={t('nav.board')} icon="square.grid.2x2.fill" iconColor={iconColors.board} tc={tc} onPress={() => router.push('/board')} />
        <MenuRow label={t('nav.calendar')} icon="calendar" iconColor={iconColors.calendar} tc={tc} onPress={() => router.push('/calendar')} />
        <MenuRow label={t('nav.projects')} icon="folder.fill" iconColor={iconColors.projects} tc={tc} onPress={() => router.push('/projects-screen')} />
        <MenuRow label={t('nav.contexts')} icon="circle" iconColor={iconColors.contexts} tc={tc} onPress={() => router.push('/contexts')} />
        <MenuRow label={t('nav.waiting')} icon="pause.circle.fill" iconColor={iconColors.waiting} tc={tc} onPress={() => router.push('/waiting')} />
        <MenuRow label={t('nav.someday')} icon="arrow.up.circle.fill" iconColor={iconColors.someday} tc={tc} onPress={() => router.push('/someday')} />
        <MenuRow label={t('nav.reference')} icon="book.closed.fill" iconColor={iconColors.reference} tc={tc} onPress={() => router.push('/reference' as never)} />
        <MenuRow label={t('nav.done')} icon="checkmark.circle.fill" iconColor={iconColors.done} tc={tc} onPress={() => router.push('/done' as never)} />
        <MenuRow label={t('nav.archived')} icon="archivebox.fill" iconColor={iconColors.archived} tc={tc} onPress={() => router.push('/archived')} />
        <MenuRow label={t('nav.trash')} icon="trash.fill" iconColor={iconColors.trash} tc={tc} onPress={() => router.push('/trash')} />
        <MenuRow label={t('nav.settings')} icon="gearshape.fill" iconColor={iconColors.settings} tc={tc} onPress={() => router.push('/settings')} />
        <MenuRow label={tips.title} icon="questionmark.circle.fill" iconColor={iconColors.help} tc={tc} onPress={() => setShowTips(true)} isLast />
      </View>

      {savedSearches.length > 0 && (
        <>
          <ListSectionHeader title={t('search.savedSearches')} tc={tc} />
          <View style={[styles.card, { backgroundColor: tc.cardBg, borderColor: tc.border }]}>
            {savedSearches.map((search, idx) => (
              <MenuRow
                key={search.id}
                label={search.name}
                icon="tray.fill"
                iconColor={iconColors.saved}
                tc={tc}
                onPress={() => router.push(`/saved-search/${search.id}`)}
                isLast={idx === savedSearches.length - 1}
              />
            ))}
          </View>
        </>
      )}
      <Modal
        visible={showTips}
        transparent
        animationType="fade"
        accessibilityViewIsModal
        onRequestClose={() => setShowTips(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowTips(false)}>
          <Pressable
            style={[styles.tipsCard, { backgroundColor: tc.cardBg, borderColor: tc.border }]}
            accessibilityRole="summary"
          >
            <View style={styles.tipsHeader}>
              <Text style={[styles.tipsTitle, { color: tc.text }]}>{tips.title}</Text>
              <Pressable
                onPress={() => setShowTips(false)}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                hitSlop={10}
              >
                <Text style={[styles.closeText, { color: tc.secondaryText }]}>{t('common.close')}</Text>
              </Pressable>
            </View>
            <Text style={[styles.tipsSectionTitle, { color: tc.text }]}>{tips.gesturesTitle}</Text>
            <Text style={[styles.tipText, { color: tc.secondaryText }]}>{tips.swipeRight}</Text>
            <Text style={[styles.tipText, { color: tc.secondaryText }]}>{tips.swipeLeft}</Text>
            <Text style={[styles.tipText, { color: tc.secondaryText }]}>{tips.longPressCapture}</Text>
            <Text style={[styles.tipsSectionTitle, { color: tc.text }]}>{tips.shortcutsTitle}</Text>
            <Text style={[styles.tipText, { color: tc.secondaryText }]}>{tips.appShortcuts}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.36)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  tipsCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  tipsSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 6,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 7,
  },
});
