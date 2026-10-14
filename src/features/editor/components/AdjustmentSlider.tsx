import React, { useCallback, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing, typography } from '../../../theme/colors';

interface AdjustmentSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
  onSlidingStart?: () => void;
  onSlidingComplete?: (val: number) => void;
  onReset: () => void;
}

export const AdjustmentSlider: React.FC<AdjustmentSliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  onSlidingStart,
  onSlidingComplete,
  onReset
}) => {
  const [trackWidth, setTrackWidth] = useState(200);
  const trackRef = useRef<View>(null);
  const trackPageXRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSlidingStartRef = useRef(onSlidingStart);
  onSlidingStartRef.current = onSlidingStart;
  const onSlidingCompleteRef = useRef(onSlidingComplete);
  onSlidingCompleteRef.current = onSlidingComplete;
  const valueRef = useRef(value);
  valueRef.current = value;
  const minRef = useRef(min);
  minRef.current = min;
  const maxRef = useRef(max);
  maxRef.current = max;
  const stepRef = useRef(step);
  stepRef.current = step;
  const trackWidthRef = useRef(trackWidth);
  trackWidthRef.current = trackWidth;

  const calculateValueFromPageX = useCallback((pageX: number) => {
    const tw = trackWidthRef.current;
    if (tw <= 0) return;
    const localX = pageX - trackPageXRef.current;
    const clampedX = Math.max(0, Math.min(tw, localX));
    const ratio = clampedX / tw;
    const currentMin = minRef.current;
    const currentMax = maxRef.current;
    const currentStep = stepRef.current;
    let rawVal = currentMin + ratio * (currentMax - currentMin);

    // Apply step snapping
    if (currentStep < 1) {
      const precision = currentStep.toString().split('.')[1]?.length || 1;
      rawVal = parseFloat(rawVal.toFixed(precision));
    } else {
      rawVal = Math.round(rawVal / currentStep) * currentStep;
    }

    const clampedVal = Math.max(currentMin, Math.min(currentMax, rawVal));
    valueRef.current = clampedVal;
    onChangeRef.current(clampedVal);
  }, []);

  const measureTrack = useCallback(() => {
    if (trackRef.current) {
      trackRef.current.measureInWindow((x: number) => {
        trackPageXRef.current = x;
      });
    }
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        onSlidingStartRef.current?.();
        measureTrack();
        const pageX = evt?.nativeEvent?.pageX ?? gestureState.x0;
        if (typeof pageX === 'number' && !isNaN(pageX)) {
          calculateValueFromPageX(pageX);
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const pageX = evt?.nativeEvent?.pageX ?? gestureState.moveX;
        if (typeof pageX === 'number' && !isNaN(pageX)) {
          calculateValueFromPageX(pageX);
        }
      },
      onPanResponderRelease: () => {
        onSlidingCompleteRef.current?.(valueRef.current);
      }
    })
  ).current;

  const normalizedProgress = (value - min) / (max - min);
  const clampedProgress = Math.max(0, Math.min(1, normalizedProgress));

  // Zero mark percentage for centered sliders (e.g. -100 to +100)
  const isCentered = min < 0 && max > 0;
  const zeroProgress = isCentered ? (0 - min) / (max - min) : 0;

  const handleStep = (direction: 'up' | 'down') => {
    onSlidingStartRef.current?.();
    const delta = direction === 'up' ? step : -step;
    let nextVal = value + delta;
    if (step < 1) {
      nextVal = parseFloat(nextVal.toFixed(2));
    } else {
      nextVal = Math.round(nextVal);
    }
    const finalVal = Math.max(min, Math.min(max, nextVal));
    valueRef.current = finalVal;
    onChange(finalVal);
    onSlidingCompleteRef.current?.(finalVal);
  };

  // Format display value nicely
  const displayValue = step < 1
    ? (value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1))
    : (value > 0 ? `+${value}` : `${value}`);

  return (
    <View style={styles.container}>
      {/* Header Row */}
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity
          onPress={() => {
            onSlidingStartRef.current?.();
            onReset();
            onSlidingCompleteRef.current?.(min < 0 && max > 0 ? 0 : min);
          }}
          hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
          style={styles.valueContainer}
        >
          <Text style={[styles.value, value !== 0 && styles.valueActive]}>
            {displayValue}
            {unit}
          </Text>
          {value !== 0 && <Text style={styles.resetHint}>↺</Text>}
        </TouchableOpacity>
      </View>

      {/* Interactive Slider Track with Nudge Buttons */}
      <View style={styles.controlRow}>
        <TouchableOpacity
          style={styles.nudgeBtn}
          onPress={() => handleStep('down')}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={styles.nudgeText}>−</Text>
        </TouchableOpacity>

        <View
          ref={trackRef}
          style={styles.trackContainer}
          onLayout={e => {
            setTrackWidth(e.nativeEvent.layout.width);
            // Also measure pageX after layout
            setTimeout(measureTrack, 50);
          }}
          {...panResponder.panHandlers}
        >
          <View style={styles.trackBackground} />

          {/* Center Zero Mark */}
          {isCentered && (
            <View
              style={[
                styles.zeroMark,
                { left: `${zeroProgress * 100}%` }
              ]}
            />
          )}

          {/* Active Highlight Fill */}
          {isCentered ? (
            <View
              style={[
                styles.trackActive,
                clampedProgress >= zeroProgress
                  ? {
                      left: `${zeroProgress * 100}%`,
                      width: `${(clampedProgress - zeroProgress) * 100}%`
                    }
                  : {
                      left: `${clampedProgress * 100}%`,
                      width: `${(zeroProgress - clampedProgress) * 100}%`
                    }
              ]}
            />
          ) : (
            <View
              style={[
                styles.trackActive,
                { width: `${clampedProgress * 100}%` }
              ]}
            />
          )}

          {/* Draggable Thumb Knob */}
          <View
            style={[
              styles.thumb,
              { left: `${clampedProgress * 100}%` }
            ]}
          />
        </View>

        <TouchableOpacity
          style={styles.nudgeBtn}
          onPress={() => handleStep('up')}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={styles.nudgeText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    paddingHorizontal: spacing.md
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  label: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontSize: 13
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  value: {
    ...typography.numeric,
    color: colors.textSecondary,
    fontSize: 13
  },
  valueActive: {
    color: colors.accentSecondary,
    fontWeight: '700'
  },
  resetHint: {
    fontSize: 12,
    color: colors.textMuted
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  nudgeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  nudgeText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 18
  },
  trackContainer: {
    flex: 1,
    height: 36,
    justifyContent: 'center',
    position: 'relative',
    cursor: 'pointer' as any
  },
  trackBackground: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceHover
  },
  zeroMark: {
    position: 'absolute',
    width: 2,
    height: 8,
    top: 14,
    backgroundColor: colors.borderSubtle,
    marginLeft: -1,
    zIndex: 1
  },
  trackActive: {
    position: 'absolute',
    height: 4,
    top: 16,
    borderRadius: 2,
    backgroundColor: colors.accentPrimary
  },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    marginLeft: -10,
    top: 8,
    borderWidth: 2,
    borderColor: colors.accentPrimary,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    zIndex: 2
  }
});
