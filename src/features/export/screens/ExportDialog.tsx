import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { colors, spacing, typography } from '../../../theme/colors';
import { ExportOptions } from '../../../types';
import { AdjustmentSlider } from '../../editor/components/AdjustmentSlider';

interface ExportDialogProps {
  visible: boolean;
  originalWidth: number;
  originalHeight: number;
  onClose: () => void;
  onExport: (options: ExportOptions) => Promise<void>;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  visible,
  originalWidth,
  originalHeight,
  onClose,
  onExport
}) => {
  const [format, setFormat] = useState<'jpeg' | 'png'>('jpeg');
  const [quality, setQuality] = useState<number>(95);
  const [scale, setScale] = useState<number>(1.0);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);

  const outW = Math.round(originalWidth * scale);
  const outH = Math.round(originalHeight * scale);

  const handleStartExport = async () => {
    setIsExporting(true);
    setExportSuccess(false);
    try {
      await onExport({
        format,
        quality: quality / 100.0,
        scale
      });
      setExportSuccess(true);
      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 1200);
    } catch (err) {
      setIsExporting(false);
      console.error(err);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Export Photo</Text>
          <Text style={styles.subtitle}>Render processed image at full quality</Text>

          {/* Format Selector */}
          <View style={styles.row}>
            <Text style={styles.label}>Format:</Text>
            <View style={styles.toggleGroup}>
              <TouchableOpacity
                style={[styles.toggleBtn, format === 'jpeg' && styles.toggleBtnActive]}
                onPress={() => setFormat('jpeg')}
              >
                <Text style={[styles.toggleText, format === 'jpeg' && styles.toggleTextActive]}>JPEG</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, format === 'png' && styles.toggleBtnActive]}
                onPress={() => setFormat('png')}
              >
                <Text style={[styles.toggleText, format === 'png' && styles.toggleTextActive]}>PNG</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Scale Selector */}
          <View style={styles.row}>
            <Text style={styles.label}>Resolution:</Text>
            <View style={styles.toggleGroup}>
              {[
                { label: 'Full', val: 1.0 },
                { label: '75%', val: 0.75 },
                { label: '50%', val: 0.5 }
              ].map(item => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.toggleBtn, scale === item.val && styles.toggleBtnActive]}
                  onPress={() => setScale(item.val)}
                >
                  <Text style={[styles.toggleText, scale === item.val && styles.toggleTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text style={styles.dimInfo}>Dimensions: {outW} × {outH} px</Text>

          {format === 'jpeg' && (
            <AdjustmentSlider
              label="Quality"
              value={quality}
              min={50}
              max={100}
              unit="%"
              onChange={setQuality}
              onReset={() => setQuality(95)}
            />
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={isExporting}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.exportBtn} onPress={handleStartExport} disabled={isExporting}>
              {isExporting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.exportText}>{exportSuccess ? 'Saved!' : 'Save to Camera Roll'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium
  },
  title: {
    ...typography.titleMedium,
    color: colors.textPrimary
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  label: {
    ...typography.bodyMedium,
    color: colors.textPrimary
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    padding: 2
  },
  toggleBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 6
  },
  toggleBtnActive: {
    backgroundColor: colors.accentPrimary
  },
  toggleText: {
    ...typography.caption,
    color: colors.textMuted
  },
  toggleTextActive: {
    color: '#ffffff',
    fontWeight: '600'
  },
  dimInfo: {
    ...typography.caption,
    color: colors.accentSecondary,
    marginBottom: spacing.sm,
    fontFamily: 'monospace'
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center'
  },
  cancelText: {
    ...typography.bodyMedium,
    color: colors.textSecondary
  },
  exportBtn: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.accentPrimary,
    alignItems: 'center'
  },
  exportText: {
    ...typography.bodyMedium,
    color: '#ffffff',
    fontWeight: '600'
  }
});
