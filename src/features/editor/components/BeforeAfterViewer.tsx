import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing, typography } from '../../../theme/colors';
import { useEditorStore } from '../state/useEditorStore';

export const BeforeAfterViewer: React.FC = () => {
  const isSplitActive = useEditorStore(state => state.isSplitViewActive);
  const isHoldingOriginal = useEditorStore(state => state.isHoldingOriginal);
  const toggleSplitView = useEditorStore(state => state.toggleSplitView);
  const setHoldingOriginal = useEditorStore(state => state.setHoldingOriginal);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.btn, isSplitActive && styles.btnActive]}
        onPress={toggleSplitView}
      >
        <Text style={[styles.btnText, isSplitActive && styles.btnTextActive]}>
          Split
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, isHoldingOriginal && styles.btnActive]}
        onPressIn={() => setHoldingOriginal(true)}
        onPressOut={() => setHoldingOriginal(false)}
      >
        <Text style={[styles.btnText, isHoldingOriginal && styles.btnTextActive]}>
          Hold Original
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(26, 27, 32, 0.75)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8
  },
  btn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 4
  },
  btnActive: {
    backgroundColor: colors.accentPrimary
  },
  btnText: {
    ...typography.caption,
    color: colors.textSecondary
  },
  btnTextActive: {
    color: '#ffffff',
    fontWeight: '600'
  }
});
