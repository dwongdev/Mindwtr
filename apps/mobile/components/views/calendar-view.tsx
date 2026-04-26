import { Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { safeFormatDate, safeParseDate, type Task } from '@mindwtr/core';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { TaskEditModal } from '@/components/task-edit-modal';
import { openContextsScreen, openProjectScreen } from '@/lib/task-meta-navigation';
import { styles } from './calendar/calendar-view.styles';
import { useCalendarViewController } from './calendar/useCalendarViewController';

export function CalendarView() {
  const {
    DAY_END_HOUR,
    DAY_START_HOUR,
    PIXELS_PER_MINUTE,
    SNAP_MINUTES,
    calendarDays,
    calendarNameById,
    closeEditingTask,
    commitTaskDrag,
    currentMonth,
    currentYear,
    dayNames,
    editingTask,
    externalCalendars,
    externalError,
    formatHourLabel,
    formatTimeRange,
    getCalendarItemsForDate,
    getExternalEventsForDate,
    getScheduleSlotLabel,
    getTaskCountForDate,
    handleNextMonth,
    handlePrevMonth,
    handleToday,
    isDark,
    isExternalLoading,
    isSameDay,
    isToday,
    locale,
    localize,
    markTaskDone,
    monthLabel,
    nextQuickScheduleCandidates,
    openQuickAddForDate,
    openTaskActions,
    saveEditingTask,
    scheduleQuery,
    scheduleTaskOnSelectedDate,
    searchCandidates,
    selectedDate,
    selectedDateAllDayEvents,
    selectedDateDeadlines,
    selectedDateExternalEvents,
    selectedDateLongLabel,
    selectedDateScheduled,
    selectedDateTimedEvents,
    selectedDayModeLabel,
    selectedDayNowTop,
    selectedDayScheduledTasks,
    selectedDayStart,
    selectedDayEnd,
    scheduleSections,
    setScheduleQuery,
    setSelectedDate,
    setTimelineScrollEnabled,
    setViewMode,
    shiftSelectedDate,
    sourceColorForId,
    t,
    tc,
    timeEstimateToMinutes,
    timelineHeight,
    timelineScrollRef,
    toRgba,
    viewMode,
  } = useCalendarViewController();
  const { height: screenHeight } = useWindowDimensions();
  const bottomSheetSnap = useSharedValue(0.42);
  const bottomSheetStart = useSharedValue(0.42);
  const bottomSheetGesture = Gesture.Pan()
    .onStart(() => {
      bottomSheetStart.value = bottomSheetSnap.value;
    })
    .onUpdate((event) => {
      const next = bottomSheetStart.value - (event.translationY / Math.max(screenHeight, 1));
      bottomSheetSnap.value = Math.max(0.3, Math.min(0.9, next));
    })
    .onEnd(() => {
      const snapPoints = [0.3, 0.6, 0.9];
      let nearest = snapPoints[0];
      let nearestDistance = Math.abs(bottomSheetSnap.value - nearest);
      for (const snap of snapPoints) {
        const distance = Math.abs(bottomSheetSnap.value - snap);
        if (distance < nearestDistance) {
          nearest = snap;
          nearestDistance = distance;
        }
      }
      bottomSheetSnap.value = withSpring(nearest);
    });
  const bottomSheetStyle = useAnimatedStyle(() => ({
    height: Math.max(220, screenHeight * bottomSheetSnap.value),
  }));

  const triggerDragHaptic = () => {
    Haptics.selectionAsync().catch(() => {});
  };

  const modeOptions = [
    { value: 'month' as const, label: localize('Month', '月') },
    { value: 'day' as const, label: localize('Day', '日') },
    { value: 'schedule' as const, label: localize('Schedule', '日程') },
  ];

  const renderModeToggle = () => (
    <View style={[styles.modeToggle, { backgroundColor: tc.inputBg, borderColor: tc.border }]}>
      {modeOptions.map((option) => {
        const active = viewMode === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => setViewMode(option.value)}
            style={[styles.modeToggleButton, active && { backgroundColor: tc.tint }]}
          >
            <Text style={[styles.modeToggleText, { color: active ? tc.onTint : tc.secondaryText }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  function ScheduledTaskBlock({
    task,
    dayStartMs,
    durationMinutes,
    height,
    top,
  }: {
    task: Task;
    dayStartMs: number;
    durationMinutes: number;
    height: number;
    top: number;
  }) {
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);
    const zIndex = useSharedValue(1);
    const taskId = task.id;

    const panGesture = Gesture.Pan()
      .activateAfterLongPress(140)
      .onStart(() => {
        scale.value = withSpring(1.02);
        zIndex.value = 50;
        runOnJS(triggerDragHaptic)();
        runOnJS(setTimelineScrollEnabled)(false);
      })
      .onUpdate((event) => {
        translateY.value = event.translationY;
      })
      .onEnd((event) => {
        const dayMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60;
        const startMinutes = Math.round((top + event.translationY) / PIXELS_PER_MINUTE / SNAP_MINUTES) * SNAP_MINUTES;
        const clampedMinutes = Math.max(0, Math.min(dayMinutes - durationMinutes, startMinutes));
        runOnJS(commitTaskDrag)(taskId, dayStartMs, clampedMinutes, durationMinutes);
        translateY.value = withSpring(0);
        scale.value = withSpring(1);
        zIndex.value = 1;
      })
      .onFinalize(() => {
        runOnJS(setTimelineScrollEnabled)(true);
      });

    const tapGesture = Gesture.Tap().onEnd(() => {
      runOnJS(openTaskActions)(taskId);
    });

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: translateY.value }, { scale: scale.value }],
      zIndex: zIndex.value,
    }));

    const start = task.startTime ? safeParseDate(task.startTime) : null;
    const label = start ? formatTimeRange(start, durationMinutes) : '';
    const compact = height < 48;
    const showTime = height >= 44;

    return (
      <GestureDetector gesture={Gesture.Race(panGesture, tapGesture)}>
        <Animated.View
          style={[
            styles.taskBlock,
            {
              top,
              height,
              paddingVertical: compact ? 2 : 8,
              justifyContent: compact ? 'center' : undefined,
              backgroundColor: isDark ? toRgba(tc.tint, 0.85) : tc.tint,
              borderColor: toRgba(tc.tint, isDark ? 0.6 : 0.3),
            },
            animatedStyle,
          ]}
        >
          <Text style={[styles.taskBlockTitle, compact && styles.taskBlockTitleCompact]} numberOfLines={compact ? 1 : 2}>
            {task.title}
          </Text>
          {showTime && (
            <Text style={styles.taskBlockTime} numberOfLines={1}>
              {label}
            </Text>
          )}
        </Animated.View>
      </GestureDetector>
    );
  }

  if (viewMode === 'day' && selectedDate && selectedDayStart && selectedDayEnd) {
    return (
      <View style={[styles.container, { backgroundColor: tc.bg }]}>
        <View style={[styles.dayModeHeader, { backgroundColor: tc.cardBg, borderBottomColor: tc.border }]}>
          <View style={styles.headerTopRow}>
            <Pressable onPress={() => shiftSelectedDate(-1)} style={styles.navButton}>
              <Text style={[styles.navButtonText, { color: tc.text }]}>‹</Text>
            </Pressable>
            <View style={styles.dayModeTitleWrap}>
              <Text style={[styles.dayModeTitle, { color: tc.text }]} numberOfLines={1}>
                {selectedDayModeLabel}
              </Text>
              <Pressable onPress={handleToday} style={[styles.todayButton, { borderColor: tc.border }]}>
                <Text style={[styles.todayButtonText, { color: tc.tint }]}>{localize('Today', '今天')}</Text>
              </Pressable>
            </View>
            <View style={styles.dayModeNav}>
              <Pressable onPress={() => openQuickAddForDate(selectedDate)} style={styles.dayNavButton}>
                <Text style={[styles.dayNavText, { color: tc.text }]}>＋</Text>
              </Pressable>
              <Pressable onPress={() => shiftSelectedDate(1)} style={styles.navButton}>
                <Text style={[styles.navButtonText, { color: tc.text }]}>›</Text>
              </Pressable>
            </View>
          </View>
          {renderModeToggle()}
        </View>

        <ScrollView
          ref={timelineScrollRef}
          style={styles.dayScroll}
          contentContainerStyle={styles.dayScrollContent}
        >
          {selectedDateAllDayEvents.length > 0 && (
            <View style={[styles.allDayCard, { backgroundColor: tc.cardBg, borderColor: tc.border }]}>
              <Text style={[styles.sectionLabel, { color: tc.secondaryText }]}>{t('calendar.allDay')}</Text>
              {selectedDateAllDayEvents.slice(0, 6).map((event) => (
                <Text key={event.id} style={[styles.allDayItem, { color: tc.text }]} numberOfLines={1}>
                  {event.title}
                </Text>
              ))}
            </View>
          )}

          <View style={[styles.timelineCard, { backgroundColor: tc.cardBg, borderColor: tc.border }]}>
            <View style={[styles.timelineArea, { height: timelineHeight }]}>
              {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, idx) => {
                const hour = DAY_START_HOUR + idx;
                const top = idx * 60 * PIXELS_PER_MINUTE;
                return (
                  <View key={hour} style={[styles.hourLine, { top }]}>
                    <Text style={[styles.hourLabel, { color: tc.secondaryText }]}>{formatHourLabel(hour)}</Text>
                    <View style={[styles.hourDivider, { backgroundColor: tc.border }]} />
                  </View>
                );
              })}

              {selectedDayNowTop != null && (
                <View style={[styles.nowLine, { top: selectedDayNowTop }]}>
                  <View style={styles.nowDot} />
                  <View style={styles.nowRule} />
                </View>
              )}

              {selectedDateTimedEvents.map((event) => {
                const start = safeParseDate(event.start);
                const end = safeParseDate(event.end);
                if (!start || !end) return null;
                const clampedStart = new Date(Math.max(start.getTime(), selectedDayStart.getTime()));
                const clampedEnd = new Date(Math.min(end.getTime(), selectedDayEnd.getTime()));
                const startMinutes = (clampedStart.getTime() - selectedDayStart.getTime()) / 60_000;
                const endMinutes = (clampedEnd.getTime() - selectedDayStart.getTime()) / 60_000;
                const top = Math.max(0, startMinutes) * PIXELS_PER_MINUTE;
                const height = Math.max(16, (endMinutes - startMinutes) * PIXELS_PER_MINUTE);
                const timeLabel = formatTimeRange(clampedStart, Math.max(1, Math.round(endMinutes - startMinutes)));
                return (
                  <View
                    key={event.id}
                    style={[
                      styles.eventBlock,
                      {
                        top,
                        height,
                        backgroundColor: toRgba(tc.secondaryText, isDark ? 0.35 : 0.18),
                        borderColor: sourceColorForId(event.sourceId),
                      },
                    ]}
                  >
                    <Text style={[styles.eventBlockTitle, { color: tc.text }]} numberOfLines={1}>
                      {event.title}
                    </Text>
                    <Text style={[styles.eventBlockTime, { color: tc.secondaryText }]} numberOfLines={1}>
                      {timeLabel}
                    </Text>
                  </View>
                );
              })}

              {selectedDayScheduledTasks.map((task) => {
                const start = task.startTime ? safeParseDate(task.startTime) : null;
                if (!start) return null;
                const durationMinutes = timeEstimateToMinutes(task.timeEstimate);
                const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
                const clampedStart = new Date(Math.max(start.getTime(), selectedDayStart.getTime()));
                const clampedEnd = new Date(Math.min(end.getTime(), selectedDayEnd.getTime()));
                const startMinutes = (clampedStart.getTime() - selectedDayStart.getTime()) / 60_000;
                const endMinutes = (clampedEnd.getTime() - selectedDayStart.getTime()) / 60_000;
                const top = Math.max(0, startMinutes) * PIXELS_PER_MINUTE;
                const height = Math.max(24, (endMinutes - startMinutes) * PIXELS_PER_MINUTE);
                return (
                  <ScheduledTaskBlock
                    key={task.id}
                    task={task}
                    dayStartMs={selectedDayStart.getTime()}
                    top={top}
                    height={height}
                    durationMinutes={durationMinutes}
                  />
                );
              })}
            </View>
          </View>

          <View style={[styles.dayScheduleCard, { backgroundColor: tc.cardBg, borderColor: tc.border }]}>
            {nextQuickScheduleCandidates.length > 0 && (
              <View style={styles.scheduleResults}>
                <Text style={[styles.scheduleResultsTitle, { color: tc.secondaryText }]}>{t('nav.next')}</Text>
                {nextQuickScheduleCandidates.map((task) => {
                  const slotLabel = getScheduleSlotLabel(selectedDate, task);
                  return (
                    <Pressable
                      key={task.id}
                      style={[styles.taskItem, { backgroundColor: tc.inputBg, borderLeftColor: tc.tint }]}
                      onPress={() => scheduleTaskOnSelectedDate(task.id)}
                    >
                      <Text style={[styles.taskItemTitle, { color: tc.text }]} numberOfLines={1}>
                        {task.title}
                      </Text>
                      <Text style={[styles.taskItemTime, { color: tc.secondaryText }]}>
                        {slotLabel ? `${t('calendar.scheduleAction')} · ${slotLabel}` : t('calendar.scheduleAction')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View style={styles.addTaskForm}>
              <TextInput
                style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.text }]}
                value={scheduleQuery}
                onChangeText={setScheduleQuery}
                placeholder={t('calendar.schedulePlaceholder')}
                placeholderTextColor={tc.secondaryText}
              />
            </View>

            {searchCandidates.length > 0 && (
              <View style={styles.scheduleResults}>
                <Text style={[styles.scheduleResultsTitle, { color: tc.secondaryText }]}>
                  {t('calendar.scheduleResults')}
                </Text>
                {searchCandidates.map((task) => {
                  const slotLabel = getScheduleSlotLabel(selectedDate, task);
                  return (
                    <Pressable
                      key={task.id}
                      style={[styles.taskItem, { backgroundColor: tc.inputBg, borderLeftColor: tc.tint }]}
                      onPress={() => scheduleTaskOnSelectedDate(task.id)}
                    >
                      <Text style={[styles.taskItemTitle, { color: tc.text }]} numberOfLines={1}>
                        {task.title}
                      </Text>
                      <Text style={[styles.taskItemTime, { color: tc.secondaryText }]}>
                        {slotLabel ? `${t('calendar.scheduleAction')} · ${slotLabel}` : t('calendar.scheduleAction')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

        <TaskEditModal
          visible={Boolean(editingTask)}
          task={editingTask}
          onClose={closeEditingTask}
          onSave={saveEditingTask}
          defaultTab="view"
          onProjectNavigate={openProjectScreen}
          onContextNavigate={openContextsScreen}
          onTagNavigate={openContextsScreen}
        />
      </View>
    );
  }

  if (viewMode === 'schedule') {
    return (
      <View style={[styles.container, { backgroundColor: tc.bg }]}>
        <View style={[styles.header, { backgroundColor: tc.cardBg, borderBottomColor: tc.border }]}>
          <View style={styles.headerTopRow}>
            <Pressable onPress={handlePrevMonth} style={styles.navButton}>
              <Text style={[styles.navButtonText, { color: tc.text }]}>‹</Text>
            </Pressable>
            <View style={styles.monthTitleWrap}>
              <Text style={[styles.title, { color: tc.text }]}>{localize('Schedule', '日程')}</Text>
              <Pressable onPress={handleToday} style={[styles.todayButton, { borderColor: tc.border }]}>
                <Text style={[styles.todayButtonText, { color: tc.tint }]}>{localize('Today', '今天')}</Text>
              </Pressable>
            </View>
            <Pressable onPress={handleNextMonth} style={styles.navButton}>
              <Text style={[styles.navButtonText, { color: tc.text }]}>›</Text>
            </Pressable>
          </View>
          {renderModeToggle()}
        </View>

        <ScrollView style={styles.scheduleScroll} contentContainerStyle={styles.scheduleContent}>
          {scheduleSections.map((section) => (
            <View key={section.id} style={styles.scheduleSection}>
              <Text style={[styles.scheduleDate, { color: tc.secondaryText }]}>
                {section.date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })}
                {isToday(section.date) ? ` · ${localize('Today', '今天')}` : ''}
              </Text>
              <View style={styles.scheduleItems}>
                {section.items.map((item) => {
                  if (item.kind === 'event') {
                    const start = safeParseDate(item.event.start);
                    const end = safeParseDate(item.event.end);
                    const timeLabel = item.event.allDay
                      ? t('calendar.allDay')
                      : start && end
                        ? `${safeFormatDate(start, 'p')}-${safeFormatDate(end, 'p')}`
                        : '';
                    const sourceName = calendarNameById.get(item.event.sourceId);
                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.scheduleItem,
                          styles.eventItem,
                          {
                            backgroundColor: tc.inputBg,
                            borderLeftColor: sourceColorForId(item.event.sourceId),
                          },
                        ]}
                      >
                        <View style={styles.taskItemMain}>
                          <Text style={[styles.taskItemTitle, { color: tc.text }]} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={[styles.taskItemTime, { color: tc.secondaryText }]} numberOfLines={1}>
                            {sourceName ? `${timeLabel} · ${sourceName}` : timeLabel}
                          </Text>
                        </View>
                      </View>
                    );
                  }

                  const start = item.task.startTime ? safeParseDate(item.task.startTime) : null;
                  const timeLabel = start
                    ? formatTimeRange(start, timeEstimateToMinutes(item.task.timeEstimate))
                    : t('calendar.deadline');
                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.scheduleItem,
                        {
                          backgroundColor: item.kind === 'scheduled' ? toRgba(tc.tint, isDark ? 0.2 : 0.12) : tc.inputBg,
                          borderLeftColor: item.kind === 'scheduled' ? tc.tint : tc.danger,
                        },
                      ]}
                      onPress={() => openTaskActions(item.task.id)}
                    >
                      <View style={styles.taskItemMain}>
                        <Text style={[styles.taskItemTitle, { color: tc.text }]} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={[styles.taskItemTime, { color: tc.secondaryText }]}>
                          {timeLabel}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
          {scheduleSections.length === 0 && (
            <Text style={[styles.noTasks, { color: tc.secondaryText }]}>{t('calendar.noTasks')}</Text>
          )}
        </ScrollView>

        <TaskEditModal
          visible={Boolean(editingTask)}
          task={editingTask}
          onClose={closeEditingTask}
          onSave={saveEditingTask}
          defaultTab="view"
          onProjectNavigate={openProjectScreen}
          onContextNavigate={openContextsScreen}
          onTagNavigate={openContextsScreen}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: tc.bg }]}>
      <View style={[styles.header, { backgroundColor: tc.cardBg, borderBottomColor: tc.border }]}>
        <View style={styles.headerTopRow}>
          <Pressable onPress={handlePrevMonth} style={styles.navButton}>
            <Text style={[styles.navButtonText, { color: tc.text }]}>‹</Text>
          </Pressable>
          <View style={styles.monthTitleWrap}>
            <Text style={[styles.title, { color: tc.text }]} numberOfLines={1}>
              {monthLabel}
            </Text>
            <Pressable onPress={handleToday} style={[styles.todayButton, { borderColor: tc.border }]}>
              <Text style={[styles.todayButtonText, { color: tc.tint }]}>{localize('Today', '今天')}</Text>
            </Pressable>
          </View>
          <Pressable onPress={handleNextMonth} style={styles.navButton}>
            <Text style={[styles.navButtonText, { color: tc.text }]}>›</Text>
          </Pressable>
        </View>
        {renderModeToggle()}
      </View>

      <View style={styles.monthCalendar}>
        <View style={[styles.dayHeaders, { backgroundColor: tc.cardBg, borderBottomColor: tc.border }]}>
          {dayNames.map((day) => (
            <View key={day} style={styles.dayHeader}>
              <Text style={[styles.dayHeaderText, { color: tc.secondaryText }]}>{day}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.calendarGrid, selectedDate && styles.calendarGridCompact]}>
          {calendarDays.map((day, index) => {
            if (day === null) {
              return <View key={`empty-${index}`} style={[styles.dayCell, selectedDate && styles.dayCellCompact]} />;
            }

            const date = new Date(currentYear, currentMonth, day);
            const taskCount = getTaskCountForDate(date);
            const eventCount = getExternalEventsForDate(date).length;
            const calendarItems = getCalendarItemsForDate(date);
            const visibleItems = calendarItems.slice(0, calendarItems.length >= 6 ? 0 : 2);
            const isSelected = selectedDate && isSameDay(date, selectedDate);
            const todayCellBg = toRgba(tc.tint, isDark ? 0.12 : 0.08);
            const selectedCellBg = toRgba(tc.tint, isDark ? 0.2 : 0.16);

            return (
              <Pressable
                key={day}
                style={[
                  styles.dayCell,
                  selectedDate && styles.dayCellCompact,
                  isToday(date) && { backgroundColor: todayCellBg },
                  isSelected && { backgroundColor: selectedCellBg },
                ]}
                onPress={() => setSelectedDate(date)}
              >
                <View
                  style={[
                    styles.dayNumber,
                    selectedDate && styles.dayNumberCompact,
                    isToday(date) && styles.todayNumber,
                    isToday(date) && { backgroundColor: tc.tint },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      selectedDate && styles.dayTextCompact,
                      { color: tc.text },
                      isToday(date) && styles.todayText,
                      isToday(date) && { color: tc.onTint },
                    ]}
                  >
                    {day}
                  </Text>
                </View>
                {visibleItems.length > 0 && (
                  <View style={styles.monthPreviewList}>
                    {visibleItems.map((item) => {
                      const isEvent = item.kind === 'event';
                      return (
                        <View
                          key={item.id}
                          style={[
                            styles.monthPreviewItem,
                            {
                              backgroundColor: item.kind === 'scheduled'
                                ? toRgba(tc.tint, isDark ? 0.24 : 0.14)
                                : item.kind === 'deadline'
                                  ? 'transparent'
                                  : toRgba(tc.secondaryText, isDark ? 0.28 : 0.16),
                              borderLeftColor: isEvent
                                ? sourceColorForId(item.event.sourceId)
                                : item.kind === 'deadline'
                                  ? tc.danger
                                  : tc.tint,
                            },
                          ]}
                        >
                          <Text
                            style={[styles.monthPreviewText, { color: item.kind === 'scheduled' ? tc.tint : tc.text }]}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
                {calendarItems.length >= 6 && (taskCount > 0 || eventCount > 0) && (
                  <View style={styles.indicatorRow}>
                    {taskCount > 0 && (
                      <View style={[styles.taskDot, { backgroundColor: tc.tint }]}>
                        <Text style={[styles.taskDotText, { color: tc.onTint }]}>{taskCount}</Text>
                      </View>
                    )}
                    {eventCount > 0 && (
                      <View style={[styles.eventDot, { backgroundColor: tc.secondaryText }]}>
                        <Text style={[styles.eventDotText, { color: tc.bg }]}>{eventCount}</Text>
                      </View>
                    )}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {selectedDate && (
        <Animated.View style={[styles.monthDetailsPane, bottomSheetStyle, { backgroundColor: tc.cardBg, borderTopColor: tc.border }]}>
          <GestureDetector gesture={bottomSheetGesture}>
            <View style={styles.sheetHandleWrap}>
              <View style={[styles.sheetHandle, { backgroundColor: tc.border }]} />
            </View>
          </GestureDetector>
          <ScrollView contentContainerStyle={styles.monthDetailsContent} keyboardShouldPersistTaps="handled">
            <View style={styles.monthDetailsHeader}>
              <Text style={[styles.selectedDateTitle, { color: tc.text }]}>
                {selectedDateLongLabel}
              </Text>
              <Pressable onPress={() => openQuickAddForDate(selectedDate)} style={styles.addTaskButton}>
                <Text style={[styles.addTaskButtonText, { color: tc.tint }]}>{t('calendar.addTask')}</Text>
              </Pressable>
            </View>

            {nextQuickScheduleCandidates.length > 0 && (
              <View style={styles.scheduleResults}>
                <Text style={[styles.scheduleResultsTitle, { color: tc.secondaryText }]}>{t('nav.next')}</Text>
                {nextQuickScheduleCandidates.map((task) => {
                  const slotLabel = getScheduleSlotLabel(selectedDate, task);
                  return (
                    <Pressable
                      key={task.id}
                      style={[styles.taskItem, { backgroundColor: tc.inputBg, borderLeftColor: tc.tint }]}
                      onPress={() => scheduleTaskOnSelectedDate(task.id)}
                    >
                      <Text style={[styles.taskItemTitle, { color: tc.text }]} numberOfLines={1}>
                        {task.title}
                      </Text>
                      <Text style={[styles.taskItemTime, { color: tc.secondaryText }]}>
                        {slotLabel ? `${t('calendar.scheduleAction')} · ${slotLabel}` : t('calendar.scheduleAction')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View style={styles.addTaskForm}>
              <TextInput
                style={[styles.input, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.text }]}
                value={scheduleQuery}
                onChangeText={setScheduleQuery}
                placeholder={t('calendar.schedulePlaceholder')}
                placeholderTextColor={tc.secondaryText}
              />
            </View>

            <View style={styles.tasksList}>
              {searchCandidates.length > 0 && (
                <View style={styles.scheduleResults}>
                  <Text style={[styles.scheduleResultsTitle, { color: tc.secondaryText }]}>
                    {t('calendar.scheduleResults')}
                  </Text>
                  {searchCandidates.map((task) => {
                    const slotLabel = getScheduleSlotLabel(selectedDate, task);
                    return (
                      <Pressable
                        key={task.id}
                        style={[styles.taskItem, { backgroundColor: tc.inputBg, borderLeftColor: tc.tint }]}
                        onPress={() => scheduleTaskOnSelectedDate(task.id)}
                      >
                        <Text style={[styles.taskItemTitle, { color: tc.text }]} numberOfLines={1}>
                          {task.title}
                        </Text>
                        <Text style={[styles.taskItemTime, { color: tc.secondaryText }]}>
                          {slotLabel ? `${t('calendar.scheduleAction')} · ${slotLabel}` : t('calendar.scheduleAction')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {externalCalendars.length > 0 && (
                <View style={styles.scheduleResults}>
                  <Text style={[styles.scheduleResultsTitle, { color: tc.secondaryText }]}>
                    {t('calendar.events')}
                  </Text>
                  {isExternalLoading && (
                    <Text style={[styles.taskItemTime, { color: tc.secondaryText }]}>
                      {localize('Loading…', '加载中…')}
                    </Text>
                  )}
                  {externalError && (
                    <Text style={[styles.taskItemTime, { color: tc.danger }]} numberOfLines={2}>
                      {externalError}
                    </Text>
                  )}
                  {selectedDateExternalEvents.map((event) => (
                    <View
                      key={event.id}
                      style={[styles.taskItem, styles.eventItem, { backgroundColor: tc.inputBg, borderLeftColor: tc.secondaryText }]}
                    >
                      <Text style={[styles.taskItemTitle, { color: tc.text }]} numberOfLines={1}>
                        {event.title}
                        {calendarNameById.get(event.sourceId) ? ` (${calendarNameById.get(event.sourceId)})` : ''}
                      </Text>
                      <Text style={[styles.taskItemTime, { color: tc.secondaryText }]}>
                        {event.allDay ? t('calendar.allDay') : (() => {
                          const start = safeParseDate(event.start);
                          const end = safeParseDate(event.end);
                          if (!start || !end) return '';
                          return `${safeFormatDate(start, 'p')}-${safeFormatDate(end, 'p')}`;
                        })()}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {selectedDateDeadlines.map((task) => (
                <View key={task.id} style={[styles.taskItem, { backgroundColor: tc.inputBg, borderLeftColor: tc.tint }]}>
                  <Pressable style={styles.taskItemMain} onPress={() => openTaskActions(task.id)}>
                    <Text style={[styles.taskItemTitle, { color: tc.text }]} numberOfLines={1}>
                      {task.title}
                    </Text>
                    <Text style={[styles.taskItemTime, { color: tc.secondaryText }]}>
                      {t('calendar.deadline')}
                    </Text>
                  </Pressable>
                  {task.status !== 'done' && task.status !== 'archived' && (
                    <Pressable
                      style={[styles.quickDoneButton, { borderColor: toRgba(tc.tint, 0.35), backgroundColor: toRgba(tc.tint, 0.16) }]}
                      onPress={() => markTaskDone(task.id)}
                    >
                      <Text style={[styles.quickDoneButtonText, { color: tc.tint }]}>{t('status.done')}</Text>
                    </Pressable>
                  )}
                </View>
              ))}

              {selectedDateScheduled.map((task) => (
                <Pressable
                  key={task.id}
                  style={[styles.taskItem, { backgroundColor: tc.inputBg, borderLeftColor: tc.tint }]}
                  onPress={() => openTaskActions(task.id)}
                >
                  <View style={styles.taskItemMain}>
                    <Text style={[styles.taskItemTitle, { color: tc.text }]} numberOfLines={1}>
                      {task.title}
                    </Text>
                    <Text style={[styles.taskItemTime, { color: tc.secondaryText }]}>
                      {(() => {
                        const start = safeParseDate(task.startTime);
                        if (!start) return '';
                        const durMs = timeEstimateToMinutes(task.timeEstimate) * 60 * 1000;
                        const end = new Date(start.getTime() + durMs);
                        const startLabel = safeFormatDate(start, 'p');
                        const endLabel = safeFormatDate(end, 'p');
                        return `${startLabel}-${endLabel}`;
                      })()}
                    </Text>
                  </View>
                  {task.status !== 'done' && task.status !== 'archived' && (
                    <Pressable
                      style={[styles.quickDoneButton, { borderColor: toRgba(tc.tint, 0.35), backgroundColor: toRgba(tc.tint, 0.16) }]}
                      onPress={(event) => {
                        event.stopPropagation();
                        markTaskDone(task.id);
                      }}
                    >
                      <Text style={[styles.quickDoneButtonText, { color: tc.tint }]}>{t('status.done')}</Text>
                    </Pressable>
                  )}
                </Pressable>
              ))}

              {selectedDateDeadlines.length === 0
                && selectedDateScheduled.length === 0
                && selectedDateExternalEvents.length === 0 && (
                <Text style={[styles.noTasks, { color: tc.secondaryText }]}>{t('calendar.noTasks')}</Text>
              )}
            </View>
          </ScrollView>
        </Animated.View>
      )}

      <TaskEditModal
        visible={Boolean(editingTask)}
        task={editingTask}
        onClose={closeEditingTask}
        onSave={saveEditingTask}
        defaultTab="view"
        onProjectNavigate={openProjectScreen}
        onContextNavigate={openContextsScreen}
        onTagNavigate={openContextsScreen}
      />
    </View>
  );
}
