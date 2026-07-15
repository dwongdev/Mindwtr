import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { CheckCircle2, Clock3, Timer } from 'lucide-react-native';

import { styles } from '../inbox-processing-modal.styles';
import type { ThemeColors } from '@/hooks/use-theme-colors';

type Props = {
  t: (key: string) => string;
  tc: ThemeColors;
  twoMinuteChoice: 'yes' | 'no' | null;
  setTwoMinuteChoice: (v: 'yes' | 'no') => void;
};

export function InboxTwoMinuteSection({ t, tc, twoMinuteChoice, setTwoMinuteChoice }: Props) {
  return (
    <View style={[styles.singleSection, { borderBottomColor: tc.border }]}>
      <View style={styles.stepQuestionRow}>
        <Timer size={20} color={tc.text} />
        <Text style={[styles.stepQuestion, styles.stepQuestionInline, { color: tc.text }]}>
          {t('inbox.twoMinRule')}
        </Text>
      </View>
      <Text style={[styles.stepHint, { color: tc.secondaryText }]}>
        {t('inbox.twoMinHint')}
      </Text>
      <View style={styles.buttonColumn}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected: twoMinuteChoice === 'yes' }}
          style={[
            styles.bigButton,
            {
              backgroundColor: twoMinuteChoice === 'yes' ? tc.tint : tc.cardBg,
              borderColor: twoMinuteChoice === 'yes' ? tc.tint : tc.border,
            },
          ]}
          onPress={() => setTwoMinuteChoice('yes')}
        >
          <CheckCircle2 size={20} color={twoMinuteChoice === 'yes' ? tc.onTint : tc.text} />
          <Text style={[styles.bigButtonText, { color: twoMinuteChoice === 'yes' ? tc.onTint : tc.text }]}>
            {t('inbox.doneIt')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected: twoMinuteChoice === 'no' }}
          style={[
            styles.bigButton,
            {
              backgroundColor: twoMinuteChoice === 'no' ? tc.tint : tc.cardBg,
              borderColor: twoMinuteChoice === 'no' ? tc.tint : tc.border,
            },
          ]}
          onPress={() => setTwoMinuteChoice('no')}
        >
          <Clock3 size={20} color={twoMinuteChoice === 'no' ? tc.onTint : tc.text} />
          <Text style={[styles.bigButtonText, { color: twoMinuteChoice === 'no' ? tc.onTint : tc.text }]}>
            {t('inbox.takesLonger')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
