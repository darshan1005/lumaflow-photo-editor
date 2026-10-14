import React, { useMemo, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { colors, spacing, typography } from '../../../theme/colors';
import { EditDocument } from '../../../types';
import { CompleteImageAnalysis } from '../../../core/image-engine/ImageBinaryExtractor';
import { interpolateCurveLut } from '../models/EditDocument';

interface RealtimeHistogramProps {
  document: EditDocument;
  analysis?: CompleteImageAnalysis | null;
  compact?: boolean;
}

type HistogramChannelView = 'all' | 'luma' | 'r' | 'g' | 'b';

export const RealtimeHistogram: React.FC<RealtimeHistogramProps> = ({
  document: doc,
  analysis,
  compact = false
}) => {
  const [channelView, setChannelView] = useState<HistogramChannelView>('all');
  const [isExpanded, setIsExpanded] = useState(!compact);

  // Baseline synthetic or extracted histogram
  const baseHistograms = useMemo(() => {
    if (analysis?.histograms) {
      return analysis.histograms;
    }
    // High-fidelity natural baseline distribution
    const luma = new Uint32Array(256);
    const red = new Uint32Array(256);
    const green = new Uint32Array(256);
    const blue = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      // Natural bell curve centered at mid-tones
      const dist = Math.exp(-Math.pow(i - 120, 2) / (2 * Math.pow(48, 2)));
      const count = Math.round(dist * 1200 + 15);
      luma[i] = count;
      red[i] = Math.round(count * (1 + 0.15 * Math.sin((i / 255) * Math.PI)));
      green[i] = count;
      blue[i] = Math.round(count * (1 + 0.12 * Math.cos((i / 255) * Math.PI)));
    }
    return { luminance: luma, red, green, blue, totalSampledPixels: 100000 };
  }, [analysis?.histograms]);

  // Compute live real-time transferred histogram
  const liveHistogram = useMemo(() => {
    const b = doc.basic;
    const g = doc.colorGrading;
    const curves = doc.curves;

    const outLuma = new Uint32Array(256);
    const outRed = new Uint32Array(256);
    const outGreen = new Uint32Array(256);
    const outBlue = new Uint32Array(256);

    // Precompute Curve LUTs
    const compLut = curves?.composite ? interpolateCurveLut(curves.composite) : null;
    const rLut = curves?.red ? interpolateCurveLut(curves.red) : null;
    const gLut = curves?.green ? interpolateCurveLut(curves.green) : null;
    const bLut = curves?.blue ? interpolateCurveLut(curves.blue) : null;

    const expScale = Math.pow(2, b.exposure);
    const contrast = 1.0 + (b.contrast / 100) * 0.8;
    const tempShift = (b.temperature / 100) * 32;
    const tintShift = (b.tint / 100) * 24;

    // Highlights & Shadows shifts
    const highShift = (b.highlights / 100) * 28;
    const shadowShift = (b.shadows / 100) * 28;
    const whiteShift = (b.whites / 100) * 35;
    const blackShift = (b.blacks / 100) * 35;

    // Transform each input bin 0..255 to its adjusted output bin
    for (let bin = 0; bin < 256; bin++) {
      const norm = bin / 255.0;

      // 1. Exposure & Contrast
      let v = norm * expScale;
      v = (v - 0.5) * contrast + 0.5;

      // 2. Highlights / Shadows / Whites / Blacks
      if (norm > 0.65) {
        v += (whiteShift / 255.0) * Math.pow((norm - 0.65) / 0.35, 1.6);
      }
      if (norm < 0.35) {
        v += (blackShift / 255.0) * Math.pow((0.35 - norm) / 0.35, 1.6);
      }
      if (norm > 0.45 && norm < 0.95) {
        v += (highShift / 255.0) * Math.sin(((norm - 0.45) / 0.50) * Math.PI);
      }
      if (norm > 0.05 && norm < 0.55) {
        v += (shadowShift / 255.0) * Math.sin(((norm - 0.05) / 0.50) * Math.PI);
      }

      // 3. Composite Curve
      let vLuma = Math.max(0, Math.min(1, v));
      let binLuma = Math.round(vLuma * 255);
      if (compLut) {
        binLuma = compLut[binLuma];
        vLuma = binLuma / 255.0;
      }

      // 4. Color temperature & individual R/G/B shifts
      let binR = Math.max(0, Math.min(255, Math.round(binLuma + tempShift * 0.7 + tintShift * 0.3)));
      let binG = Math.max(0, Math.min(255, Math.round(binLuma - tintShift * 0.6)));
      let binB = Math.max(0, Math.min(255, Math.round(binLuma - tempShift * 0.7 + tintShift * 0.3)));

      if (rLut) binR = rLut[binR];
      if (gLut) binG = gLut[binG];
      if (bLut) binB = bLut[binB];

      outLuma[binLuma] += baseHistograms.luminance[bin];
      outRed[binR] += baseHistograms.red[bin];
      outGreen[binG] += baseHistograms.green[bin];
      outBlue[binB] += baseHistograms.blue[bin];
    }

    // Find peak value across 64 display points (downsampled from 256 for smooth drawing)
    let peak = 1;
    for (let i = 0; i < 256; i++) {
      if (outLuma[i] > peak) peak = outLuma[i];
      if (outRed[i] > peak) peak = outRed[i];
      if (outGreen[i] > peak) peak = outGreen[i];
      if (outBlue[i] > peak) peak = outBlue[i];
    }

    // Detect shadow and highlight clipping
    const shadowClipped = (outLuma[0] + outLuma[1] + outLuma[2]) > (peak * 0.4);
    const highlightClipped = (outLuma[253] + outLuma[254] + outLuma[255]) > (peak * 0.4);

    return {
      luma: outLuma,
      red: outRed,
      green: outGreen,
      blue: outBlue,
      peak,
      shadowClipped,
      highlightClipped
    };
  }, [baseHistograms, doc]);

  // Downsample to 64 curve coordinates for graph path rendering
  const graphWidth = isExpanded ? 240 : 130;
  const graphHeight = isExpanded ? 64 : 36;
  const pointsCount = 48;

  const buildPathD = (histArray: Uint32Array, color: string) => {
    const step = 256 / pointsCount;
    const points: string[] = [];

    for (let i = 0; i < pointsCount; i++) {
      const startBin = Math.floor(i * step);
      const endBin = Math.min(255, Math.floor((i + 1) * step));
      let sum = 0;
      for (let b = startBin; b <= endBin; b++) sum += histArray[b];
      const avg = sum / (endBin - startBin + 1);

      // Logarithmic scaling for photographic visual representation
      const normY = Math.min(1.0, Math.log10(1 + (avg / liveHistogram.peak) * 9));
      const x = ((i / (pointsCount - 1)) * graphWidth).toFixed(1);
      const y = (graphHeight - normY * (graphHeight - 4) - 2).toFixed(1);

      points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
    }

    return {
      strokePath: points.join(' '),
      fillPath: `${points.join(' ')} L ${graphWidth} ${graphHeight} L 0 ${graphHeight} Z`
    };
  };

  const lumaPaths = useMemo(() => buildPathD(liveHistogram.luma, '#ffffff'), [liveHistogram.luma, liveHistogram.peak, graphWidth, graphHeight]);
  const redPaths = useMemo(() => buildPathD(liveHistogram.red, '#ef4444'), [liveHistogram.red, liveHistogram.peak, graphWidth, graphHeight]);
  const greenPaths = useMemo(() => buildPathD(liveHistogram.green, '#22c55e'), [liveHistogram.green, liveHistogram.peak, graphWidth, graphHeight]);
  const bluePaths = useMemo(() => buildPathD(liveHistogram.blue, '#3b82f6'), [liveHistogram.blue, liveHistogram.peak, graphWidth, graphHeight]);

  return (
    <View style={[styles.container, isExpanded && styles.containerExpanded]}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>HISTOGRAM</Text>
          {liveHistogram.shadowClipped && (
            <View style={[styles.clipBadge, { backgroundColor: '#3b82f6' }]}>
              <Text style={styles.clipText}>◀ CRUSH</Text>
            </View>
          )}
          {liveHistogram.highlightClipped && (
            <View style={[styles.clipBadge, { backgroundColor: '#ef4444' }]}>
              <Text style={styles.clipText}>CLIP ▶</Text>
            </View>
          )}
        </View>

        {isExpanded && (
          <View style={styles.channelRow}>
            {(['all', 'luma', 'r', 'g', 'b'] as const).map(ch => (
              <TouchableOpacity
                key={ch}
                style={[styles.chBtn, channelView === ch && styles.chBtnActive]}
                onPress={() => setChannelView(ch)}
              >
                <Text
                  style={[
                    styles.chBtnText,
                    channelView === ch && styles.chBtnTextActive,
                    ch === 'r' && { color: '#ef4444' },
                    ch === 'g' && { color: '#22c55e' },
                    ch === 'b' && { color: '#60a5fa' }
                  ]}
                >
                  {ch.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.toggleBtn} onPress={() => setIsExpanded(!isExpanded)}>
          <Text style={styles.toggleBtnText}>{isExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>
      </View>

      {/* SVG Canvas Area */}
      <View style={[styles.graphWrapper, { width: graphWidth, height: graphHeight }]}>
        {/* Tonal zone grid markings */}
        <View style={styles.gridOverlay}>
          <View style={[styles.gridCol, { width: '25%' }]} />
          <View style={[styles.gridCol, { width: '25%' }]} />
          <View style={[styles.gridCol, { width: '25%' }]} />
          <View style={[styles.gridCol, { width: '25%' }]} />
        </View>

        {Platform.OS === 'web' ? (
          React.createElement(
            'svg',
            {
              width: graphWidth,
              height: graphHeight,
              style: { position: 'absolute', top: 0, left: 0 }
            },
            // Red channel
            (channelView === 'all' || channelView === 'r') &&
              React.createElement('path', {
                d: redPaths.fillPath,
                fill: 'rgba(239, 68, 68, 0.28)',
              }),
            (channelView === 'all' || channelView === 'r') &&
              React.createElement('path', {
                d: redPaths.strokePath,
                fill: 'none',
                stroke: '#ef4444',
                strokeWidth: '1.2',
              }),
            // Green channel
            (channelView === 'all' || channelView === 'g') &&
              React.createElement('path', {
                d: greenPaths.fillPath,
                fill: 'rgba(34, 197, 94, 0.28)',
              }),
            (channelView === 'all' || channelView === 'g') &&
              React.createElement('path', {
                d: greenPaths.strokePath,
                fill: 'none',
                stroke: '#22c55e',
                strokeWidth: '1.2',
              }),
            // Blue channel
            (channelView === 'all' || channelView === 'b') &&
              React.createElement('path', {
                d: bluePaths.fillPath,
                fill: 'rgba(59, 130, 246, 0.28)',
              }),
            (channelView === 'all' || channelView === 'b') &&
              React.createElement('path', {
                d: bluePaths.strokePath,
                fill: 'none',
                stroke: '#3b82f6',
                strokeWidth: '1.2',
              }),
            // Luminance channel
            (channelView === 'all' || channelView === 'luma') &&
              React.createElement('path', {
                d: lumaPaths.fillPath,
                fill: 'rgba(255, 255, 255, 0.20)',
              }),
            (channelView === 'all' || channelView === 'luma') &&
              React.createElement('path', {
                d: lumaPaths.strokePath,
                fill: 'none',
                stroke: 'rgba(255, 255, 255, 0.85)',
                strokeWidth: '1.5',
              })
          )
        ) : (
          // Mobile Fallback: Bars Representation
          <View style={[styles.mobileBarsContainer, { width: graphWidth, height: graphHeight }]}>
            {Array.from({ length: 32 }).map((_, idx) => {
              const bin = Math.min(255, idx * 8);
              const val = liveHistogram.luma[bin] || 0;
              const barH = Math.min(graphHeight - 4, Math.max(2, (val / liveHistogram.peak) * (graphHeight - 4)));
              return (
                <View
                  key={`bar_${idx}`}
                  style={[
                    styles.mobileBar,
                    {
                      height: barH,
                      backgroundColor:
                        channelView === 'r' ? '#ef4444' :
                        channelView === 'g' ? '#22c55e' :
                        channelView === 'b' ? '#3b82f6' :
                        'rgba(255, 255, 255, 0.75)'
                    }
                  ]}
                />
              );
            })}
          </View>
        )}
      </View>

      {/* Zone Legend */}
      {isExpanded && (
        <View style={styles.zoneLegend}>
          <Text style={styles.zoneText}>Blacks</Text>
          <Text style={styles.zoneText}>Shadows</Text>
          <Text style={styles.zoneText}>Midtones</Text>
          <Text style={styles.zoneText}>Highlights</Text>
          <Text style={styles.zoneText}>Whites</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(18, 18, 22, 0.82)',
    borderRadius: 8,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backdropFilter: 'blur(8px)' as any,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6
  },
  containerExpanded: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 6
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  title: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8
  },
  clipBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3
  },
  clipText: {
    ...typography.caption,
    color: '#ffffff',
    fontSize: 7,
    fontWeight: '800'
  },
  channelRow: {
    flexDirection: 'row',
    gap: 3
  },
  chBtn: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.06)'
  },
  chBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)'
  },
  chBtnText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '700'
  },
  chBtnTextActive: {
    color: colors.textPrimary
  },
  toggleBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2
  },
  toggleBtnText: {
    color: colors.textMuted,
    fontSize: 9
  },
  graphWrapper: {
    position: 'relative',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 4,
    overflow: 'hidden'
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    opacity: 0.2
  },
  gridCol: {
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: '#ffffff'
  },
  mobileBarsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 2
  },
  mobileBar: {
    width: 2,
    borderRadius: 1
  },
  zoneLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
    paddingHorizontal: 2
  },
  zoneText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 7,
    opacity: 0.7
  }
});
