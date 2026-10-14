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
    description: 'Lifts black point for cinematic matte film look',
    points: [
      { x: 0, y: 52 },
      { x: 64, y: 82 },
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
    description: 'Neutral 1:1 diagonal line reset',
    points: [
      { x: 0, y: 0 },
      { x: 64, y: 64 },
      { x: 128, y: 128 },
      { x: 192, y: 192 },
      { x: 255, y: 255 }
    ]
  }
];

const POINT_NAMES = ['Blacks', 'Shadows', 'Mids', 'Highs', 'Whites'];

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

  const graphSize = 160;
  const graphBoxRef = useRef<View>(null);
  const graphPageRef = useRef({ x: 0, y: 0 });

  // Latest refs to prevent stale closures
  const activePointsRef = useRef(activePoints);
  activePointsRef.current = activePoints;

  const activeChannelRef = useRef(activeChannel);
  activeChannelRef.current = activeChannel;

  const isDraggingRef = useRef(false);
  const draggingPointIdxRef = useRef<number | null>(null);

  // Web Pointer Events: Accurate bounding box tracking
  const handleWebPointerDown = (e: any) => {
    if (Platform.OS !== 'web') return;
    const domNode = e.currentTarget as HTMLElement;
    const rect = domNode.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;
    const localX = Math.max(0, Math.min(graphSize, clientX - rect.left));
    const localY = Math.max(0, Math.min(graphSize, clientY - rect.top));

    // Find nearest point
    const pts = activePointsRef.current;
    let nearestIdx = 0;
    let minDiff = Infinity;
    pts.forEach((p, idx) => {
      const px = (p.x / 255) * graphSize;
      const py = graphSize - (p.y / 255) * graphSize;
      const dist = Math.hypot(localX - px, localY - py);
      if (dist < minDiff) {
        minDiff = dist;
        nearestIdx = idx;
      }
    });

    isDraggingRef.current = true;
    draggingPointIdxRef.current = nearestIdx;
    setSelectedPointIdx(nearestIdx);

    try {
      domNode.setPointerCapture?.(e.pointerId);
    } catch {}

    beginAdjustment();

    const normY = Math.max(0, Math.min(255, Math.round((1 - localY / graphSize) * 255)));
    updateCurvePoint(activeChannelRef.current, nearestIdx, {
      x: pts[nearestIdx].x,
      y: normY
    });
  };

  const handleWebPointerMove = (e: any) => {
    if (Platform.OS !== 'web' || !isDraggingRef.current || draggingPointIdxRef.current === null) return;
    const domNode = e.currentTarget as HTMLElement;
    const rect = domNode.getBoundingClientRect();
    const clientY = e.clientY;
    const localY = Math.max(0, Math.min(graphSize, clientY - rect.top));
    const normY = Math.max(0, Math.min(255, Math.round((1 - localY / graphSize) * 255)));

    const idx = draggingPointIdxRef.current;
    const pts = activePointsRef.current;
    if (idx >= 0 && idx < pts.length) {
      updateCurvePoint(activeChannelRef.current, idx, {
        x: pts[idx].x,
        y: normY
      });
    }
  };

  const handleWebPointerUp = (e: any) => {
    if (Platform.OS !== 'web') return;
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      draggingPointIdxRef.current = null;
      endAdjustment();
      try {
        const domNode = e.currentTarget as HTMLElement;
        domNode.releasePointerCapture?.(e.pointerId);
      } catch {}
    }
  };

  // Native Mobile PanResponder
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt, gestureState) => {
          beginAdjustment();
          isDraggingRef.current = true;
          if (graphBoxRef.current) {
            graphBoxRef.current.measureInWindow((x, y) => {
              graphPageRef.current = { x, y };
            });
          }
          const pageX = evt.nativeEvent.pageX ?? gestureState.x0;
          const pageY = evt.nativeEvent.pageY ?? gestureState.y0;
          const localX = Math.max(0, Math.min(graphSize, pageX - graphPageRef.current.x));
          const localY = Math.max(0, Math.min(graphSize, pageY - graphPageRef.current.y));

          const pts = activePointsRef.current;
          let nearestIdx = 0;
          let minDiff = Infinity;
          pts.forEach((p, idx) => {
            const px = (p.x / 255) * graphSize;
            const py = graphSize - (p.y / 255) * graphSize;
            const dist = Math.hypot(localX - px, localY - py);
            if (dist < minDiff) {
              minDiff = dist;
              nearestIdx = idx;
            }
          });

          draggingPointIdxRef.current = nearestIdx;
          setSelectedPointIdx(nearestIdx);

          const normY = Math.max(0, Math.min(255, Math.round((1 - localY / graphSize) * 255)));
          updateCurvePoint(activeChannelRef.current, nearestIdx, {
            x: pts[nearestIdx].x,
            y: normY
          });
        },
        onPanResponderMove: (evt, gestureState) => {
          if (!isDraggingRef.current || draggingPointIdxRef.current === null) return;
          const pageY = evt.nativeEvent.pageY ?? gestureState.moveY;
          const localY = Math.max(0, Math.min(graphSize, pageY - graphPageRef.current.y));
          const normY = Math.max(0, Math.min(255, Math.round((1 - localY / graphSize) * 255)));

          const idx = draggingPointIdxRef.current;
          const pts = activePointsRef.current;
          if (idx >= 0 && idx < pts.length) {
            updateCurvePoint(activeChannelRef.current, idx, {
              x: pts[idx].x,
              y: normY
            });
          }
        },
        onPanResponderRelease: () => {
          isDraggingRef.current = false;
          draggingPointIdxRef.current = null;
          endAdjustment();
        }
      }),
    [beginAdjustment, endAdjustment, updateCurvePoint, graphSize]
  );

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

  // Apply a preset directly to the active channel
  const handleApplyPreset = (presetPoints: CurvePoint[]) => {
    beginAdjustment();
    updateCurveChannel(activeChannel, presetPoints);
    endAdjustment();
  };

  return (
    <View style={styles.container}>
      {/* Top Channel Switcher Bar */}
      <View style={styles.channelRow}>
        <View style={styles.channelGroup}>
          {CHANNELS.map(ch => {
            const isActive = activeChannel === ch.id;
            return (
              <TouchableOpacity
                key={ch.id}
                style={[
                  styles.channelPill,
                  isActive && { borderColor: ch.color, backgroundColor: 'rgba(255, 255, 255, 0.12)' }
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
        showsVerticalScrollIndicator={false}
      >
        {/* Main 4x4 Grid Graph & HUD */}
        <View style={styles.graphContainer}>
          <View
            ref={graphBoxRef}
            style={[
              styles.graphBox,
              { width: graphSize, height: graphSize },
              Platform.OS === 'web' && ({ touchAction: 'none', userSelect: 'none', cursor: 'crosshair' } as any)
            ]}
            {...(Platform.OS === 'web'
              ? {
                  onPointerDown: handleWebPointerDown,
                  onPointerMove: handleWebPointerMove,
                  onPointerUp: handleWebPointerUp,
                  onPointerCancel: handleWebPointerUp
                } as any
              : panResponder.panHandlers)}
          >
            {/* 4x4 Grid Lines (3 horizontal, 3 vertical) */}
            <View style={[styles.gridH, { top: '25%' }]} pointerEvents="none" />
            <View style={[styles.gridH, { top: '50%' }]} pointerEvents="none" />
            <View style={[styles.gridH, { top: '75%' }]} pointerEvents="none" />
            <View style={[styles.gridV, { left: '25%' }]} pointerEvents="none" />
            <View style={[styles.gridV, { left: '50%' }]} pointerEvents="none" />
            <View style={[styles.gridV, { left: '75%' }]} pointerEvents="none" />

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

            {/* Control Point Dots with selection halo */}
            {activePoints.map((pt, idx) => {
              const cx = (pt.x / 255) * graphSize;
              const cy = graphSize - (pt.y / 255) * graphSize;
              const isSelected = selectedPointIdx === idx;
              return (
                <View
                  key={`pt_${idx}`}
                  style={[
                    styles.pointHitArea,
                    {
                      left: cx - 12,
                      top: cy - 12
                    }
                  ]}
                  pointerEvents="none"
                >
                  <View
                    style={[
                      styles.pointDot,
                      {
                        borderColor: activeConfig.color,
                        backgroundColor: isSelected ? activeConfig.color : '#ffffff',
                        transform: [{ scale: isSelected ? 1.3 : 1 }]
                      }
                    ]}
                  />
                  {isSelected && (
                    <View
                      style={[
                        styles.pointRing,
                        { borderColor: activeConfig.color }
                      ]}
                    />
                  )}
                </View>
              );
            })}
          </View>

          {/* Coordinate Readout HUD */}
          <View style={styles.readoutBox}>
            <Text style={styles.readoutTitle}>
              {POINT_NAMES[selectedPointIdx]?.toUpperCase() || 'POINT'} ADJUSTMENT
            </Text>
            <Text style={[styles.readoutValues, { color: activeConfig.color }]}>
              In: {Math.round(activePoints[selectedPointIdx]?.x || 0)}  •  Out: {Math.round(activePoints[selectedPointIdx]?.y || 0)}
            </Text>
            <Text style={styles.readoutHint}>
              Drag dot vertically on 4×4 grid or tap a preset below
            </Text>
          </View>
        </View>

        {/* Basic Curves Presets: Each preset is a SINGLE clickable button */}
        <Text style={styles.sectionTitle}>BASIC CURVES PRESETS</Text>

        <View style={styles.presetButtonsContainer}>
          {BASIC_CURVES_PRESETS.map(preset => (
            <TouchableOpacity
              key={preset.id}
              style={styles.singlePresetButton}
              activeOpacity={0.7}
              onPress={() => handleApplyPreset(preset.points)}
            >
              <Text style={styles.singlePresetTitle}>{preset.name}</Text>
              <Text style={styles.singlePresetDesc}>{preset.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 270,
    backgroundColor: '#161619',
    paddingTop: 4
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)'
  },
  channelGroup: {
    flexDirection: 'row',
    gap: 6
  },
  channelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255, 255, 255, 0.05)'
  },
  channelDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  channelLabel: {
    ...typography.caption,
    color: '#9ca3af',
    fontSize: 11
  },
  resetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)'
  },
  resetBtnText: {
    ...typography.caption,
    color: '#9ca3af',
    fontSize: 10
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: 6,
    paddingBottom: spacing.md
  },
  graphContainer: {
    alignItems: 'center',
    marginBottom: spacing.xs
  },
  graphBox: {
    backgroundColor: '#0a0a0d',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#374151',
    position: 'relative',
    overflow: 'hidden'
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
  pointHitArea: {
    position: 'absolute',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pointDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5
  },
  pointRing: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    opacity: 0.6
  },
  readoutBox: {
    marginTop: 4,
    alignItems: 'center'
  },
  readoutTitle: {
    ...typography.caption,
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8
  },
  readoutValues: {
    ...typography.bodyMedium,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1
  },
  readoutHint: {
    ...typography.caption,
    color: '#6b7280',
    fontSize: 9,
    marginTop: 1
  },
  sectionTitle: {
    ...typography.caption,
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: spacing.xs,
    marginBottom: 6
  },
  presetButtonsContainer: {
    gap: 6
  },
  singlePresetButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  singlePresetTitle: {
    ...typography.bodyMedium,
    color: '#f3f4f6',
    fontSize: 12,
    fontWeight: '600'
  },
  singlePresetDesc: {
    ...typography.caption,
    color: '#9ca3af',
    fontSize: 9,
    marginTop: 1
  }
});
