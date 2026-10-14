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

  const { header, tonalMetrics: tm } = analysis;

  // Dynamic aspect classification
  const aspectLabel =
    header.aspectRatio >= 1.7
      ? '16:9 Widescreen'
      : header.aspectRatio >= 1.45
      ? '3:2 Classic 35mm'
      : header.aspectRatio >= 1.25
      ? '4:3 Standard'
      : header.aspectRatio === 1
      ? '1:1 Square'
      : 'Vertical Portrait';

  // Dynamic scene exposure key
  const sceneExposure =
    tm.meanLuminance > 0.60
      ? 'High-Key (Bright Scene)'
      : tm.meanLuminance < 0.35
      ? 'Low-Key (Moody/Dark Scene)'
      : 'Balanced Midtone Exposure';

  // Dynamic scene contrast profile
  const toneRange = tm.whitePoint - tm.blackPoint;
  const sceneContrast =
    toneRange > 220
      ? 'High Dynamic Contrast'
      : toneRange < 140
      ? 'Soft / Low Contrast'
      : 'Standard Contrast';

  const hasClipping = tm.clippedBlacksRatio > 0.02 || tm.clippedWhitesRatio > 0.02;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Image Diagnostics</Text>
              <Text style={styles.subtitle}>Extracted via Lumaflow Engine</Text>
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
                <Text style={styles.statVal}>{header.megapixels} MP</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Aspect Framing</Text>
                <Text style={styles.statVal}>{header.aspectRatio}:1 ({aspectLabel})</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Color Depth</Text>
                <Text style={styles.statVal}>{header.colorDepthBits || 8}-bit per channel (sRGB)</Text>
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
                <Text style={styles.statLabel}>Scene Exposure</Text>
                <Text style={styles.statVal}>{sceneExposure}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Median Luminance</Text>
                <Text style={styles.statVal}>{Math.round(tm.medianLuminance * 100)}% (Mean: {Math.round(tm.meanLuminance * 100)}%)</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Contrast Profile</Text>
                <Text style={styles.statVal}>{sceneContrast}</Text>
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

            {/* Dynamic Gamut & Clipping Status */}
            {hasClipping ? (
              <View style={styles.alertBox}>
                <Text style={styles.alertText}>
                  ⚠️ {tm.clippedBlacksRatio > 0.02 ? `Crushed Blacks: ${(tm.clippedBlacksRatio * 100).toFixed(1)}% ` : ''}
                  {tm.clippedWhitesRatio > 0.02 ? `Blown Whites: ${(tm.clippedWhitesRatio * 100).toFixed(1)}%` : ''}
                </Text>
              </View>
            ) : (
              <View style={styles.healthyBox}>
                <Text style={styles.healthyText}>
                  ✓ Clean Gamut: Full shadow & highlight detail preserved without clipping.
                </Text>
              </View>
            )}
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
    marginTop: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
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
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  statBox: {
    width: '48%',
    backgroundColor: colors.surfaceElevated,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
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
  healthyBox: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
    padding: spacing.xs,
    borderRadius: 6,
    marginVertical: spacing.xs,
  },
  healthyText: {
    ...typography.caption,
    color: '#4ade80',
    fontSize: 11,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
});
