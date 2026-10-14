import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing, typography } from '../../../theme/colors';
import { useEditorStore } from '../state/useEditorStore';
import { AdjustmentSlider } from './AdjustmentSlider';

interface AdjustmentPanelProps {
  onOpenInfo?: () => void;
}

export const AdjustmentPanel: React.FC<AdjustmentPanelProps> = ({
  onOpenInfo
}) => {
  const activeTab = useEditorStore(state => state.activeTab);
  const currentDoc = useEditorStore(state => state.currentDocument);
  const updateBasic = useEditorStore(state => state.updateBasic);
  const beginAdjustment = useEditorStore(state => state.beginAdjustment);
  const endAdjustment = useEditorStore(state => state.endAdjustment);

  const b = currentDoc.basic;

  if (activeTab === 'light') {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        {/* Quick Diagnostic Action */}
        {onOpenInfo && (
          <View style={styles.actionHeaderRow}>
            <TouchableOpacity
              style={styles.infoBtn}
              onPress={onOpenInfo}
              hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
            >
              <Text style={styles.infoBtnText}>ℹ️ Image Diagnostics & Histogram</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Primary Light Controls */}
        <Text style={styles.sectionLabel}>Exposure & Tone</Text>
        <AdjustmentSlider
          label="Exposure"
          value={b.exposure}
          min={-2.0}
          max={2.0}
          step={0.05}
          unit=" EV"
          onChange={v => updateBasic('exposure', v)}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateBasic('exposure', 0, true)}
        />
        <AdjustmentSlider
          label="Contrast"
          value={b.contrast}
          min={-100}
          max={100}
          onChange={v => updateBasic('contrast', v)}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateBasic('contrast', 0, true)}
        />
        <AdjustmentSlider
          label="Highlights"
          value={b.highlights}
          min={-100}
          max={100}
          onChange={v => updateBasic('highlights', v)}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateBasic('highlights', 0, true)}
        />
        <AdjustmentSlider
          label="Shadows"
          value={b.shadows}
          min={-100}
          max={100}
          onChange={v => updateBasic('shadows', v)}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateBasic('shadows', 0, true)}
        />
        <AdjustmentSlider
          label="Whites"
          value={b.whites}
          min={-100}
          max={100}
          onChange={v => updateBasic('whites', v)}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateBasic('whites', 0, true)}
        />
        <AdjustmentSlider
          label="Blacks"
          value={b.blacks}
          min={-100}
          max={100}
          onChange={v => updateBasic('blacks', v)}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateBasic('blacks', 0, true)}
        />

        {/* Effects */}
        <Text style={styles.sectionLabel}>Effects & Detail</Text>
        <AdjustmentSlider
          label="Clarity"
          value={b.clarity}
          min={-100}
          max={100}
          onChange={v => updateBasic('clarity', v)}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateBasic('clarity', 0, true)}
        />
        <AdjustmentSlider
          label="Sharpening"
          value={b.sharpening}
          min={0}
          max={100}
          onChange={v => updateBasic('sharpening', v)}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateBasic('sharpening', 0, true)}
        />
        <AdjustmentSlider
          label="Vignette"
          value={b.vignette}
          min={-100}
          max={100}
          onChange={v => updateBasic('vignette', v)}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateBasic('vignette', 0, true)}
        />
        <AdjustmentSlider
          label="Grain"
          value={b.grain}
          min={0}
          max={100}
          onChange={v => updateBasic('grain', v)}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateBasic('grain', 0, true)}
        />
      </ScrollView>
    );
  }

  if (activeTab === 'color') {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <Text style={styles.sectionLabel}>White Balance</Text>
        <AdjustmentSlider
          label="Temperature (Kelvin)"
          value={b.temperature}
          min={-100}
          max={100}
          onChange={v => updateBasic('temperature', v)}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateBasic('temperature', 0, true)}
        />
        <AdjustmentSlider
          label="Tint (Green / Magenta)"
          value={b.tint}
          min={-100}
          max={100}
          onChange={v => updateBasic('tint', v)}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateBasic('tint', 0, true)}
        />

        <Text style={styles.sectionLabel}>Saturation</Text>
        <AdjustmentSlider
          label="Vibrance (Skin Safe)"
          value={b.vibrance}
          min={-100}
          max={100}
          onChange={v => updateBasic('vibrance', v)}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateBasic('vibrance', 0, true)}
        />
        <AdjustmentSlider
          label="Saturation"
          value={b.saturation}
          min={-100}
          max={100}
          onChange={v => updateBasic('saturation', v)}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateBasic('saturation', 0, true)}
        />
      </ScrollView>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 260
  },
  container: {
    paddingVertical: spacing.sm,
    paddingBottom: spacing.md,
  },
  actionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  autoToneBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(217, 119, 6, 0.2)',
    borderWidth: 1,
    borderColor: colors.accentPrimary,
    paddingVertical: 6,
    borderRadius: 6,
  },
  autoToneBtnText: {
    ...typography.caption,
    color: colors.accentPrimary,
    fontWeight: '700',
    fontSize: 11,
  },
  infoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: 6,
    borderRadius: 6,
  },
  infoBtnText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 11,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
    marginBottom: 2,
  },
});
