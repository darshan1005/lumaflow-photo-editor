import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing, typography } from '../../../theme/colors';
import { MaskAdjustment, MaskType } from '../../../types';
import { useEditorStore } from '../state/useEditorStore';
import { AdjustmentSlider } from './AdjustmentSlider';

export const MaskingPanel: React.FC = () => {
  const masks = useEditorStore(state => state.currentDocument.masks || []);
  const activeMaskId = useEditorStore(state => state.activeMaskId);
  const setActiveMaskId = useEditorStore(state => state.setActiveMaskId);
  const addMask = useEditorStore(state => state.addMask);
  const updateMask = useEditorStore(state => state.updateMask);
  const removeMask = useEditorStore(state => state.removeMask);

  const activeMask = masks.find(m => m.id === activeMaskId) || masks[0];

  const handleCreateMask = (type: MaskType) => {
    const typeNames: Record<MaskType, string> = {
      brush: 'Brush Mask',
      linear: 'Linear Gradient',
      radial: 'Radial Mask'
    };

    const typeIcons: Record<MaskType, string> = {
      brush: '🖌️',
      linear: '▬',
      radial: '◉'
    };

    addMask({
      name: `${typeIcons[type]} ${typeNames[type]} ${masks.length + 1}`,
      type,
      inverted: false,
      opacity: 100,
      exposure: 0.5,
      contrast: 15,
      saturation: 10,
      temperature: 0,
      highlights: 0,
      shadows: 0,
      start: { x: 0.5, y: 0.0 },
      end: { x: 0.5, y: 0.4 },
      center: { x: 0.5, y: 0.5 },
      radiusX: 0.35,
      radiusY: 0.35,
      points: [],
    });
  };

  return (
    <View style={styles.container}>
      {/* Add Mask Header Row */}
      <View style={styles.addBar}>
        <Text style={styles.sectionTitle}>Add Mask:</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => handleCreateMask('brush')}>
          <Text style={styles.addBtnIcon}>🖌️</Text>
          <Text style={styles.addBtnText}>Brush</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={() => handleCreateMask('linear')}>
          <Text style={styles.addBtnIcon}>▬</Text>
          <Text style={styles.addBtnText}>Linear</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={() => handleCreateMask('radial')}>
          <Text style={styles.addBtnIcon}>◉</Text>
          <Text style={styles.addBtnText}>Radial</Text>
        </TouchableOpacity>
      </View>

      {/* Active Mask Selector Chips */}
      {masks.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.maskChipScroll}>
          {masks.map(m => {
            const isSelected = activeMask?.id === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.maskChip, isSelected && styles.maskChipActive]}
                onPress={() => setActiveMaskId(m.id)}
              >
                <Text style={[styles.maskChipText, isSelected && styles.maskChipTextActive]}>
                  {m.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Active Mask Controls */}
      {activeMask ? (
        <ScrollView style={styles.maskScrollContainer} contentContainerStyle={styles.maskScrollContent}>
          <View style={styles.maskHeaderRow}>
            <Text style={styles.maskTitle}>{activeMask.name} Adjustments</Text>
            <View style={styles.maskActions}>
              <TouchableOpacity
                style={[styles.toggleBtn, activeMask.inverted && styles.toggleBtnActive]}
                onPress={() => updateMask(activeMask.id, { inverted: !activeMask.inverted })}
              >
                <Text style={[styles.toggleBtnText, activeMask.inverted && styles.toggleBtnTextActive]}>
                  {activeMask.inverted ? 'Inverted ✓' : 'Invert'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => removeMask(activeMask.id)}
              >
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Mask Type-Specific Controls */}
          {activeMask.type === 'brush' && (
            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>🖌️</Text>
              <Text style={styles.infoText}>
                Brush mask paints selectively on the photo. Tap or drag on the image to paint the mask area. Adjust exposure, contrast, and color below to modify only the painted region.
              </Text>
            </View>
          )}

          {activeMask.type === 'radial' && (
            <View style={styles.geometryRow}>
              <AdjustmentSlider
                label="Center X"
                value={Math.round((activeMask.center?.x || 0.5) * 100)}
                min={0}
                max={100}
                unit="%"
                onChange={v => updateMask(activeMask.id, { center: { x: v / 100, y: activeMask.center?.y || 0.5 } })}
                onReset={() => updateMask(activeMask.id, { center: { x: 0.5, y: activeMask.center?.y || 0.5 } })}
              />
              <AdjustmentSlider
                label="Center Y"
                value={Math.round((activeMask.center?.y || 0.5) * 100)}
                min={0}
                max={100}
                unit="%"
                onChange={v => updateMask(activeMask.id, { center: { x: activeMask.center?.x || 0.5, y: v / 100 } })}
                onReset={() => updateMask(activeMask.id, { center: { x: activeMask.center?.x || 0.5, y: 0.5 } })}
              />
              <AdjustmentSlider
                label="Radius X"
                value={Math.round((activeMask.radiusX || 0.35) * 100)}
                min={5}
                max={100}
                unit="%"
                onChange={v => updateMask(activeMask.id, { radiusX: v / 100 })}
                onReset={() => updateMask(activeMask.id, { radiusX: 0.35 })}
              />
              <AdjustmentSlider
                label="Radius Y"
                value={Math.round((activeMask.radiusY || 0.35) * 100)}
                min={5}
                max={100}
                unit="%"
                onChange={v => updateMask(activeMask.id, { radiusY: v / 100 })}
                onReset={() => updateMask(activeMask.id, { radiusY: 0.35 })}
              />
            </View>
          )}

          {activeMask.type === 'linear' && (
            <View style={styles.geometryRow}>
              <AdjustmentSlider
                label="Gradient Start Y"
                value={Math.round((activeMask.start?.y || 0) * 100)}
                min={0}
                max={100}
                unit="%"
                onChange={v => updateMask(activeMask.id, { start: { x: activeMask.start?.x || 0.5, y: v / 100 } })}
                onReset={() => updateMask(activeMask.id, { start: { x: 0.5, y: 0 } })}
              />
              <AdjustmentSlider
                label="Gradient End Y"
                value={Math.round((activeMask.end?.y || 0.4) * 100)}
                min={0}
                max={100}
                unit="%"
                onChange={v => updateMask(activeMask.id, { end: { x: activeMask.end?.x || 0.5, y: v / 100 } })}
                onReset={() => updateMask(activeMask.id, { end: { x: 0.5, y: 0.4 } })}
              />
            </View>
          )}

          <AdjustmentSlider
            label="Mask Opacity"
            value={activeMask.opacity}
            min={0}
            max={100}
            unit="%"
            onChange={v => updateMask(activeMask.id, { opacity: v })}
            onReset={() => updateMask(activeMask.id, { opacity: 100 })}
          />

          <AdjustmentSlider
            label="Mask Exposure"
            value={activeMask.exposure}
            min={-2.0}
            max={2.0}
            step={0.1}
            unit=" EV"
            onChange={v => updateMask(activeMask.id, { exposure: v })}
            onReset={() => updateMask(activeMask.id, { exposure: 0 })}
          />

          <AdjustmentSlider
            label="Mask Contrast"
            value={activeMask.contrast}
            min={-100}
            max={100}
            onChange={v => updateMask(activeMask.id, { contrast: v })}
            onReset={() => updateMask(activeMask.id, { contrast: 0 })}
          />

          <AdjustmentSlider
            label="Mask Saturation"
            value={activeMask.saturation}
            min={-100}
            max={100}
            onChange={v => updateMask(activeMask.id, { saturation: v })}
            onReset={() => updateMask(activeMask.id, { saturation: 0 })}
          />

          <AdjustmentSlider
            label="Mask Temperature"
            value={activeMask.temperature}
            min={-100}
            max={100}
            onChange={v => updateMask(activeMask.id, { temperature: v })}
            onReset={() => updateMask(activeMask.id, { temperature: 0 })}
          />

          <AdjustmentSlider
            label="Mask Highlights"
            value={activeMask.highlights}
            min={-100}
            max={100}
            onChange={v => updateMask(activeMask.id, { highlights: v })}
            onReset={() => updateMask(activeMask.id, { highlights: 0 })}
          />

          <AdjustmentSlider
            label="Mask Shadows"
            value={activeMask.shadows}
            min={-100}
            max={100}
            onChange={v => updateMask(activeMask.id, { shadows: v })}
            onReset={() => updateMask(activeMask.id, { shadows: 0 })}
          />
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🎭</Text>
          <Text style={styles.emptyTitle}>Selective Editing</Text>
          <Text style={styles.emptyText}>
            Add a mask to selectively adjust specific areas of your photo. Choose Brush for painting, Linear for gradients from top/bottom, or Radial for circular/elliptical masks.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs
  },
  addBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: 3,
  },
  addBtnIcon: {
    fontSize: 12,
  },
  addBtnText: {
    ...typography.caption,
    color: colors.accentSecondary,
    fontSize: 12,
    fontWeight: '600'
  },
  maskChipScroll: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs
  },
  maskChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: colors.surfaceCard,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  maskChipActive: {
    borderColor: colors.accentPrimary,
    backgroundColor: colors.surfaceHover
  },
  maskChipText: {
    ...typography.caption,
    color: colors.textSecondary
  },
  maskChipTextActive: {
    color: colors.textPrimary,
    fontWeight: '700'
  },
  maskScrollContainer: {
    maxHeight: 240,
  },
  maskScrollContent: {
    paddingTop: 2,
    paddingBottom: spacing.sm,
  },
  maskHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: 2
  },
  maskTitle: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  maskActions: {
    flexDirection: 'row',
    gap: 6
  },
  toggleBtn: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 4
  },
  toggleBtnActive: {
    backgroundColor: colors.accentPrimary
  },
  toggleBtnText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11
  },
  toggleBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  deleteBtn: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 4
  },
  deleteBtnText: {
    ...typography.caption,
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '600'
  },
  geometryRow: {
    marginBottom: 2,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.15)',
    gap: 8,
  },
  infoIcon: {
    fontSize: 16,
  },
  infoText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  emptyContainer: {
    padding: spacing.md,
    alignItems: 'center'
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  }
});
