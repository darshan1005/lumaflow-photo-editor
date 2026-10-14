import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing, typography } from '../../../theme/colors';
import { useEditorStore } from '../state/useEditorStore';
import { AdjustmentSlider } from './AdjustmentSlider';

export const SmartErasePanel: React.FC = () => {
  const [brushSize, setBrushSize] = useState<number>(30);
  const [feather, setFeather] = useState<number>(50);
  const [mode, setMode] = useState<'heal' | 'clone'>('heal');

  const healingSpots = useEditorStore(state => state.currentDocument.healingSpots || []);
  const removeHealingSpot = useEditorStore(state => state.removeHealingSpot);
  const clearHealingSpots = useEditorStore(state => state.clearHealingSpots);

  return (
    <View style={styles.container}>
      {/* How to Use Banner */}
      <View style={styles.banner}>
        <Text style={styles.bannerIcon}>✦</Text>
        <View style={styles.bannerContent}>
          <Text style={styles.bannerTitle}>Smart Erase / Healing Tool</Text>
          <Text style={styles.bannerText}>
            How to use: Tap directly on any blemish, wire, person, or unwanted object in the photo above. A red circle will appear marking the spot. The tool will analyze surrounding pixels and fill the area with matching texture.
          </Text>
        </View>
      </View>

      {/* Steps Guide */}
      <View style={styles.stepsRow}>
        <View style={styles.stepItem}>
          <View style={styles.stepCircle}><Text style={styles.stepNum}>1</Text></View>
          <Text style={styles.stepLabel}>Tap on{'\n'}blemish</Text>
        </View>
        <View style={styles.stepArrow}><Text style={styles.stepArrowText}>→</Text></View>
        <View style={styles.stepItem}>
          <View style={styles.stepCircle}><Text style={styles.stepNum}>2</Text></View>
          <Text style={styles.stepLabel}>Red dot{'\n'}appears</Text>
        </View>
        <View style={styles.stepArrow}><Text style={styles.stepArrowText}>→</Text></View>
        <View style={styles.stepItem}>
          <View style={styles.stepCircle}><Text style={styles.stepNum}>3</Text></View>
          <Text style={styles.stepLabel}>Tap ✕ to{'\n'}remove</Text>
        </View>
      </View>

      {/* Mode Selector */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'heal' && styles.modeBtnActive]}
          onPress={() => setMode('heal')}
        >
          <Text style={styles.modeBtnIcon}>🩹</Text>
          <Text style={[styles.modeText, mode === 'heal' && styles.modeTextActive]}>
            Heal (Content-Aware)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeBtn, mode === 'clone' && styles.modeBtnActive]}
          onPress={() => setMode('clone')}
        >
          <Text style={styles.modeBtnIcon}>📋</Text>
          <Text style={[styles.modeText, mode === 'clone' && styles.modeTextActive]}>
            Clone (Exact Texture)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Brush Size & Feather Sliders */}
      <AdjustmentSlider
        label="Brush Size"
        value={brushSize}
        min={5}
        max={100}
        unit="px"
        onChange={setBrushSize}
        onReset={() => setBrushSize(30)}
      />

      <AdjustmentSlider
        label="Feather / Softness"
        value={feather}
        min={0}
        max={100}
        unit="%"
        onChange={setFeather}
        onReset={() => setFeather(50)}
      />

      {/* Spot History & Clear Action */}
      <View style={styles.footerRow}>
        <View style={styles.spotInfo}>
          <View style={[styles.spotDot, healingSpots.length > 0 && styles.spotDotActive]} />
          <Text style={styles.spotCount}>
            {healingSpots.length} {healingSpots.length === 1 ? 'spot' : 'spots'} marked
          </Text>
        </View>

        {healingSpots.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={clearHealingSpots}>
            <Text style={styles.clearBtnText}>Clear All ✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Individual Spots List (when spots exist) */}
      {healingSpots.length > 0 && (
        <View style={styles.spotsList}>
          {healingSpots.slice(0, 5).map((spot, i) => (
            <TouchableOpacity
              key={spot.id}
              style={styles.spotListItem}
              onPress={() => removeHealingSpot(spot.id)}
            >
              <Text style={styles.spotListText}>
                Spot {i + 1} ({Math.round(spot.x * 100)}%, {Math.round(spot.y * 100)}%)
              </Text>
              <Text style={styles.spotListRemove}>✕</Text>
            </TouchableOpacity>
          ))}
          {healingSpots.length > 5 && (
            <Text style={styles.spotListMore}>+{healingSpots.length - 5} more spots</Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    gap: 8
  },
  bannerIcon: {
    color: colors.accentSecondary,
    fontSize: 18,
    marginTop: 2,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 13,
    marginBottom: 2,
  },
  bannerText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: 4,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  stepNum: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  stepLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 10,
  },
  stepArrow: {
    paddingHorizontal: 2,
  },
  stepArrowText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
    paddingHorizontal: spacing.md
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: 4,
  },
  modeBtnActive: {
    backgroundColor: colors.surfaceHover,
    borderColor: colors.accentPrimary
  },
  modeBtnIcon: {
    fontSize: 14,
  },
  modeText: {
    ...typography.caption,
    color: colors.textSecondary
  },
  modeTextActive: {
    color: colors.accentSecondary,
    fontWeight: '700'
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginTop: 4
  },
  spotInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  spotDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textMuted,
  },
  spotDotActive: {
    backgroundColor: '#ef4444',
  },
  spotCount: {
    ...typography.caption,
    color: colors.textMuted
  },
  clearBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 4
  },
  clearBtnText: {
    ...typography.caption,
    color: '#ef4444',
    fontWeight: '600'
  },
  spotsList: {
    marginTop: 6,
    marginHorizontal: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 6,
    padding: spacing.xs,
  },
  spotListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  spotListText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  spotListRemove: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
  spotListMore: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingTop: 4,
    fontSize: 10,
  },
});
