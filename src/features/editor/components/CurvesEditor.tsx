import React, { useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { colors, spacing, typography } from '../../../theme/colors';
import { CurvePoint } from '../../../types';
import { useEditorStore } from '../state/useEditorStore';
import { AdjustmentSlider } from './AdjustmentSlider';

type CurveChannel = 'composite' | 'red' | 'green' | 'blue';

interface ChannelConfig {
  id: CurveChannel;
  label: string;
  color: string;
  fillColor: string;
}

const CHANNELS: ChannelConfig[] = [
  { id: 'composite', label: 'Grey', color: '#e5e7eb', fillColor: 'rgba(255, 255, 255, 0.12)' },
  { id: 'red', label: 'Red', color: '#ef4444', fillColor: 'rgba(239, 68, 68, 0.15)' },
  { id: 'green', label: 'Green', color: '#22c55e', fillColor: 'rgba(34, 197, 94, 0.15)' },
  { id: 'blue', label: 'Blue', color: '#3b82f6', fillColor: 'rgba(59, 130, 246, 0.15)' }
];

const PRESETS = [
  {
    name: 'Linear',
    points: [
      { x: 0, y: 0 },
      { x: 64, y: 64 },
      { x: 128, y: 128 },
      { x: 192, y: 192 },
      { x: 255, y: 255 }
    ]
  },
  {
    name: 'Medium Contrast',
    points: [
      { x: 0, y: 0 },
      { x: 64, y: 52 },
      { x: 128, y: 128 },
      { x: 192, y: 204 },
      { x: 255, y: 255 }
    ]
  },
  {
    name: 'High Contrast',
    points: [
      { x: 0, y: 0 },
      { x: 64, y: 40 },
      { x: 128, y: 128 },
      { x: 192, y: 218 },
      { x: 255, y: 255 }
    ]
  },
  {
    name: 'Matte Film',
    points: [
      { x: 0, y: 32 },
      { x: 64, y: 72 },
      { x: 128, y: 128 },
      { x: 192, y: 190 },
      { x: 255, y: 235 }
    ]
  }
];

export const CurvesEditor: React.FC = () => {
  const [activeChannel, setActiveChannel] = useState<CurveChannel>('composite');
  const [selectedPointIdx, setSelectedPointIdx] = useState<number>(2); // Default to Mids (128)

  const curves = useEditorStore(state => state.currentDocument.curves);
  const updateCurvePoint = useEditorStore(state => state.updateCurvePoint);
  const updateCurveChannel = useEditorStore(state => state.updateCurveChannel);
  const resetCurves = useEditorStore(state => state.resetCurves);
  const beginAdjustment = useEditorStore(state => state.beginAdjustment);
  const endAdjustment = useEditorStore(state => state.endAdjustment);

  const activePoints: CurvePoint[] = useMemo(() => {
    if (curves && curves[activeChannel] && curves[activeChannel].length >= 5) {
      return curves[activeChannel];
    }
    return [
      { x: 0, y: 0 },
      { x: 64, y: 64 },
      { x: 128, y: 128 },
      { x: 192, y: 192 },
      { x: 255, y: 255 }
    ];
  }, [curves, activeChannel]);

  const activeConfig = CHANNELS.find(c => c.id === activeChannel) || CHANNELS[0];

  const graphSize = 190;
  const graphBoxRef = useRef<View>(null);
  const graphPageRef = useRef({ x: 0, y: 0 });

  // PanResponder to drag control points directly on the 2D graph
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        beginAdjustment();
        if (graphBoxRef.current) {
          graphBoxRef.current.measureInWindow((x, y) => {
            graphPageRef.current = { x, y };
          });
        }
        const touchX = evt.nativeEvent.locationX;
        const normX = Math.max(0, Math.min(255, (touchX / graphSize) * 255));

        // Find nearest point
        let nearestIdx = 0;
        let minDiff = 999;
        activePoints.forEach((pt, idx) => {
          const diff = Math.abs(pt.x - normX);
          if (diff < minDiff) {
            minDiff = diff;
            nearestIdx = idx;
          }
        });
        setSelectedPointIdx(nearestIdx);

        // Update Y immediately on touch
        const touchY = evt.nativeEvent.locationY;
        const newY = Math.max(0, Math.min(255, 255 - (touchY / graphSize) * 255));
        updateCurvePoint(activeChannel, nearestIdx, { x: activePoints[nearestIdx].x, y: newY });
      },
      onPanResponderMove: (evt) => {
        const touchY = evt.nativeEvent.locationY;
        const newY = Math.max(0, Math.min(255, 255 - (touchY / graphSize) * 255));
        updateCurvePoint(activeChannel, selectedPointIdx, {
          x: activePoints[selectedPointIdx].x,
          y: newY
        });
      },
      onPanResponderRelease: () => {
        endAdjustment();
      }
    })
  ).current;

  // Build SVG path string for smooth cubic curve
  const curvePathD = useMemo(() => {
    // Generate smooth curve through points
    const pts = activePoints.map(p => ({
      x: (p.x / 255) * graphSize,
      y: graphSize - (p.y / 255) * graphSize
    }));

    // SVG cubic bezier path
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    return {
      strokePath: d,
      fillPath: `${d} L ${graphSize} ${graphSize} L 0 ${graphSize} Z`
    };
  }, [activePoints, graphSize]);

  // Point labels for quick sliders
  const POINT_NAMES = ['Blacks', 'Shadows', 'Mids', 'Highs', 'Whites'];

  return (
    <View style={styles.container}>
      {/* Channel Pills Header */}
      <View style={styles.channelRow}>
        {CHANNELS.map(ch => {
          const isActive = activeChannel === ch.id;
          return (
            <TouchableOpacity
              key={ch.id}
              style={[
                styles.channelPill,
                isActive && { borderColor: ch.color, backgroundColor: 'rgba(255, 255, 255, 0.08)' }
              ]}
              onPress={() => setActiveChannel(ch.id)}
            >
              <View style={[styles.channelDot, { backgroundColor: ch.color }]} />
              <Text style={[styles.channelLabel, isActive && { color: ch.color, fontWeight: '700' }]}>
                {ch.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity style={styles.resetBtn} onPress={() => resetCurves(activeChannel)}>
          <Text style={styles.resetBtnText}>Reset</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {/* Main 2D Graph Visualizer */}
        <View style={styles.graphContainer}>
          <View
            ref={graphBoxRef}
            style={[styles.graphBox, { width: graphSize, height: graphSize }]}
            {...panResponder.panHandlers}
          >
            {/* Grid Lines */}
            <View style={[styles.gridH, { top: '25%' }]} />
            <View style={[styles.gridH, { top: '50%' }]} />
            <View style={[styles.gridH, { top: '75%' }]} />
            <View style={[styles.gridV, { left: '25%' }]} />
            <View style={[styles.gridV, { left: '50%' }]} />
            <View style={[styles.gridV, { left: '75%' }]} />

            {/* Diagonal Identity Reference */}
            {Platform.OS === 'web' && React.createElement(
              'svg',
              {
                width: graphSize,
                height: graphSize,
                style: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }
              },
              React.createElement('line', {
                x1: 0,
                y1: graphSize,
                x2: graphSize,
                y2: 0,
                stroke: 'rgba(255, 255, 255, 0.15)',
                strokeDasharray: '3 3',
                strokeWidth: '1'
              }),
              React.createElement('path', {
                d: curvePathD.fillPath,
                fill: activeConfig.fillColor
              }),
              React.createElement('path', {
                d: curvePathD.strokePath,
                fill: 'none',
                stroke: activeConfig.color,
                strokeWidth: '2.5'
              })
            )}

            {/* Interactive Control Points Handles */}
            {activePoints.map((pt, idx) => {
              const cx = (pt.x / 255) * graphSize;
              const cy = graphSize - (pt.y / 255) * graphSize;
              const isSelected = selectedPointIdx === idx;
              return (
                <View
                  key={`pt_${idx}`}
                  style={[
                    styles.pointHandle,
                    {
                      left: cx - 8,
                      top: cy - 8,
                      borderColor: activeConfig.color,
                      backgroundColor: isSelected ? activeConfig.color : '#111116',
                      transform: [{ scale: isSelected ? 1.25 : 1 }]
                    }
                  ]}
                />
              );
            })}
          </View>

          {/* Coordinate Readout */}
          <View style={styles.readoutBox}>
            <Text style={styles.readoutTitle}>
              {POINT_NAMES[selectedPointIdx].toUpperCase()} POINT
            </Text>
            <Text style={styles.readoutValues}>
              In: {Math.round(activePoints[selectedPointIdx]?.x || 0)} • Out: {Math.round(activePoints[selectedPointIdx]?.y || 0)}
            </Text>
            <Text style={styles.readoutHint}>
              Drag points directly on the graph or use precision sliders below
            </Text>
          </View>
        </View>

        {/* Quick Presets Row */}
        <View style={styles.presetsRow}>
          {PRESETS.map(preset => (
            <TouchableOpacity
              key={preset.name}
              style={styles.presetPill}
              onPress={() => {
                beginAdjustment();
                updateCurveChannel(activeChannel, preset.points);
                endAdjustment();
              }}
            >
              <Text style={styles.presetPillText}>{preset.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Precision Tonal Sliders */}
        <Text style={styles.sectionHeader}>PRECISION TONAL CONTROLS</Text>

        <AdjustmentSlider
          label="Blacks Point"
          value={activePoints[0].y}
          min={0}
          max={100}
          onChange={v => updateCurvePoint(activeChannel, 0, { x: 0, y: v })}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateCurvePoint(activeChannel, 0, { x: 0, y: 0 })}
        />

        <AdjustmentSlider
          label="Shadows (64)"
          value={activePoints[1].y}
          min={0}
          max={255}
          onChange={v => updateCurvePoint(activeChannel, 1, { x: 64, y: v })}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateCurvePoint(activeChannel, 1, { x: 64, y: 64 })}
        />

        <AdjustmentSlider
          label="Midtones (128)"
          value={activePoints[2].y}
          min={0}
          max={255}
          onChange={v => updateCurvePoint(activeChannel, 2, { x: 128, y: v })}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateCurvePoint(activeChannel, 2, { x: 128, y: 128 })}
        />

        <AdjustmentSlider
          label="Highlights (192)"
          value={activePoints[3].y}
          min={0}
          max={255}
          onChange={v => updateCurvePoint(activeChannel, 3, { x: 192, y: v })}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateCurvePoint(activeChannel, 3, { x: 192, y: 192 })}
        />

        <AdjustmentSlider
          label="Whites Point"
          value={activePoints[4].y}
          min={150}
          max={255}
          onChange={v => updateCurvePoint(activeChannel, 4, { x: 255, y: v })}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateCurvePoint(activeChannel, 4, { x: 255, y: 255 })}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 310,
    backgroundColor: colors.surface
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.surfaceElevated
  },
  channelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 4
  },
  channelDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  channelLabel: {
    ...typography.labelSmall,
    color: colors.textMuted,
    fontSize: 11
  },
  resetBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4
  },
  resetBtnText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingVertical: spacing.sm,
    paddingBottom: spacing.xxl
  },
  graphContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.sm
  },
  graphBox: {
    backgroundColor: '#0d0d11',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
    position: 'relative'
  },
  gridH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)'
  },
  gridV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)'
  },
  pointHandle: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    zIndex: 10
  },
  readoutBox: {
    flex: 1,
    justifyContent: 'center'
  },
  readoutTitle: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5
  },
  readoutValues: {
    ...typography.caption,
    color: colors.accentPrimary,
    fontWeight: '700',
    fontSize: 12,
    marginTop: 2
  },
  readoutHint: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 9,
    marginTop: 4,
    lineHeight: 12
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    marginVertical: spacing.xs
  },
  presetPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  presetPillText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10
  },
  sectionHeader: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: 9,
    letterSpacing: 1,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
    marginBottom: 2
  }
});
