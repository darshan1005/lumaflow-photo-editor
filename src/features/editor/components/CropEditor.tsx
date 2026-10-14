import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing, typography } from '../../../theme/colors';
import { useEditorStore } from '../state/useEditorStore';
import { AdjustmentSlider } from './AdjustmentSlider';

const ASPECT_RATIOS = [
  { label: 'Original', ratio: null },
  { label: 'Free', ratio: 0 },
  { label: '1:1', ratio: 1.0 },
  { label: '4:5', ratio: 4 / 5 },
  { label: '5:4', ratio: 5 / 4 },
  { label: '16:9', ratio: 16 / 9 },
  { label: '9:16', ratio: 9 / 16 },
  { label: '3:2', ratio: 3 / 2 },
  { label: '2:3', ratio: 2 / 3 }
];

export const CropEditor: React.FC = () => {
  const crop = useEditorStore(state => state.currentDocument.crop);
  const updateCrop = useEditorStore(state => state.updateCrop);
  const setActiveTab = useEditorStore(state => state.setActiveTab);

  const handleSelectRatio = (item: typeof ASPECT_RATIOS[number]) => {
    if (item.ratio === null || item.ratio === 0) {
      // Reset to full image
      updateCrop({
        x: 0,
        y: 0,
        width: 1.0,
        height: 1.0
      });
      return;
    }

    // Apply centered aspect ratio
    const targetRatio = item.ratio;
    let newWidth = 1.0;
    let newHeight = 1.0;

    if (targetRatio >= 1.0) {
      newHeight = 1.0 / targetRatio;
    } else {
      newWidth = targetRatio;
    }

    const newX = (1.0 - newWidth) / 2.0;
    const newY = (1.0 - newHeight) / 2.0;

    updateCrop({
      x: Math.max(0, newX),
      y: Math.max(0, newY),
      width: Math.min(1.0, newWidth),
      height: Math.min(1.0, newHeight)
    });
  };

  const handleRotate = () => {
    const nextRotation = (crop.rotation + 90) % 360;
    updateCrop({ rotation: nextRotation });
  };

  const handleFlipH = () => {
    updateCrop({ flipHorizontal: !crop.flipHorizontal });
  };

  const handleFlipV = () => {
    updateCrop({ flipVertical: !crop.flipVertical });
  };

  const handleResetCrop = () => {
    updateCrop({
      x: 0,
      y: 0,
      width: 1.0,
      height: 1.0,
      rotation: 0,
      flipHorizontal: false,
      flipVertical: false,
      straightenAngle: 0
    });
  };

  const handleDoneCrop = () => {
    // Switch back to Light tab (close crop mode)
    setActiveTab('light');
  };

  // Determine current active ratio label
  const currentRatio = crop.width / crop.height;
  const getActiveRatioLabel = () => {
    if (crop.width === 1.0 && crop.height === 1.0) return 'Original';
    for (const item of ASPECT_RATIOS) {
      if (item.ratio && Math.abs(currentRatio - item.ratio) < 0.05) return item.label;
    }
    return 'Custom';
  };

  return (
    <View style={styles.container}>
      {/* Crop Info Bar */}
      <View style={styles.infoBar}>
        <Text style={styles.infoText}>
          Aspect: {getActiveRatioLabel()} • {Math.round(crop.width * 100)}×{Math.round(crop.height * 100)}%
        </Text>
        <View style={styles.doneBtnGroup}>
          <TouchableOpacity style={styles.resetButton} onPress={handleResetCrop}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.doneButton} onPress={handleDoneCrop}>
            <Text style={styles.doneText}>✓ Done</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Aspect Ratio Row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ratioScroll}>
        <View style={styles.ratioRow}>
          {ASPECT_RATIOS.map(item => {
            const isSelected = Boolean(
              (item.ratio === null && crop.width === 1.0 && crop.height === 1.0)
                ? true
                : (item.ratio != null && Math.abs(currentRatio - item.ratio) < 0.05)
            );

            return (
              <TouchableOpacity
                key={item.label}
                style={[styles.ratioButton, isSelected && styles.ratioButtonActive]}
                onPress={() => handleSelectRatio(item)}
              >
                {/* Visual aspect ratio preview */}
                <View style={styles.ratioPreviewWrapper}>
                  <View
                    style={[
                      styles.ratioPreview,
                      item.ratio && item.ratio >= 1
                        ? { width: 24, height: Math.round(24 / item.ratio) }
                        : item.ratio
                          ? { width: Math.round(24 * item.ratio), height: 24 }
                          : { width: 22, height: 22 },
                      isSelected && styles.ratioPreviewActive,
                    ]}
                  />
                </View>
                <Text style={[styles.ratioText, isSelected && styles.ratioTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Transform Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionButton} onPress={handleRotate}>
          <Text style={styles.actionIcon}>↻</Text>
          <Text style={styles.actionText}>Rotate {crop.rotation}°</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, crop.flipHorizontal && styles.actionButtonActive]}
          onPress={handleFlipH}
        >
          <Text style={styles.actionIcon}>⇄</Text>
          <Text style={[styles.actionText, crop.flipHorizontal && styles.actionTextActive]}>
            Flip H
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, crop.flipVertical && styles.actionButtonActive]}
          onPress={handleFlipV}
        >
          <Text style={styles.actionIcon}>⇅</Text>
          <Text style={[styles.actionText, crop.flipVertical && styles.actionTextActive]}>
            Flip V
          </Text>
        </TouchableOpacity>
      </View>

      <AdjustmentSlider
        label="Straighten Angle"
        value={crop.straightenAngle}
        min={-45}
        max={45}
        unit="°"
        onChange={v => updateCrop({ straightenAngle: v })}
        onReset={() => updateCrop({ straightenAngle: 0 })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs
  },
  infoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  infoText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    fontSize: 11,
  },
  doneBtnGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  resetButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)'
  },
  resetText: {
    ...typography.caption,
    color: '#ef4444',
    fontWeight: '600'
  },
  doneButton: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    backgroundColor: colors.accentPrimary,
    borderRadius: 6,
  },
  doneText: {
    ...typography.caption,
    color: '#ffffff',
    fontWeight: '700',
  },
  ratioScroll: {
    marginBottom: spacing.sm,
  },
  ratioRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  ratioButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    minWidth: 52,
  },
  ratioButtonActive: {
    backgroundColor: colors.accentPrimary,
    borderColor: colors.accentPrimary
  },
  ratioPreviewWrapper: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  ratioPreview: {
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    borderRadius: 2,
  },
  ratioPreviewActive: {
    borderColor: '#ffffff',
  },
  ratioText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
    fontSize: 10,
  },
  ratioTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.surfaceCard,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: 4,
  },
  actionButtonActive: {
    borderColor: colors.accentPrimary,
    backgroundColor: colors.surfaceHover
  },
  actionIcon: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  actionText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '500'
  },
  actionTextActive: {
    color: colors.accentSecondary
  },
});
