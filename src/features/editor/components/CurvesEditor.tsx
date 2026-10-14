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
  { id: 'composite', label: 'Grey', color: '#ffffff', fillColor: 'rgba(255, 255, 255, 0.12)' },
  { id: 'red', label: 'Red', color: '#ef4444', fillColor: 'rgba(239, 68, 68, 0.15)' },
  { id: 'green', label: 'Green', color: '#22c55e', fillColor: 'rgba(34, 197, 94, 0.15)' },
  { id: 'blue', label: 'Blue', color: '#3b82f6', fillColor: 'rgba(59, 130, 246, 0.15)' }
];

// Presets matching the user's "Basic Curves" reference diagram
const BASIC_CURVES_PRESETS = [
  {
    id: 'contrast',
    name: 'Increase contrast',
    description: 'Deepens shadows & boosts highlights (S-Curve)',
    points: [
      { x: 0, y: 0 },
      { x: 64, y: 38 },
      { x: 128, y: 128 },
      { x: 192, y: 218 },
      { x: 255, y: 255 }
    ]
  },
  {
    id: 'lifted',
    name: 'Lifted shadows',
    description: 'Lifts black point for cinematic matte film',
    points: [
      { x: 0, y: 52 },
      { x: 70, y: 82 },
      { x: 128, y: 128 },
      { x: 192, y: 192 },
      { x: 255, y: 255 }
    ]
  },
  {
    id: 'highlights',
    name: 'Increase highlights',
    description: 'Curves bright tones up toward white',
    points: [
      { x: 0, y: 0 },
      { x: 64, y: 64 },
      { x: 128, y: 128 },
      { x: 192, y: 228 },
      { x: 255, y: 255 }
    ]
  },
  {
    id: 'shadows',
    name: 'Increase shadows',
    description: 'Lifts dark tones to reveal shadow details',
    points: [
      { x: 0, y: 0 },
      { x: 64, y: 96 },
      { x: 128, y: 128 },
      { x: 192, y: 192 },
      { x: 255, y: 255 }
    ]
  },
  {
    id: 'linear',
    name: 'Linear (Default)',
    description: 'Flat identity diagonal line',
    points: [
      { x: 0, y: 0 },
      { x: 64, y: 64 },
      { x: 128, y: 128 },
      { x: 192, y: 192 },
      { x: 255, y: 255 }
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

  const graphSize = 200;
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

        // Find nearest control point
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

        // Update Y on touch
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

  // Build SVG smooth spline path through the points
  const curvePathD = useMemo(() => {
    const pts = activePoints.map(p => ({
      x: (p.x / 255) * graphSize,
      y: graphSize - (p.y / 255) * graphSize
    }));

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

  const POINT_NAMES = ['Blacks', 'Shadows', 'Mids', 'Highs', 'Whites'];

  // Helper to generate a miniature preview path for each preset card
  const getPresetSvgPath = (points: CurvePoint[], size: number) => {
    const pts = points.map(p => ({
      x: (p.x / 255) * size,
      y: size - (p.y / 255) * size
    }));
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
    return d;
  };

  return (
    <View style={styles.container}>
      {/* Channel Switcher (Grey, Red, Green, Blue) */}
      <View style={styles.channelRow}>
        <View style={styles.channelGroup}>
          {CHANNELS.map(ch => {
            const isActive = activeChannel === ch.id;
            return (
              <TouchableOpacity
                key={ch.id}
                style={[
                  styles.channelPill,
                  isActive && { borderColor: ch.color, backgroundColor: 'rgba(255, 255, 255, 0.10)' }
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
        </View>

        <TouchableOpacity style={styles.resetBtn} onPress={() => resetCurves(activeChannel)}>
          <Text style={styles.resetBtnText}>Reset Curve</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {/* Main Graph Box with Exact 4x4 Grid (as shown in reference image) */}
        <View style={styles.graphContainer}>
          <View
            ref={graphBoxRef}
            style={[styles.graphBox, { width: graphSize, height: graphSize }]}
            {...panResponder.panHandlers}
          >
            {/* 4x4 Grid Lines (3 horizontal, 3 vertical) */}
            <View style={[styles.gridH, { top: '25%' }]} />
            <View style={[styles.gridH, { top: '50%' }]} />
            <View style={[styles.gridH, { top: '75%' }]} />
            <View style={[styles.gridV, { left: '25%' }]} />
            <View style={[styles.gridV, { left: '50%' }]} />
            <View style={[styles.gridV, { left: '75%' }]} />

            {/* SVG Diagonal line & Smooth Tone Curve */}
            {Platform.OS === 'web' && React.createElement(
              'svg',
              {
                width: graphSize,
                height: graphSize,
                style: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }
              },
              // Diagonal guideline
              React.createElement('line', {
                x1: 0,
                y1: graphSize,
                x2: graphSize,
                y2: 0,
                stroke: 'rgba(255, 255, 255, 0.18)',
                strokeDasharray: '3 3',
                strokeWidth: '1'
              }),
              // Curve area fill
              React.createElement('path', {
                d: curvePathD.fillPath,
                fill: activeConfig.fillColor
              }),
              // Main Curve Line (Crisp white / channel color)
              React.createElement('path', {
                d: curvePathD.strokePath,
                fill: 'none',
                stroke: activeConfig.color,
                strokeWidth: '2.5'
              })
            )}

            {/* Control Point Dots (as in reference image) */}
            {activePoints.map((pt, idx) => {
              const cx = (pt.x / 255) * graphSize;
              const cy = graphSize - (pt.y / 255) * graphSize;
              const isSelected = selectedPointIdx === idx;
              return (
                <View
                  key={`pt_${idx}`}
                  style={[
                    styles.pointDot,
                    {
                      left: cx - 6,
                      top: cy - 6,
                      borderColor: activeConfig.color,
                      backgroundColor: isSelected ? activeConfig.color : '#ffffff',
                      transform: [{ scale: isSelected ? 1.3 : 1 }]
                    }
                  ]}
                />
              );
            })}
          </View>

          {/* Coordinate Readout HUD */}
          <View style={styles.readoutBox}>
            <Text style={styles.readoutTitle}>
              {POINT_NAMES[selectedPointIdx].toUpperCase()} POINT
            </Text>
            <Text style={[styles.readoutValues, { color: activeConfig.color }]}>
              In: {Math.round(activePoints[selectedPointIdx]?.x || 0)}  •  Out: {Math.round(activePoints[selectedPointIdx]?.y || 0)}
            </Text>
            <Text style={styles.readoutHint}>
              Drag the dots on the 4×4 grid or tap any curve preset below
            </Text>
          </View>
        </View>

        {/* Basic Curves Presets Header (matching image title) */}
        <Text style={styles.sectionTitle}>BASIC CURVES PRESETS</Text>

        {/* 4-Card Preset Gallery (matching the 4 boxes in user reference) */}
        <View style={styles.presetGrid}>
          {BASIC_CURVES_PRESETS.slice(0, 4).map(preset => {
            const miniSize = 68;
            const pathD = getPresetSvgPath(preset.points, miniSize);
            return (
              <TouchableOpacity
                key={preset.id}
                style={styles.presetCard}
                onPress={() => {
                  beginAdjustment();
                  updateCurveChannel(activeChannel, preset.points);
                  endAdjustment();
                }}
              >
                <Text style={styles.presetCardLabel}>{preset.name}</Text>
                <View style={[styles.miniGraph, { width: miniSize, height: miniSize }]}>
                  {/* 4x4 mini grid */}
                  <View style={[styles.miniGridH, { top: '25%' }]} />
                  <View style={[styles.miniGridH, { top: '50%' }]} />
                  <View style={[styles.miniGridH, { top: '75%' }]} />
                  <View style={[styles.miniGridV, { left: '25%' }]} />
                  <View style={[styles.miniGridV, { left: '50%' }]} />
                  <View style={[styles.miniGridV, { left: '75%' }]} />

                  {Platform.OS === 'web' && React.createElement(
                    'svg',
                    {
                      width: miniSize,
                      height: miniSize,
                      style: { position: 'absolute', top: 0, left: 0 }
                    },
                    React.createElement('line', {
                      x1: 0,
                      y1: miniSize,
                      x2: miniSize,
                      y2: 0,
                      stroke: 'rgba(255, 255, 255, 0.12)',
                      strokeWidth: '1'
                    }),
                    React.createElement('path', {
                      d: pathD,
                      fill: 'none',
                      stroke: activeConfig.color,
                      strokeWidth: '1.8'
                    })
                  )}

                  {/* Dot handles */}
                  {preset.points.map((pt, pIdx) => (
                    <View
                      key={`mini_pt_${pIdx}`}
                      style={[
                        styles.miniDot,
                        {
                          left: (pt.x / 255) * miniSize - 2,
                          top: miniSize - (pt.y / 255) * miniSize - 2,
                          backgroundColor: activeConfig.color
                        }
                      ]}
                    />
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Precision Numeric Tonal Sliders */}
        <Text style={styles.sectionTitle}>PRECISION TONAL SLIDERS</Text>

        <AdjustmentSlider
          label="Blacks (Deep Dark Point)"
          value={activePoints[0].y}
          min={0}
          max={100}
          onChange={v => updateCurvePoint(activeChannel, 0, { x: 0, y: v })}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateCurvePoint(activeChannel, 0, { x: 0, y: 0 })}
        />

        <AdjustmentSlider
          label="Shadows (Zone 64)"
          value={activePoints[1].y}
          min={0}
          max={255}
          onChange={v => updateCurvePoint(activeChannel, 1, { x: 64, y: v })}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateCurvePoint(activeChannel, 1, { x: 64, y: 64 })}
        />

        <AdjustmentSlider
          label="Mids (Center 128)"
          value={activePoints[2].y}
          min={0}
          max={255}
          onChange={v => updateCurvePoint(activeChannel, 2, { x: 128, y: v })}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateCurvePoint(activeChannel, 2, { x: 128, y: 128 })}
        />

        <AdjustmentSlider
          label="Highs (Zone 192)"
          value={activePoints[3].y}
          min={0}
          max={255}
          onChange={v => updateCurvePoint(activeChannel, 3, { x: 192, y: v })}
          onSlidingStart={beginAdjustment}
          onSlidingComplete={endAdjustment}
          onReset={() => updateCurvePoint(activeChannel, 3, { x: 192, y: 192 })}
        />

        <AdjustmentSlider
          label="Whites (Specular Peak 255)"
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
    height: 330,
    backgroundColor: colors.surface
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.surfaceElevated
  },
  channelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
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
    backgroundColor: '#0a0a0c',
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    overflow: 'hidden',
    position: 'relative'
  },
  gridH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.16)'
  },
  gridV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.16)'
  },
  pointDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
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
    fontWeight: '700',
    fontSize: 13,
    marginTop: 2
  },
  readoutHint: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 9,
    marginTop: 4,
    lineHeight: 13
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.8,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    textTransform: 'uppercase'
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.sm
  },
  presetCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: spacing.xs,
    alignItems: 'center',
    gap: 4
  },
  presetCardLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center'
  },
  miniGraph: {
    backgroundColor: '#0a0a0c',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    position: 'relative',
    overflow: 'hidden'
  },
  miniGridH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)'
  },
  miniGridV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)'
  },
  miniDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2
  }
});
