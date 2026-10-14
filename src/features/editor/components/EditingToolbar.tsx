import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing, typography } from '../../../theme/colors';
import { EditorTab, useEditorStore } from '../state/useEditorStore';

interface TabItem {
  id: EditorTab;
  label: string;
}

const TABS: TabItem[] = [
  { id: 'light', label: 'Light' },
  { id: 'curves', label: 'Curves' },
  { id: 'color', label: 'Color' },
  { id: 'grading', label: 'Grading' },
  { id: 'mixer', label: 'Mixer' },
  { id: 'masking', label: 'Masking' },
  { id: 'erase', label: 'Erase' },
  { id: 'crop', label: 'Crop' },
  { id: 'presets', label: 'Presets' }
];

export const EditingToolbar: React.FC = () => {
  const activeTab = useEditorStore(state => state.activeTab);
  const setActiveTab = useEditorStore(state => state.setActiveTab);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {isActive && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 52,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm
  },
  tabButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  tabButtonActive: {
    // Active styling
  },
  tabLabel: {
    ...typography.bodyMedium,
    color: colors.textMuted
  },
  tabLabelActive: {
    color: colors.textPrimary,
    fontWeight: '600'
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 2,
    width: 16,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.accentPrimary
  }
});
