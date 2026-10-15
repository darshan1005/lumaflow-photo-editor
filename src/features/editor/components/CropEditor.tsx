import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing, typography } from '../../../theme/colors';
import { useEditorStore } from '../state/useEditorStore';
import { AdjustmentSlider } from './AdjustmentSlider';

export interface CropBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_CROP_SIZE = 0.001;

export type CropAspectMode = 'original' | 'free' | number;

export type CropInteractionHandle =
  | 'move'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export const ASPECT_RATIOS = [
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

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeCropRotation(rotation: number): number {
  const rounded = Math.round(finiteOr(rotation, 0) / 90) * 90;
  return ((rounded % 360) + 360) % 360;
}

export function getOrientedSourceDimensions(
  originalWidth: number,
  originalHeight: number,
  rotation: number
): { width: number; height: number } {
  const width = Math.max(MIN_CROP_SIZE, finiteOr(originalWidth, 1));
  const height = Math.max(MIN_CROP_SIZE, finiteOr(originalHeight, 1));
  const normalizedRotation = normalizeCropRotation(rotation);

  return normalizedRotation === 90 || normalizedRotation === 270
    ? { width: height, height: width }
    : { width, height };
}

/**
 * Keep a crop usable by the engine while retaining as much of the requested
 * rectangle as possible. Crop coordinates are normalized to the oriented
 * image frame, not to the dimensions of the current viewport.
 */
export function clampCropBounds(bounds: CropBounds): CropBounds {
  const width = clamp(finiteOr(bounds.width, 1), MIN_CROP_SIZE, 1);
  const height = clamp(finiteOr(bounds.height, 1), MIN_CROP_SIZE, 1);
  const x = clamp(finiteOr(bounds.x, 0), 0, 1 - width);
  const y = clamp(finiteOr(bounds.y, 0), 0, 1 - height);

  return { x, y, width, height };
}

/**
 * Resolve the ratio a crop gesture should preserve. Ratios are displayed
 * width / displayed height, while crop bounds are normalized in the oriented
 * source frame.
 */
export function getLockedCropAspectRatio(
  mode: CropAspectMode,
  originalWidth: number,
  originalHeight: number,
  rotation: number
): number | null {
  if (mode === 'free') return null;
  if (mode === 'original') {
    const oriented = getOrientedSourceDimensions(originalWidth, originalHeight, rotation);
    return oriented.width / oriented.height;
  }
  return Number.isFinite(mode) && mode > 0 ? mode : null;
}

/** Convert a displayed ratio to the normalized width/height ratio of bounds. */
export function getNormalizedCropAspectRatio(
  mode: CropAspectMode,
  originalWidth: number,
  originalHeight: number,
  rotation: number
): number | null {
  const displayedRatio = getLockedCropAspectRatio(mode, originalWidth, originalHeight, rotation);
  if (!displayedRatio) return null;
  const oriented = getOrientedSourceDimensions(originalWidth, originalHeight, rotation);
  return displayedRatio * oriented.height / oriented.width;
}

/**
 * Move a crop rectangle by a normalized delta without allowing it to leave
 * the oriented image frame.
 */
export function moveCropBounds(bounds: CropBounds, deltaX: number, deltaY: number): CropBounds {
  const current = clampCropBounds(bounds);
  const x = clamp(current.x + finiteOr(deltaX, 0), 0, 1 - current.width);
  const y = clamp(current.y + finiteOr(deltaY, 0), 0, 1 - current.height);
  return { ...current, x, y };
}

function fitAnchoredAspect(
  anchorX: number,
  anchorY: number,
  directionX: -1 | 1,
  directionY: -1 | 1,
  requestedWidth: number,
  requestedHeight: number,
  ratio: number
): CropBounds {
  const maxWidth = directionX > 0 ? 1 - anchorX : anchorX;
  const maxHeight = directionY > 0 ? 1 - anchorY : anchorY;
  let width = Math.min(Math.max(MIN_CROP_SIZE, requestedWidth), Math.max(MIN_CROP_SIZE, maxWidth));
  let height = Math.min(Math.max(MIN_CROP_SIZE, requestedHeight), Math.max(MIN_CROP_SIZE, maxHeight));

  if (width / Math.max(MIN_CROP_SIZE, height) > ratio) {
    width = height * ratio;
  } else {
    height = width / ratio;
  }

  if (width > maxWidth) {
    width = maxWidth;
    height = width / ratio;
  }
  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }

  width = Math.max(MIN_CROP_SIZE, Math.min(maxWidth, width));
  height = Math.max(MIN_CROP_SIZE, Math.min(maxHeight, height));

  return clampCropBounds({
    x: directionX > 0 ? anchorX : anchorX - width,
    y: directionY > 0 ? anchorY : anchorY - height,
    width,
    height
  });
}

/**
 * Resize one edge or corner. With no positive aspectRatio each requested edge
 * moves independently. With a ratio, the opposite edge/corner is anchored
 * and the perpendicular dimension is adjusted around its center.
 */
export function resizeCropBounds(
  bounds: CropBounds,
  handle: Exclude<CropInteractionHandle, 'move'>,
  deltaX: number,
  deltaY: number,
  aspectRatio?: number | null
): CropBounds {
  const current = clampCropBounds(bounds);
  const dx = finiteOr(deltaX, 0);
  const dy = finiteOr(deltaY, 0);
  const right = current.x + current.width;
  const bottom = current.y + current.height;
  const ratio = Number.isFinite(aspectRatio) && (aspectRatio as number) > 0
    ? aspectRatio as number
    : null;

  if (!ratio) {
    let x = current.x;
    let y = current.y;
    let width = current.width;
    let height = current.height;
    if (handle.includes('left')) {
      x = clamp(current.x + dx, 0, right - MIN_CROP_SIZE);
      width = right - x;
    } else if (handle.includes('right')) {
      width = clamp(current.width + dx, MIN_CROP_SIZE, 1 - current.x);
    }
    if (handle.includes('top')) {
      y = clamp(current.y + dy, 0, bottom - MIN_CROP_SIZE);
      height = bottom - y;
    } else if (handle.includes('bottom')) {
      height = clamp(current.height + dy, MIN_CROP_SIZE, 1 - current.y);
    }
    return clampCropBounds({ x, y, width, height });
  }

  if (handle === 'left' || handle === 'right') {
    const anchorX = handle === 'left' ? right : current.x;
    const requestedWidth = handle === 'left' ? current.width - dx : current.width + dx;
    const centerY = current.y + current.height / 2;
    const maxWidth = handle === 'left' ? anchorX : 1 - anchorX;
    let width = Math.min(Math.max(MIN_CROP_SIZE, requestedWidth), maxWidth);
    let height = width / ratio;
    const maxHeight = Math.min(centerY, 1 - centerY) * 2;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * ratio;
    }
    return clampCropBounds({
      x: handle === 'left' ? anchorX - width : anchorX,
      y: centerY - height / 2,
      width,
      height
    });
  }

  if (handle === 'top' || handle === 'bottom') {
    const anchorY = handle === 'top' ? bottom : current.y;
    const requestedHeight = handle === 'top' ? current.height - dy : current.height + dy;
    const centerX = current.x + current.width / 2;
    const maxHeight = handle === 'top' ? anchorY : 1 - anchorY;
    let height = Math.min(Math.max(MIN_CROP_SIZE, requestedHeight), maxHeight);
    let width = height * ratio;
    const maxWidth = Math.min(centerX, 1 - centerX) * 2;
    if (width > maxWidth) {
      width = maxWidth;
      height = width / ratio;
    }
    return clampCropBounds({
      x: centerX - width / 2,
      y: handle === 'top' ? anchorY - height : anchorY,
      width,
      height
    });
  }

  const anchorX = handle.includes('left') ? right : current.x;
  const anchorY = handle.includes('top') ? bottom : current.y;
  const directionX = handle.includes('left') ? -1 : 1;
  const directionY = handle.includes('top') ? -1 : 1;
  const requestedWidth = directionX < 0 ? current.width - dx : current.width + dx;
  const requestedHeight = directionY < 0 ? current.height - dy : current.height + dy;
  return fitAnchoredAspect(anchorX, anchorY, directionX, directionY, requestedWidth, requestedHeight, ratio);
}

/** Return the handle under a pointer in frame-local pixels. */
export function getCropInteractionHandle(
  pointX: number,
  pointY: number,
  frameWidth: number,
  frameHeight: number,
  bounds: CropBounds,
  hitSize = 24
): CropInteractionHandle | null {
  if (frameWidth <= 0 || frameHeight <= 0) return null;
  const current = clampCropBounds(bounds);
  const left = current.x * frameWidth;
  const top = current.y * frameHeight;
  const right = (current.x + current.width) * frameWidth;
  const bottom = (current.y + current.height) * frameHeight;
  const nearX = (x: number, target: number) => Math.abs(x - target) <= hitSize;
  const nearY = (y: number, target: number) => Math.abs(y - target) <= hitSize;

  if (nearX(pointX, left) && nearY(pointY, top)) return 'top-left';
  if (nearX(pointX, right) && nearY(pointY, top)) return 'top-right';
  if (nearX(pointX, left) && nearY(pointY, bottom)) return 'bottom-left';
  if (nearX(pointX, right) && nearY(pointY, bottom)) return 'bottom-right';
  if (nearX(pointX, left) && pointY >= top - hitSize && pointY <= bottom + hitSize) return 'left';
  if (nearX(pointX, right) && pointY >= top - hitSize && pointY <= bottom + hitSize) return 'right';
  if (nearY(pointY, top) && pointX >= left - hitSize && pointX <= right + hitSize) return 'top';
  if (nearY(pointY, bottom) && pointX >= left - hitSize && pointX <= right + hitSize) return 'bottom';
  if (pointX >= left && pointX <= right && pointY >= top && pointY <= bottom) return 'move';
  return null;
}

/**
 * Return the displayed pixel aspect ratio of a normalized crop rectangle.
 * Quarter-turn rotations swap the source dimensions before the calculation.
 */
export function getCropAspectRatio(
  crop: CropBounds,
  originalWidth: number,
  originalHeight: number,
  rotation: number
): number {
  const bounds = clampCropBounds(crop);
  const oriented = getOrientedSourceDimensions(originalWidth, originalHeight, rotation);
  return (bounds.width * oriented.width) / (bounds.height * oriented.height);
}

/**
 * Fit a preset inside the current crop rectangle and keep its center fixed.
 * The target ratio is expressed as displayed width / displayed height.
 */
export function getCenteredCropForAspectRatio(
  currentCrop: CropBounds,
  targetRatio: number,
  originalWidth: number,
  originalHeight: number,
  rotation: number
): CropBounds {
  const current = clampCropBounds(currentCrop);
  if (!Number.isFinite(targetRatio) || targetRatio <= 0) return current;

  const oriented = getOrientedSourceDimensions(originalWidth, originalHeight, rotation);
  const normalizedRatio = targetRatio * oriented.height / oriented.width;
  let width = current.width;
  let height = current.height;

  if (current.width / current.height > normalizedRatio) {
    width = current.height * normalizedRatio;
  } else {
    height = current.width / normalizedRatio;
  }

  return clampCropBounds({
    x: current.x + (current.width - width) / 2,
    y: current.y + (current.height - height) / 2,
    width,
    height
  });
}

function isNearlyEqualRatio(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(0.01, Math.abs(b) * 0.015);
}

export interface CropEditorProps {
  /** Shared with the viewport so its edge/corner gestures use the same lock. */
  selectedAspectRatio?: CropAspectMode;
  onAspectRatioChange?: (mode: CropAspectMode) => void;
}

export const CropEditor: React.FC<CropEditorProps> = ({
  selectedAspectRatio,
  onAspectRatioChange
}) => {
  const crop = useEditorStore(state => state.currentDocument.crop);
  const activeProject = useEditorStore(state => state.activeProject);
  const updateCrop = useEditorStore(state => state.updateCrop);
  const setActiveTab = useEditorStore(state => state.setActiveTab);
  const [internalAspectMode, setInternalAspectMode] = useState<CropAspectMode>('original');
  const aspectMode = selectedAspectRatio ?? internalAspectMode;

  const setAspectMode = (mode: CropAspectMode) => {
    if (selectedAspectRatio === undefined) setInternalAspectMode(mode);
    onAspectRatioChange?.(mode);
  };

  const originalWidth = activeProject?.originalWidth && activeProject.originalWidth > 0
    ? activeProject.originalWidth
    : 1;
  const originalHeight = activeProject?.originalHeight && activeProject.originalHeight > 0
    ? activeProject.originalHeight
    : 1;
  const bounds = clampCropBounds(crop);
  const orientedSource = getOrientedSourceDimensions(originalWidth, originalHeight, crop.rotation);
  const isFullFrame =
    bounds.x <= MIN_CROP_SIZE &&
    bounds.y <= MIN_CROP_SIZE &&
    bounds.width >= 1 - MIN_CROP_SIZE &&
    bounds.height >= 1 - MIN_CROP_SIZE;

  const updateBounds = (update: Partial<CropBounds>) => {
    const changedKeys = Object.keys(update);
    const lockedRatio = getNormalizedCropAspectRatio(
      aspectMode,
      originalWidth,
      originalHeight,
      crop.rotation
    );
    if (lockedRatio && changedKeys.length === 1) {
      const key = changedKeys[0];
      if (key === 'x') {
        updateCrop(resizeCropBounds(bounds, 'left', (update.x as number) - bounds.x, 0, lockedRatio));
        return;
      }
      if (key === 'y') {
        updateCrop(resizeCropBounds(bounds, 'top', 0, (update.y as number) - bounds.y, lockedRatio));
        return;
      }
      if (key === 'width') {
        updateCrop(resizeCropBounds(bounds, 'right', (update.width as number) - bounds.width, 0, lockedRatio));
        return;
      }
      if (key === 'height') {
        updateCrop(resizeCropBounds(bounds, 'bottom', 0, (update.height as number) - bounds.height, lockedRatio));
        return;
      }
    }
    updateCrop(clampCropBounds({ ...bounds, ...update }));
  };

  const handleSelectRatio = (item: typeof ASPECT_RATIOS[number]) => {
    if (item.ratio === null) {
      // Original changes the frame only. Transforms are intentionally kept.
      setAspectMode('original');
      updateCrop({ x: 0, y: 0, width: 1, height: 1 });
      return;
    }

    if (item.ratio === 0) {
      // Free is a mode choice. Keep the user's existing frame exactly as-is.
      setAspectMode('free');
      return;
    }

    setAspectMode(item.ratio);
    updateCrop(getCenteredCropForAspectRatio(
      bounds,
      item.ratio,
      originalWidth,
      originalHeight,
      crop.rotation
    ));
  };

  const handleRotate = () => {
    const nextRotation = normalizeCropRotation(crop.rotation + 90);
    if (typeof aspectMode === 'number' && aspectMode > 0) {
      updateCrop({
        ...getCenteredCropForAspectRatio(bounds, aspectMode, originalWidth, originalHeight, nextRotation),
        rotation: nextRotation
      });
    } else {
      updateCrop({ rotation: nextRotation });
    }
  };

  const handleFlipH = () => {
    updateCrop({ flipHorizontal: !crop.flipHorizontal });
  };

  const handleFlipV = () => {
    updateCrop({ flipVertical: !crop.flipVertical });
  };

  const handleResetCrop = () => {
    setAspectMode('original');
    updateCrop({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
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

  const getActiveRatioLabel = () => {
    if (aspectMode === 'free') return 'Free';
    if (aspectMode === 'original' || isFullFrame) return 'Original';
    for (const item of ASPECT_RATIOS) {
      if (typeof aspectMode === 'number' && item.ratio && isNearlyEqualRatio(aspectMode, item.ratio)) return item.label;
    }
    return 'Custom';
  };

  const isRatioSelected = (item: typeof ASPECT_RATIOS[number]): boolean => {
    if (item.ratio === 0) return aspectMode === 'free';
    if (item.ratio === null) return aspectMode === 'original';
    return typeof aspectMode === 'number' && aspectMode > 0 && isNearlyEqualRatio(aspectMode, item.ratio);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      {/* Crop Info Bar */}
      <View style={styles.infoBar}>
        <Text style={styles.infoText}>
          Aspect: {getActiveRatioLabel()} • {Math.round(bounds.width * orientedSource.width)}×{Math.round(bounds.height * orientedSource.height)}px
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
            const isSelected = isRatioSelected(item);

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

      {/* Normalized crop frame controls. The main viewport mirrors these bounds. */}
      <View style={styles.boundsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Crop frame</Text>
           <Text style={styles.sectionHint}>Drag the frame or adjust sliders</Text>
        </View>
        <AdjustmentSlider
          label="Left edge"
          value={bounds.x * 100}
          min={0}
          max={Math.max(1, (1 - bounds.width) * 100)}
          step={0.1}
          unit="%"
          onChange={value => updateBounds({ x: value / 100 })}
          onReset={() => updateBounds({ x: 0 })}
        />
        <AdjustmentSlider
          label="Top edge"
          value={bounds.y * 100}
          min={0}
          max={Math.max(1, (1 - bounds.height) * 100)}
          step={0.1}
          unit="%"
          onChange={value => updateBounds({ y: value / 100 })}
          onReset={() => updateBounds({ y: 0 })}
        />
        <AdjustmentSlider
          label="Width"
          value={bounds.width * 100}
          min={MIN_CROP_SIZE * 100}
          max={Math.max(MIN_CROP_SIZE * 100, (1 - bounds.x) * 100)}
          step={0.1}
          unit="%"
          onChange={value => updateBounds({ width: value / 100 })}
          onReset={() => updateBounds({ width: 1 - bounds.x })}
        />
        <AdjustmentSlider
          label="Height"
          value={bounds.height * 100}
          min={MIN_CROP_SIZE * 100}
          max={Math.max(MIN_CROP_SIZE * 100, (1 - bounds.y) * 100)}
          step={0.1}
          unit="%"
          onChange={value => updateBounds({ height: value / 100 })}
          onReset={() => updateBounds({ height: 1 - bounds.y })}
        />
      </View>

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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
  },
  contentContainer: {
    paddingBottom: spacing.md,
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
  boundsSection: {
    marginBottom: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: 2,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
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
