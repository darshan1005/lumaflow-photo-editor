import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing, typography } from '../../../theme/colors';
import { useEditorStore } from '../state/useEditorStore';
import { AdjustmentSlider } from './AdjustmentSlider';

export const ColorWheel: React.FC = () => {
  const [selectedWheel, setSelectedWheel] = useState<'shadows' | 'midtones' | 'highlights' | 'global'>('shadows');
  const grading = useEditorStore(state => state.currentDocument.colorGrading);
  const updateGradingTone = useEditorStore(state => state.updateGradingTone);
  const updateGradingParams = useEditorStore(state => state.updateGradingParams);
  const beginAdjustment = useEditorStore(state => state.beginAdjustment);
  const endAdjustment = useEditorStore(state => state.endAdjustment);

  const activeData = grading[selectedWheel];
  const swatchColor = activeData.saturation > 0
    ? `hsl(${activeData.hue}, ${activeData.saturation}%, 50%)`
    : activeData.hue > 0
      ? `hsl(${activeData.hue}, 40%, 65%)`
      : 'rgba(255, 255, 255, 0.2)';

  return (
    <View style={styles.outerContainer}>
      {/* Wheel Selector Pills */}
      <View style={styles.pillRow}>
        {(['shadows', 'midtones', 'highlights', 'global'] as const).map(wheel => {
          const isActive = selectedWheel === wheel;
          const wheelData = grading[wheel];
          const hasColor = wheelData.saturation > 0 || Math.abs(wheelData.luminance) > 0;
          return (
            <TouchableOpacity
              key={wheel}
              style={[styles.pill, isActive && styles.pillActive]}
              onPress={() => setSelectedWheel(wheel)}
            >
              <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                {wheel.charAt(0).toUpperCase() + wheel.slice(1)}
              </Text>
              {hasColor && <View style={styles.activeDot} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Scrollable Sliders Area */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {/* Selected Tone Preview Indicator */}
        <View style={styles.previewRow}>
          <View style={[styles.colorSwatch, { backgroundColor: swatchColor }]} />
          <View style={styles.previewInfo}>
            <Text style={styles.previewTitle}>
              {selectedWheel.toUpperCase()} COLOR GRADE
            </Text>
            <Text style={styles.previewSubtitle}>
              {activeData.saturation > 0
                ? `Hue: ${activeData.hue}° • Sat: ${activeData.saturation}% • Lum: ${activeData.luminance > 0 ? `+${activeData.luminance}` : activeData.luminance}%`
                : activeData.hue > 0
                  ? `Hue: ${activeData.hue}° • Sat: 0% (Increase Saturation to introduce color)`
                  : 'Neutral (No tint applied)'}
            </Text>
          </View>
        </View>

        {/* Tone Sliders */}
        <AdjustmentSlider
          label={`${selectedWheel.toUpperCase()} Hue`}
          value={activeData.hue}
          min={0}
          max={360}
          unit="°"
          onChange={v => {
            updateGradingTone(selectedWheel, 'hue', v);
            if (activeData.saturation === 0 && v > 0) {
              updateGradingTone(selectedWheel, 'saturation', 35);
            }
          }}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateGradingTone(selectedWheel, 'hue', 0)}
        />
        <AdjustmentSlider
          label={`${selectedWheel.toUpperCase()} Saturation`}
          value={activeData.saturation}
          min={0}
          max={100}
          unit="%"
          onChange={v => updateGradingTone(selectedWheel, 'saturation', v)}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateGradingTone(selectedWheel, 'saturation', 0)}
        />
        <AdjustmentSlider
          label={`${selectedWheel.toUpperCase()} Luminance`}
          value={activeData.luminance}
          min={-100}
          max={100}
          onChange={v => updateGradingTone(selectedWheel, 'luminance', v)}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateGradingTone(selectedWheel, 'luminance', 0)}
        />

        <Text style={styles.sectionDivider}>Global Grading Controls</Text>

        <AdjustmentSlider
          label="Blending (Overlap)"
          value={grading.blending}
          min={0}
          max={100}
          unit="%"
          onChange={v => updateGradingParams(v, grading.balance)}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateGradingParams(50, grading.balance)}
        />
        <AdjustmentSlider
          label="Balance (Shadow vs Highlight)"
          value={grading.balance}
          min={-100}
          max={100}
          onChange={v => updateGradingParams(grading.blending, v)}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateGradingParams(grading.blending, 0)}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    height: 270,
  },
  pillRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
    borderRadius: 6,
    backgroundColor: colors.surfaceElevated,
    gap: 4,
  },
  pillActive: {
    backgroundColor: colors.accentPrimary,
  },
  pillText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    fontSize: 11,
  },
  pillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.accentWarning,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: spacing.xs,
    paddingBottom: spacing.xl,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  previewInfo: {
    flex: 1,
  },
  previewTitle: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  previewSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  sectionDivider: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: 2,
  },
});
