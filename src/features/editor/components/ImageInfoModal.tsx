import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CompleteImageAnalysis } from '../../../core/image-engine/ImageBinaryExtractor';
import { colors, spacing, typography } from '../../../theme/colors';

interface ImageInfoModalProps {
  visible: boolean;
  analysis: CompleteImageAnalysis | null;
  onClose: () => void;
}

export const ImageInfoModal: React.FC<ImageInfoModalProps> = ({
  visible,
  analysis,
  onClose
}) => {
  if (!analysis) return null;

  const { header, tonalMetrics: tm, recommendedLightAdjustments: rec } = analysis;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Image Binary Diagnostics</Text>
              <Text style={styles.subtitle}>Extracted via Lumaflow Binary Extractor</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Section 1: Binary Container & Encoding */}
            <Text style={styles.sectionTitle}>Binary Container & Encoding</Text>
            <View style={styles.grid}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Format</Text>
                <Text style={styles.statVal}>{header.format.toUpperCase()} ({header.mimeType})</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>File Size</Text>
                <Text style={styles.statVal}>{header.byteSizeFormatted}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Resolution</Text>
                <Text style={styles.statVal}>{header.width} × {header.height} px</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Megapixels</Text>
                <Text style={styles.statVal}>{header.megapixels} MP ({header.aspectRatio}:1)</Text>
              </View>
            </View>

            {/* Section 2: Radiometric Tonal Distribution */}
            <Text style={styles.sectionTitle}>Radiometric Tonal Distribution</Text>
            <View style={styles.grid}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Dynamic Range</Text>
                <Text style={[styles.statVal, { color: colors.accentPrimary }]}>{tm.dynamicRangeEV} EV stops</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Median Luminance</Text>
                <Text style={styles.statVal}>{Math.round(tm.medianLuminance * 100)}% (Mean: {Math.round(tm.meanLuminance * 100)}%)</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Black Point (0.5%)</Text>
                <Text style={styles.statVal}>{tm.blackPoint} / 255</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>White Point (99.5%)</Text>
                <Text style={styles.statVal}>{tm.whitePoint} / 255</Text>
              </View>
            </View>

            {/* Section 3: Zone Analysis & Micro-Contrast */}
            <Text style={styles.sectionTitle}>Zone Breakdown & Texture</Text>
            <View style={styles.zoneRow}>
              <View style={styles.zoneItem}>
                <Text style={styles.zoneLabel}>Shadows</Text>
                <Text style={styles.zoneVal}>{Math.round(tm.shadowZoneRatio * 100)}%</Text>
              </View>
              <View style={styles.zoneItem}>
                <Text style={styles.zoneLabel}>Midtones</Text>
                <Text style={styles.zoneVal}>{Math.round(tm.midtonesZoneRatio * 100)}%</Text>
              </View>
              <View style={styles.zoneItem}>
                <Text style={styles.zoneLabel}>Highlights</Text>
                <Text style={styles.zoneVal}>{Math.round(tm.highlightsZoneRatio * 100)}%</Text>
              </View>
              <View style={styles.zoneItem}>
                <Text style={styles.zoneLabel}>Texture Energy</Text>
                <Text style={styles.zoneVal}>{Math.round(tm.microContrastEnergy * 100)}%</Text>
              </View>
            </View>

            {/* Clipping alerts if any */}
            {(tm.clippedBlacksRatio > 0.02 || tm.clippedWhitesRatio > 0.02) && (
              <View style={styles.alertBox}>
                <Text style={styles.alertText}>
                  ⚠️ {tm.clippedBlacksRatio > 0.02 ? `Crushed Blacks: ${(tm.clippedBlacksRatio * 100).toFixed(1)}% ` : ''}
                  {tm.clippedWhitesRatio > 0.02 ? `Blown Whites: ${(tm.clippedWhitesRatio * 100).toFixed(1)}%` : ''}
                </Text>
              </View>
            )}

            {/* Section 4: Recommended Algorithmic Adjustments */}
            <Text style={styles.sectionTitle}>Algorithmic Light Recommendations</Text>
            <View style={styles.recCard}>
              <Text style={styles.recSummary}>{rec.analysisSummary}</Text>
              <View style={styles.recValuesGrid}>
                <Text style={styles.recVal}>Exposure: {rec.exposure > 0 ? `+${rec.exposure}` : rec.exposure} EV</Text>
                <Text style={styles.recVal}>Contrast: {rec.contrast > 0 ? `+${rec.contrast}` : rec.contrast}</Text>
                <Text style={styles.recVal}>Whites: {rec.whites > 0 ? `+${rec.whites}` : rec.whites}</Text>
                <Text style={styles.recVal}>Blacks: {rec.blacks > 0 ? `+${rec.blacks}` : rec.blacks}</Text>
                <Text style={styles.recVal}>Highlights: {rec.highlights > 0 ? `+${rec.highlights}` : rec.highlights}</Text>
                <Text style={styles.recVal}>Shadows: {rec.shadows > 0 ? `+${rec.shadows}` : rec.shadows}</Text>
                <Text style={styles.recVal}>Clarity: +{rec.clarity}</Text>
                <Text style={styles.recVal}>Sharpening: +{rec.sharpening}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.surfaceElevated,
  },
  title: {
    ...typography.titleMedium,
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeBtnText: {
    color: colors.textSecondary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  scroll: {
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.accentPrimary,
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surfaceElevated,
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginBottom: 2,
  },
  statVal: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 12,
  },
  zoneRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  zoneItem: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  zoneLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 9,
  },
  zoneVal: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  alertBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    padding: spacing.xs,
    borderRadius: 6,
    marginVertical: spacing.xs,
  },
  alertText: {
    ...typography.caption,
    color: '#f87171',
    fontSize: 11,
  },
  recCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accentPrimary,
    marginBottom: spacing.md,
  },
  recSummary: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 11,
    marginBottom: spacing.xs,
  },
  recValuesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  recVal: {
    ...typography.caption,
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.surfaceElevated,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: 6,
    backgroundColor: colors.surfaceHover,
  },
  cancelBtnText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  applyBtn: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: 6,
    backgroundColor: colors.accentPrimary,
  },
  applyBtnText: {
    ...typography.caption,
    color: colors.textInverse,
    fontWeight: '700',
  },
});
