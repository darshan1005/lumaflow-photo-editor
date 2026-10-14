import React, { useMemo } from 'react';
import {
  Platform,
  StyleSheet,
  View
} from 'react-native';
import { EditDocument } from '../../../types';
import { CompleteImageAnalysis } from '../../../core/image-engine/ImageBinaryExtractor';
import { interpolateCurveLut } from '../models/EditDocument';

interface RealtimeHistogramProps {
  document: EditDocument;
  analysis?: CompleteImageAnalysis | null;
  compact?: boolean;
}

export const RealtimeHistogram: React.FC<RealtimeHistogramProps> = ({
  document: doc,
  analysis,
  compact = false
}) => {
  // Baseline natural distribution
  const baseHistograms = useMemo(() => {
    if (analysis?.histograms) {
      return analysis.histograms;
    }
    const luma = new Uint32Array(256);
    const red = new Uint32Array(256);
    const green = new Uint32Array(256);
    const blue = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      // Natural bell curve centered at mid-tones
      const dist = Math.exp(-Math.pow(i - 120, 2) / (2 * Math.pow(45, 2)));
      const count = Math.round(dist * 1400 + 10);
      luma[i] = count;
      // Slight chromatic shifts to produce realistic color fringes
      red[i] = Math.round(count * (1 + 0.22 * Math.sin((i / 255) * Math.PI - 0.2)));
      green[i] = Math.round(count * (1 + 0.12 * Math.sin((i / 255) * Math.PI)));
      blue[i] = Math.round(count * (1 + 0.28 * Math.cos((i / 255) * Math.PI * 0.8)));
    }
    return { luminance: luma, red, green, blue, totalSampledPixels: 100000 };
  }, [analysis?.histograms]);

  // Compute live real-time transferred histogram
  const liveData = useMemo(() => {
    const b = doc.basic;
    const curves = doc.curves;

    const outRed = new Uint32Array(256);
    const outGreen = new Uint32Array(256);
    const outBlue = new Uint32Array(256);
    const outLuma = new Uint32Array(256);

    const compLut = curves?.composite ? interpolateCurveLut(curves.composite) : null;
    const rLut = curves?.red ? interpolateCurveLut(curves.red) : null;
    const gLut = curves?.green ? interpolateCurveLut(curves.green) : null;
    const bLut = curves?.blue ? interpolateCurveLut(curves.blue) : null;

    const expScale = Math.pow(2, b.exposure);
    const contrast = 1.0 + (b.contrast / 100) * 0.8;
    const tempShift = (b.temperature / 100) * 32;
    const tintShift = (b.tint / 100) * 24;

    const highShift = (b.highlights / 100) * 28;
    const shadowShift = (b.shadows / 100) * 28;
    const whiteShift = (b.whites / 100) * 35;
    const blackShift = (b.blacks / 100) * 35;

    for (let bin = 0; bin < 256; bin++) {
      const norm = bin / 255.0;

      let v = norm * expScale;
      v = (v - 0.5) * contrast + 0.5;

      if (norm > 0.65) v += (whiteShift / 255.0) * Math.pow((norm - 0.65) / 0.35, 1.6);
      if (norm < 0.35) v += (blackShift / 255.0) * Math.pow((0.35 - norm) / 0.35, 1.6);
      if (norm > 0.45 && norm < 0.95) v += (highShift / 255.0) * Math.sin(((norm - 0.45) / 0.50) * Math.PI);
      if (norm > 0.05 && norm < 0.55) v += (shadowShift / 255.0) * Math.sin(((norm - 0.05) / 0.50) * Math.PI);

      let vLuma = Math.max(0, Math.min(1, v));
      let binLuma = Math.round(vLuma * 255);
      if (compLut) {
        binLuma = compLut[binLuma];
      }

      let binR = Math.max(0, Math.min(255, Math.round(binLuma + tempShift * 0.7 + tintShift * 0.3)));
      let binG = Math.max(0, Math.min(255, Math.round(binLuma - tintShift * 0.6)));
      let binB = Math.max(0, Math.min(255, Math.round(binLuma - tempShift * 0.7 + tintShift * 0.3)));

      if (rLut) binR = rLut[binR];
      if (gLut) binG = gLut[binG];
      if (bLut) binB = bLut[binB];

      outRed[binR] += baseHistograms.red[bin];
      outGreen[binG] += baseHistograms.green[bin];
      outBlue[binB] += baseHistograms.blue[bin];
      outLuma[binLuma] += baseHistograms.luminance[bin];
    }

    let peak = 1;
    for (let i = 0; i < 256; i++) {
      if (outRed[i] > peak) peak = outRed[i];
      if (outGreen[i] > peak) peak = outGreen[i];
      if (outBlue[i] > peak) peak = outBlue[i];
      if (outLuma[i] > peak) peak = outLuma[i];
    }

    return {
      red: outRed,
      green: outGreen,
      blue: outBlue,
      luma: outLuma,
      peak
    };
  }, [doc.basic, doc.curves, baseHistograms]);

  const graphWidth = compact ? 150 : 180;
  const graphHeight = compact ? 56 : 64;
  const numSteps = 48;

  // Build color-wise sliced paths (Grey core + Yellow, Cyan, Magenta, Red, Green, Blue fringes)
  const paths = useMemo(() => {
    const stepSize = 256 / numSteps;

    const rPts: Array<{ x: number; y: number; val: number }> = [];
    const gPts: Array<{ x: number; y: number; val: number }> = [];
    const bPts: Array<{ x: number; y: number; val: number }> = [];
    const greyPts: Array<{ x: number; y: number }> = [];

    for (let i = 0; i < numSteps; i++) {
      const start = Math.floor(i * stepSize);
      const end = Math.min(255, Math.floor((i + 1) * stepSize));
      let sumR = 0, sumG = 0, sumB = 0;
      for (let b = start; b <= end; b++) {
        sumR += liveData.red[b];
        sumG += liveData.green[b];
        sumB += liveData.blue[b];
      }
      const count = end - start + 1;
      const avgR = sumR / count;
      const avgG = sumG / count;
      const avgB = sumB / count;
      const minAll = Math.min(avgR, avgG, avgB);

      const x = (i / (numSteps - 1)) * graphWidth;

      // Logarithmic scaling for natural photographic visual profile
      const normR = Math.min(1.0, Math.log10(1 + (avgR / liveData.peak) * 9));
      const normG = Math.min(1.0, Math.log10(1 + (avgG / liveData.peak) * 9));
      const normB = Math.min(1.0, Math.log10(1 + (avgB / liveData.peak) * 9));
      const normGrey = Math.min(1.0, Math.log10(1 + (minAll / liveData.peak) * 9));

      const yR = graphHeight - normR * (graphHeight - 4) - 2;
      const yG = graphHeight - normG * (graphHeight - 4) - 2;
      const yB = graphHeight - normB * (graphHeight - 4) - 2;
      const yGrey = graphHeight - normGrey * (graphHeight - 4) - 2;

      rPts.push({ x, y: yR, val: avgR });
      gPts.push({ x, y: yG, val: avgG });
      bPts.push({ x, y: yB, val: avgB });
      greyPts.push({ x, y: yGrey });
    }

    const toD = (pts: Array<{ x: number; y: number }>) =>
      pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const toFillD = (pts: Array<{ x: number; y: number }>) =>
      `${toD(pts)} L ${graphWidth} ${graphHeight} L 0 ${graphHeight} Z`;

    return {
      rStroke: toD(rPts),
      rFill: toFillD(rPts),
      gStroke: toD(gPts),
      gFill: toFillD(gPts),
      bStroke: toD(bPts),
      bFill: toFillD(bPts),
      greyFill: toFillD(greyPts)
    };
  }, [liveData, graphWidth, graphHeight]);

  return (
    <View style={styles.container}>
      {/* Pure Histogram Graph Box */}
      <View style={[styles.graphBox, { width: graphWidth, height: graphHeight }]}>
        {/* Subtle Vertical Tonal Zone Lines (Shadows, Mids, Highlights) */}
        <View style={styles.zoneGrid}>
          <View style={[styles.zoneLine, { left: '25%' }]} />
          <View style={[styles.zoneLine, { left: '50%' }]} />
          <View style={[styles.zoneLine, { left: '75%' }]} />
        </View>

        {/* Color-wise Additive SVG Histogram */}
        {Platform.OS === 'web' ? (
          React.createElement(
            'svg',
            {
              width: graphWidth,
              height: graphHeight,
              style: { position: 'absolute', top: 0, left: 0 }
            },
            // Group with additive screen blending for true Red + Green = Yellow, Green + Blue = Cyan
            React.createElement(
              'g',
              { style: { mixBlendMode: 'screen' } },
              React.createElement('path', {
                d: paths.rFill,
                fill: 'rgb(230, 35, 35)',
                opacity: 0.85
              }),
              React.createElement('path', {
                d: paths.gFill,
                fill: 'rgb(35, 205, 75)',
                opacity: 0.85
              }),
              React.createElement('path', {
                d: paths.bFill,
                fill: 'rgb(40, 110, 245)',
                opacity: 0.85
              })
            ),
            // Solid Grey overlapping core
            React.createElement('path', {
              d: paths.greyFill,
              fill: 'rgb(188, 192, 198)',
              opacity: 0.95
            }),
            // Subtle boundary strokes
            React.createElement('path', {
              d: paths.rStroke,
              fill: 'none',
              stroke: '#ef4444',
              strokeWidth: '1.0',
              opacity: 0.9
            }),
            React.createElement('path', {
              d: paths.gStroke,
              fill: 'none',
              stroke: '#22c55e',
              strokeWidth: '1.0',
              opacity: 0.9
            }),
            React.createElement('path', {
              d: paths.bStroke,
              fill: 'none',
              stroke: '#3b82f6',
              strokeWidth: '1.0',
              opacity: 0.9
            })
          )
        ) : (
          // Native Mobile Fallback: Color-blended vertical bars
          <View style={[styles.mobileBarsRow, { width: graphWidth, height: graphHeight }]}>
            {Array.from({ length: 48 }).map((_, idx) => {
              const bin = Math.min(255, idx * 5);
              const r = liveData.red[bin];
              const g = liveData.green[bin];
              const b = liveData.blue[bin];
              const maxVal = Math.max(r, g, b);
              const h = Math.min(graphHeight - 4, Math.max(2, (maxVal / liveData.peak) * (graphHeight - 4)));

              let barColor = '#c0c0c0';
              if (r > g * 1.3 && r > b * 1.3) barColor = '#ef4444';
              else if (g > r * 1.3 && g > b * 1.3) barColor = '#22c55e';
              else if (b > r * 1.3 && b > g * 1.3) barColor = '#3b82f6';
              else if (r > b * 1.2 && g > b * 1.2) barColor = '#eab308';
              else if (g > r * 1.2 && b > r * 1.2) barColor = '#06b6d4';
              else if (r > g * 1.2 && b > g * 1.2) barColor = '#ec4899';

              return (
                <View
                  key={`m_bar_${idx}`}
                  style={[
                    styles.mobileBar,
                    { height: h, backgroundColor: barColor }
                  ]}
                />
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(26, 26, 30, 0.92)',
    borderRadius: 6,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8
  },
  graphBox: {
    backgroundColor: '#151518',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    position: 'relative'
  },
  zoneGrid: {
    ...(StyleSheet.absoluteFill as any),
    pointerEvents: 'none'
  },
  zoneLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)'
  },
  mobileBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 1
  },
  mobileBar: {
    width: 2.2,
    borderRadius: 1
  }
});
