import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { BookOpen, CheckCircle2, Clock3, Cloud, Trash2, type LucideIcon } from 'lucide-react-native';
import type { QuickDatePreset } from '@mindwtr/core';
import type { ThemeColors } from '@/hooks/use-theme-colors';

import { styles } from '../inbox-processing-modal.styles';
import { InboxDateSelectorRow } from './InboxDateSelectorRow';

type ActionabilityChoice = 'actionable' | 'later' | 'trash' | 'someday' | 'reference';

type Props = {
  t: (key: string) => string;
  tc: ThemeColors;
  actionabilityChoice: ActionabilityChoice | null;
  setActionabilityChoice: (v: ActionabilityChoice) => void;
  referenceEnabled: boolean;
  laterLabel: string;
  laterHint: string;
  dateOnlyLabel: string;
  pendingStartDate: Date | null;
  laterNoDateSelected: boolean;
  setPendingStartDate: (v: Date | null) => void;
  setLaterNoDateSelected: (v: boolean) => void;
  pendingStartDateOnly: boolean;
  setPendingStartDateOnly: (v: boolean) => void;
  setShowStartDatePicker: (v: boolean) => void;
  defaultScheduleTime?: string | null;
};

function ChoiceButton({
  icon: Icon,
  label,
  selected,
  tc,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  selected: boolean;
  tc: ThemeColors;
  onPress: () => void;
}) {
  const foreground = selected ? tc.onTint : tc.text;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.bigButton,
        {
          backgroundColor: selected ? tc.tint : tc.cardBg,
          borderColor: selected ? tc.tint : tc.border,
        },
      ]}
      onPress={onPress}
    >
      <Icon size={20} color={foreground} strokeWidth={2} />
      <Text style={[styles.bigButtonText, { color: foreground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function InboxActionabilitySection({
  t,
  tc,
  actionabilityChoice,
  setActionabilityChoice,
  referenceEnabled,
  laterLabel,
  laterHint,
  dateOnlyLabel,
  pendingStartDate,
  laterNoDateSelected,
  setPendingStartDate,
  setLaterNoDateSelected,
  pendingStartDateOnly,
  setPendingStartDateOnly,
  setShowStartDatePicker,
  defaultScheduleTime,
}: Props) {
  const chooseActionability = (choice: ActionabilityChoice) => {
    setActionabilityChoice(choice);
    if (choice !== 'later') {
      setLaterNoDateSelected(false);
    }
  };

  return (
    <>
      <View style={[styles.singleSection, { borderBottomColor: tc.border }]}>
        <Text style={[styles.stepQuestion, { color: tc.text }]}>
          {t('inbox.isActionable')}
        </Text>
        <Text style={[styles.stepHint, { color: tc.secondaryText }]}>
          {t('inbox.actionableHint')}
        </Text>
        <View style={styles.buttonColumn}>
          <ChoiceButton icon={CheckCircle2} label={t('inbox.yesActionable')} selected={actionabilityChoice === 'actionable'} tc={tc} onPress={() => chooseActionability('actionable')} />
          <ChoiceButton icon={Clock3} label={laterLabel} selected={actionabilityChoice === 'later'} tc={tc} onPress={() => chooseActionability('later')} />
          <ChoiceButton icon={Trash2} label={t('inbox.trash')} selected={actionabilityChoice === 'trash'} tc={tc} onPress={() => chooseActionability('trash')} />
          <ChoiceButton icon={Cloud} label={t('inbox.someday')} selected={actionabilityChoice === 'someday'} tc={tc} onPress={() => chooseActionability('someday')} />
          {referenceEnabled && (
            <ChoiceButton icon={BookOpen} label={t('nav.reference')} selected={actionabilityChoice === 'reference'} tc={tc} onPress={() => chooseActionability('reference')} />
          )}
        </View>
      </View>

      {actionabilityChoice === 'later' && (
        <View style={[styles.singleSection, { borderBottomColor: tc.border }]}>
          <Text style={[styles.stepQuestion, { color: tc.text }]}>{laterLabel}</Text>
          <Text style={[styles.stepHint, { color: tc.secondaryText }]}>{laterHint}</Text>
          <InboxDateSelectorRow
            t={t}
            label={t('taskEdit.startDateLabel')}
            value={pendingStartDate}
            selectedPreset={laterNoDateSelected ? 'no_date' : null}
            onOpen={() => setShowStartDatePicker(true)}
            onClear={() => {
              setPendingStartDate(null);
              setPendingStartDateOnly(false);
              setLaterNoDateSelected(false);
            }}
            onQuickDateSelect={(date, preset: QuickDatePreset) => {
              setPendingStartDate(date);
              setPendingStartDateOnly(false);
              setLaterNoDateSelected(preset === 'no_date' ? !laterNoDateSelected : false);
            }}
            dateOnly={pendingStartDateOnly}
            onDateOnly={() => setPendingStartDateOnly(true)}
            onUseDefaultTime={() => setPendingStartDateOnly(false)}
            defaultScheduleTime={defaultScheduleTime}
            dateOnlyLabel={dateOnlyLabel}
            notSetLabel={t('common.notSet')}
            clearLabel={t('common.clear')}
            tc={tc}
          />
        </View>
      )}
    </>
  );
}
