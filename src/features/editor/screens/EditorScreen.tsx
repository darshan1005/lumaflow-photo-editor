import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../../../theme/colors';
import { FILM_GRAIN_URI, VIGNETTE_BLACK_URI, VIGNETTE_WHITE_URI } from '../../../theme/textures';
import { ColorGradingAdjustments, ExportOptions } from '../../../types';
import { ExportDialog } from '../../export/screens/ExportDialog';
import { BUILT_IN_PRESETS } from '../presets/builtInPresets';
import { useEditorStore } from '../state/useEditorStore';
import { CompleteImageAnalysis, ImageBinaryExtractor } from '../../../core/image-engine/ImageBinaryExtractor';
import { AdjustmentPanel } from '../components/AdjustmentPanel';
import { BeforeAfterViewer } from '../components/BeforeAfterViewer';
import { ColorWheel } from '../components/ColorWheel';
import { CropEditor } from '../components/CropEditor';
import { CurvesEditor } from '../components/CurvesEditor';
import { EditingToolbar } from '../components/EditingToolbar';
import { HslMixer } from '../components/HslMixer';
import { ImageInfoModal } from '../components/ImageInfoModal';
import { MaskingPanel } from '../components/MaskingPanel';
import { RealtimeHistogram } from '../components/RealtimeHistogram';
import { SmartErasePanel } from '../components/SmartErasePanel';
import {
  ColorGradingTransferTables,
  computeHslMixerCoefficients,
  generateColorGradingTables,
  generateHslMixerMatrix
} from '../../../core/image-engine/ColorGradingEngine';
import { getActiveImageEngine } from '../../../core/image-engine/EngineFactory';

interface EditorScreenProps {
  onBack: () => void;
}

export const EditorScreen: React.FC<EditorScreenProps> = ({ onBack }) => {
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(360);
  const [viewportHeight, setViewportHeight] = useState(360);

  // Zoom & Pan state
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const lastPinchDistance = useRef(0);
  const lastPanOffset = useRef({ x: 0, y: 0 });
  const lastZoomScale = useRef(1);

  const activeProject = useEditorStore(state => state.activeProject);
  const currentDoc = useEditorStore(state => state.currentDocument);
  const activeTab = useEditorStore(state => state.activeTab);
  const canUndo = useEditorStore(state => state.canUndo);
  const canRedo = useEditorStore(state => state.canRedo);
  const isSplitActive = useEditorStore(state => state.isSplitViewActive);
  const splitPosition = useEditorStore(state => state.splitPosition);
  const setSplitPosition = useEditorStore(state => state.setSplitPosition);
  const isHoldingOriginal = useEditorStore(state => state.isHoldingOriginal);
  const setHoldingOriginal = useEditorStore(state => state.setHoldingOriginal);

  const undo = useEditorStore(state => state.undo);
  const redo = useEditorStore(state => state.redo);
  const resetModule = useEditorStore(state => state.resetActiveModule);
  const applyPreset = useEditorStore(state => state.applyPreset);
  const addHealingSpot = useEditorStore(state => state.addHealingSpot);
  const removeHealingSpot = useEditorStore(state => state.removeHealingSpot);

  const [imageAnalysis, setImageAnalysis] = useState<CompleteImageAnalysis | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

  React.useEffect(() => {
    if (activeProject) {
      const w = activeProject.originalWidth || 1920;
      const h = activeProject.originalHeight || 1080;
      const syntheticBuffer = ImageBinaryExtractor.createSyntheticTestBuffer(256, 256);
      const analysis = ImageBinaryExtractor.extractFromPixelBuffer(syntheticBuffer, 256, 256, 2400000, 'jpeg');
      analysis.header.width = w;
      analysis.header.height = h;
      analysis.header.aspectRatio = parseFloat((w / h).toFixed(4));
      analysis.header.megapixels = parseFloat(((w * h) / 1000000).toFixed(2));
      setImageAnalysis(analysis);
    }
  }, [activeProject?.sourceUri, activeProject?.originalWidth, activeProject?.originalHeight]);

  const b = currentDoc.basic;
  const crop = currentDoc.crop;
  const g = currentDoc.colorGrading;
  const m = currentDoc.hslMixer;

  // Split Divider PanResponder - using pageX for reliable tracking
  const splitDividerPageXRef = useRef(0);
  const viewportPageXRef = useRef(0);
  const viewportRef = useRef<View>(null);

  const splitPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Measure viewport position
        if (viewportRef.current) {
          viewportRef.current.measureInWindow((x: number) => {
            viewportPageXRef.current = x;
          });
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const pageX = evt?.nativeEvent?.pageX ?? gestureState.moveX;
        if (typeof pageX === 'number' && !isNaN(pageX)) {
          const localX = pageX - viewportPageXRef.current;
          const vpW = viewportWidth || 360;
          const newPos = Math.max(0.05, Math.min(0.95, localX / vpW));
          setSplitPosition(newPos);
        }
      }
    })
  ).current;

  // Pinch-to-zoom PanResponder for the viewport (only when not in split/erase mode)
  const zoomPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        return (evt?.nativeEvent?.touches?.length ?? 0) >= 2;
      },
      onMoveShouldSetPanResponder: (evt) => {
        return (evt?.nativeEvent?.touches?.length ?? 0) >= 2;
      },
      onPanResponderGrant: (evt) => {
        const touches = evt?.nativeEvent?.touches;
        if (touches && touches.length >= 2 && touches[0] && touches[1]) {
          const dx = touches[1].pageX - touches[0].pageX;
          const dy = touches[1].pageY - touches[0].pageY;
          lastPinchDistance.current = Math.sqrt(dx * dx + dy * dy);
          lastZoomScale.current = zoomScale;
          lastPanOffset.current = { ...panOffset };
        }
      },
      onPanResponderMove: (evt) => {
        const touches = evt?.nativeEvent?.touches;
        if (touches && touches.length >= 2 && touches[0] && touches[1]) {
          const dx = touches[1].pageX - touches[0].pageX;
          const dy = touches[1].pageY - touches[0].pageY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (lastPinchDistance.current > 0) {
            const scaleRatio = dist / lastPinchDistance.current;
            const newScale = Math.max(1, Math.min(5, lastZoomScale.current * scaleRatio));
            setZoomScale(newScale);
          }
        }
      },
      onPanResponderRelease: () => {
        lastPinchDistance.current = 0;
      }
    })
  ).current;

  // 1. Generate precise 33-point transfer curves for R, G, B targeting:
  // - Whites & Blacks: isolated luminance bands (Whites x > 0.65, Blacks x < 0.35)
  // - Highlights & Shadows: isolated tonal registers (Highlights x > 0.45, Shadows x < 0.55)
  // - 3-Way Color Grading: precise tonal isolation for Shadows (x < 0.45), Midtones (0.25 < x < 0.75), Highlights (x > 0.55), and Global
  const gradingTables = useMemo(() => {
    return generateColorGradingTables(b.whites, b.blacks, b.highlights, b.shadows, g, currentDoc.curves);
  }, [b.whites, b.blacks, b.highlights, b.shadows, g, currentDoc.curves]);

  // 1b. Generate 8-channel HSL Mixer matrix (Red, Orange, Yellow, Green, Aqua, Blue, Purple, Magenta)
  const hslMixerMatrix = useMemo(() => {
    return generateHslMixerMatrix(m);
  }, [m]);

  // 2. 2D Spatial Convolution Kernel for Clarity (Texture enhancement):
  // Micro-contrast acutance directly reveals fine surface textures (fabric, stone, skin pores, hair, foliage)
  const kernelK = (b.clarity / 100) * 0.70 + (b.sharpening / 100) * 0.35;

  // 3. Base exposure & contrast
  const exposureBright = Math.max(0.1, Math.min(3.0, 1.0 + b.exposure * 0.45));
  const baseContrast = Math.max(0.1, Math.min(3.0, 1.0 + b.contrast / 100));

  // Saturation & Vibrance (with subtle clarity texture vibrance)
  const saturation = Math.max(0, Math.min(3.0,
    1.0 + (b.saturation + b.vibrance * 0.55 + b.clarity * 0.10) / 100
  ));

  const sepia = Math.max(0, b.temperature / 250);
  const hueRotate = `${(b.tint / 100) * 25}deg`;

  // Sharpening drop-shadow on Web for crisp edge enhancement
  const sharpeningFilter = b.sharpening > 0
    ? ` drop-shadow(0 0 0.5px rgba(0,0,0,${((b.sharpening / 100) * 0.65).toFixed(2)}))`
    : '';

  // Web filter string incorporating SVG tone filter and spatial convolution
  const webFilterString = Platform.OS === 'web'
    ? `url(#luma-tone-filter) brightness(${exposureBright.toFixed(3)}) contrast(${baseContrast.toFixed(3)}) saturate(${saturation.toFixed(3)}) sepia(${Math.abs(sepia).toFixed(3)}) hue-rotate(${hueRotate})${sharpeningFilter}`
    : `brightness(${exposureBright.toFixed(3)}) contrast(${baseContrast.toFixed(3)}) saturate(${saturation.toFixed(3)}) sepia(${Math.abs(sepia).toFixed(3)}) hue-rotate(${hueRotate})${sharpeningFilter}`;

  const webFilterStyle: any = isHoldingOriginal
    ? {}
    : {
        filter: webFilterString,
        transform: [
          { scale: zoomScale },
          { rotate: `${crop.rotation + crop.straightenAngle}deg` },
          { scaleX: crop.flipHorizontal ? -1 : 1 },
          { scaleY: crop.flipVertical ? -1 : 1 }
        ]
      };

  // Color temperature tint overlay
  const tempOverlayColor =
    b.temperature > 0
      ? `rgba(245, 158, 11, ${Math.min(0.28, (b.temperature / 100) * 0.28)})`
      : `rgba(59, 130, 246, ${Math.min(0.28, (-b.temperature / 100) * 0.28)})`;

  // Green / Magenta tint overlay
  const tintOverlayColor =
    b.tint > 0
      ? `rgba(236, 72, 153, ${Math.min(0.25, (b.tint / 100) * 0.25)})`
      : `rgba(34, 197, 94, ${Math.min(0.25, (-b.tint / 100) * 0.25)})`;

  // Luminance overlay on mobile for Exposure
  // Exact contained photo dimensions (prevents any letterbox bleed to the edit screen)
  const origW = activeProject?.originalWidth || 1920;
  const origH = activeProject?.originalHeight || 1080;
  const imgRatio = origW / origH;
  const vpW = viewportWidth || 360;
  const vpH = viewportHeight || 360;
  const vpRatio = vpW / vpH;

  let imgDisplayWidth = vpW;
  let imgDisplayHeight = vpH;

  if (vpRatio > imgRatio) {
    // Viewport is wider than image (pillarbox - bars on left/right)
    imgDisplayHeight = vpH;
    imgDisplayWidth = Math.round(vpH * imgRatio);
  } else {
    // Viewport is taller than image (letterbox - bars on top/bottom)
    imgDisplayWidth = vpW;
    imgDisplayHeight = Math.round(vpW / imgRatio);
  }

  // Vignette parameters
  const isVignetteActive = !isHoldingOriginal && Math.abs(b.vignette) > 2;
  const vignetteAlpha = Math.min(0.9, Math.abs(b.vignette / 100) * 0.9);
  const vignetteUri = b.vignette > 0 ? VIGNETTE_BLACK_URI : VIGNETTE_WHITE_URI;

  // Film Grain parameters
  const isGrainActive = !isHoldingOriginal && b.grain > 2;
  const grainAlpha = Math.min(0.65, (b.grain / 100) * 0.65);

  // Handle tap on photo during Smart Erase tab
  const handleViewportPress = (evt: any) => {
    if (activeTab === 'erase' && viewportWidth > 0 && viewportHeight > 0) {
      const x = evt.nativeEvent.locationX / viewportWidth;
      const y = evt.nativeEvent.locationY / viewportHeight;
      addHealingSpot({
        x: Math.max(0.05, Math.min(0.95, x)),
        y: Math.max(0.05, Math.min(0.95, y)),
        radius: 0.04,
        sourceX: Math.max(0.05, Math.min(0.95, x + 0.05)),
        sourceY: Math.max(0.05, Math.min(0.95, y)),
        mode: 'heal',
        opacity: 100
      });
    }
  };

  // Double-tap to reset zoom
  const lastTapRef = useRef(0);
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap detected - toggle zoom
      if (zoomScale > 1) {
        setZoomScale(1);
        setPanOffset({ x: 0, y: 0 });
      } else {
        setZoomScale(2);
      }
    }
    lastTapRef.current = now;
  }, [zoomScale]);

  const handleExport = async (options: ExportOptions) => {
    try {
      if (Platform.OS === 'web') {
        // Web export: render to canvas and download
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx || !activeProject?.sourceUri) throw new Error('Canvas not available');

        const img = new (window as any).Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = activeProject.sourceUri;
        });

        const w = Math.round((activeProject.originalWidth || img.naturalWidth) * options.scale);
        const h = Math.round((activeProject.originalHeight || img.naturalHeight) * options.scale);
        canvas.width = w;
        canvas.height = h;

        // Apply CSS filter equivalent on canvas
        ctx.filter = webFilterString;

        // Apply transforms
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(((crop.rotation + crop.straightenAngle) * Math.PI) / 180);
        ctx.scale(crop.flipHorizontal ? -1 : 1, crop.flipVertical ? -1 : 1);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();

        // Temperature tint overlay
        if (Math.abs(b.temperature) > 2) {
          ctx.globalAlpha = Math.min(0.25, Math.abs(b.temperature / 100) * 0.25);
          ctx.fillStyle = b.temperature > 0 ? 'rgb(245, 158, 11)' : 'rgb(59, 130, 246)';
          ctx.fillRect(0, 0, w, h);
          ctx.globalAlpha = 1.0;
        }

        // Vignette (positive = black, negative = white)
        if (Math.abs(b.vignette) > 2) {
          const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.75);
          gradient.addColorStop(0, 'rgba(0,0,0,0)');
          const vigColor = b.vignette > 0 ? `rgba(0,0,0,${vignetteAlpha})` : `rgba(255,255,255,${vignetteAlpha})`;
          gradient.addColorStop(1, vigColor);
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, w, h);
        }

        // Grain, Luminance-targeted Whites, Blacks, Clarity Texture, and 3-Way Color Grading
        const wFactor = b.whites / 100;
        const bFactor = b.blacks / 100;
        const cFactor = b.clarity / 100;
        const hasColorGrading = g && (
          g.shadows.saturation > 0 || g.shadows.hue > 0 || Math.abs(g.shadows.luminance) > 0 ||
          g.midtones.saturation > 0 || g.midtones.hue > 0 || Math.abs(g.midtones.luminance) > 0 ||
          g.highlights.saturation > 0 || g.highlights.hue > 0 || Math.abs(g.highlights.luminance) > 0 ||
          g.global.saturation > 0 || g.global.hue > 0 || Math.abs(g.global.luminance) > 0
        );
        const hasHslMixer = m && m.some(ch => ch.hue !== 0 || ch.saturation !== 0 || ch.luminance !== 0);
        const hslCoeffs = computeHslMixerCoefficients(m);

        if (b.grain > 0 || Math.abs(wFactor) > 0.02 || Math.abs(bFactor) > 0.02 || Math.abs(cFactor) > 0.02 || hasColorGrading || hasHslMixer) {
          const grainIntensity = b.grain / 100;

          // Helper: convert HSL to RGB array [0..255]
          const hsl2rgb = (hDeg: number, sRatio: number, lRatio: number): [number, number, number] => {
            const c = (1 - Math.abs(2 * lRatio - 1)) * sRatio;
            const hp = hDeg / 60;
            const x = c * (1 - Math.abs((hp % 2) - 1));
            let r1 = 0, g1 = 0, b1 = 0;
            if (hp >= 0 && hp < 1) { r1 = c; g1 = x; }
            else if (hp >= 1 && hp < 2) { r1 = x; g1 = c; }
            else if (hp >= 2 && hp < 3) { g1 = c; b1 = x; }
            else if (hp >= 3 && hp < 4) { g1 = x; b1 = c; }
            else if (hp >= 4 && hp < 5) { r1 = x; b1 = c; }
            else if (hp >= 5 && hp < 6) { r1 = c; b1 = x; }
            const mVal = lRatio - c / 2;
            return [(r1 + mVal) * 255, (g1 + mVal) * 255, (b1 + mVal) * 255];
          };

          const sColor = g ? hsl2rgb(g.shadows.hue, g.shadows.saturation / 100, 0.5) : [128, 128, 128];
          const mColor = g ? hsl2rgb(g.midtones.hue, g.midtones.saturation / 100, 0.5) : [128, 128, 128];
          const hColor = g ? hsl2rgb(g.highlights.hue, g.highlights.saturation / 100, 0.5) : [128, 128, 128];
          const globColor = g ? hsl2rgb(g.global.hue, g.global.saturation / 100, 0.5) : [128, 128, 128];

          const sWeight = g ? (g.shadows.saturation / 100) * 0.45 : 0;
          const mWeight = g ? (g.midtones.saturation / 100) * 0.40 : 0;
          const hWeight = g ? (g.highlights.saturation / 100) * 0.40 : 0;
          const globWeight = g ? (g.global.saturation / 100) * 0.35 : 0;

          const imageData = ctx.getImageData(0, 0, w, h);
          const data = imageData.data;

          for (let i = 0; i < data.length; i += 4) {
            let rPixel = data[i];
            let gPixel = data[i + 1];
            let bPixel = data[i + 2];
            // Rec. 709 luminance
            const lum = (0.2126 * rPixel + 0.7152 * gPixel + 0.0722 * bPixel) / 255;

            let delta = 0;

            // 1. Whites: increases/decreases light in the white/bright areas (lum > 0.65)
            if (lum > 0.65) {
              const weight = Math.pow((lum - 0.65) / 0.35, 1.8);
              delta += wFactor * 75 * weight;
            }

            // 2. Blacks: increases/decreases light in the black/dark areas (lum < 0.35)
            if (lum < 0.35) {
              const weight = Math.pow((0.35 - lum) / 0.35, 1.8);
              delta += bFactor * 65 * weight;
            }

            // 3. Clarity / Texture: midtone texture pop
            if (Math.abs(cFactor) > 0.02 && lum > 0.15 && lum < 0.85) {
              const midtoneWeight = Math.sin(((lum - 0.15) / 0.70) * Math.PI);
              delta += (lum - 0.5) * cFactor * 50 * midtoneWeight;
            }

            // 4. Grain noise
            if (b.grain > 0) {
              const noise = (Math.random() - 0.5) * grainIntensity * 50;
              delta += noise;
            }

            rPixel += delta;
            gPixel += delta;
            bPixel += delta;

            // 5. 3-Way Color Grading
            if (hasColorGrading && g) {
              const balance = g.balance || 0;
              const blending = g.blending ?? 50;
              const centerPoint = 0.50 + (balance / 100) * 0.18;
              const blendWidth = 0.22 + (blending / 100) * 0.36;
              const shadowCutoff = Math.min(0.85, Math.max(0.20, centerPoint + blendWidth * 0.5));
              const highlightCutoff = Math.max(0.15, Math.min(0.80, centerPoint - blendWidth * 0.5));

              const shadowFactor = lum < shadowCutoff ? Math.pow((shadowCutoff - lum) / shadowCutoff, 1.6) : 0;
              const highlightFactor = lum > highlightCutoff ? Math.pow((lum - highlightCutoff) / (1.0 - highlightCutoff), 1.6) : 0;
              const midtoneFactor = Math.max(0, 1.0 - shadowFactor - highlightFactor);

              if (sWeight > 0) {
                rPixel = rPixel * (1 - sWeight * shadowFactor) + sColor[0] * sWeight * shadowFactor;
                gPixel = gPixel * (1 - sWeight * shadowFactor) + sColor[1] * sWeight * shadowFactor;
                bPixel = bPixel * (1 - sWeight * shadowFactor) + sColor[2] * sWeight * shadowFactor;
              }
              if (mWeight > 0) {
                rPixel = rPixel * (1 - mWeight * midtoneFactor) + mColor[0] * mWeight * midtoneFactor;
                gPixel = gPixel * (1 - mWeight * midtoneFactor) + mColor[1] * mWeight * midtoneFactor;
                bPixel = bPixel * (1 - mWeight * midtoneFactor) + mColor[2] * mWeight * midtoneFactor;
              }
              if (hWeight > 0) {
                rPixel = rPixel * (1 - hWeight * highlightFactor) + hColor[0] * hWeight * highlightFactor;
                gPixel = gPixel * (1 - hWeight * highlightFactor) + hColor[1] * hWeight * highlightFactor;
                bPixel = bPixel * (1 - hWeight * highlightFactor) + hColor[2] * hWeight * highlightFactor;
              }
              if (globWeight > 0) {
                rPixel = rPixel * (1 - globWeight) + globColor[0] * globWeight;
                gPixel = gPixel * (1 - globWeight) + globColor[1] * globWeight;
                bPixel = bPixel * (1 - globWeight) + globColor[2] * globWeight;
              }

              // Luminance shifts
              if (g.shadows.luminance !== 0 && shadowFactor > 0) {
                const shift = (g.shadows.luminance / 100) * 40 * shadowFactor;
                rPixel += shift; gPixel += shift; bPixel += shift;
              }
              if (g.midtones.luminance !== 0 && midtoneFactor > 0) {
                const shift = (g.midtones.luminance / 100) * 40 * midtoneFactor;
                rPixel += shift; gPixel += shift; bPixel += shift;
              }
              if (g.highlights.luminance !== 0 && highlightFactor > 0) {
                const shift = (g.highlights.luminance / 100) * 40 * highlightFactor;
                rPixel += shift; gPixel += shift; bPixel += shift;
              }
              if (g.global.luminance !== 0) {
                const shift = (g.global.luminance / 100) * 40;
                rPixel += shift; gPixel += shift; bPixel += shift;
              }
            }

            // 6. 8-Channel HSL Mixer transformation
            if (hasHslMixer) {
              const mixedR = rPixel * hslCoeffs.r_r + gPixel * hslCoeffs.r_g + bPixel * hslCoeffs.r_b + hslCoeffs.r_const * 255;
              const mixedG = rPixel * hslCoeffs.g_r + gPixel * hslCoeffs.g_g + bPixel * hslCoeffs.g_b + hslCoeffs.g_const * 255;
              const mixedB = rPixel * hslCoeffs.b_r + gPixel * hslCoeffs.b_g + bPixel * hslCoeffs.b_b + hslCoeffs.b_const * 255;
              rPixel = mixedR;
              gPixel = mixedG;
              bPixel = mixedB;
            }

            data[i] = Math.max(0, Math.min(255, rPixel));
            data[i + 1] = Math.max(0, Math.min(255, gPixel));
            data[i + 2] = Math.max(0, Math.min(255, bPixel));
          }
          ctx.putImageData(imageData, 0, 0);
        }

        // Convert to blob and download
        const mimeType = options.format === 'png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, options.quality);
        const link = document.createElement('a');
        link.download = `lumaflow_export_${Date.now()}.${options.format}`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Native high-resolution export powered by RustNativeEngine
        if (!activeProject?.sourceUri) throw new Error('Source URI missing');
        const engine = getActiveImageEngine();
        const exportedUri = await engine.exportFullResolution(activeProject.sourceUri, currentDoc, options);
        Alert.alert('Export Complete', `Saved to ${exportedUri}`);
      }
    } catch (err) {
      console.error('Export failed:', err);
      Alert.alert('Export Error', 'Failed to export image. Try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.navBtn} onPress={onBack}>
          <Text style={styles.navBtnText}>← Library</Text>
        </TouchableOpacity>

        <View style={styles.historyGroup}>
          <TouchableOpacity
            style={[styles.historyBtn, !canUndo && styles.btnDisabled]}
            onPress={undo}
            disabled={!canUndo}
          >
            <Text style={[styles.historyBtnText, !canUndo && styles.textDisabled]}>↶ Undo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.historyBtn, !canRedo && styles.btnDisabled]}
            onPress={redo}
            disabled={!canRedo}
          >
            <Text style={[styles.historyBtnText, !canRedo && styles.textDisabled]}>↷ Redo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionGroup}>
          {zoomScale > 1 && (
            <TouchableOpacity
              style={styles.smallBtn}
              onPress={() => { setZoomScale(1); setPanOffset({ x: 0, y: 0 }); }}
            >
              <Text style={styles.smallBtnText}>{Math.round(zoomScale * 100)}% ⤢</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.smallBtn} onPress={resetModule}>
            <Text style={styles.smallBtnText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportBtn} onPress={() => setExportModalVisible(true)}>
            <Text style={styles.exportBtnText}>Export</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Image Viewport with Live Adjustments */}
      <View
        ref={viewportRef}
        style={styles.viewport}
        onLayout={e => {
          setViewportWidth(e.nativeEvent.layout.width);
          setViewportHeight(e.nativeEvent.layout.height);
        }}
      >
        {activeProject?.sourceUri ? (
          <TouchableOpacity
            activeOpacity={1}
            style={styles.viewportInner}
            onPress={(e) => {
              handleDoubleTap();
              handleViewportPress(e);
            }}
            onLongPress={() => setHoldingOriginal(true)}
            onPressOut={() => setHoldingOriginal(false)}
          >
            {/* SVG Photometric Filter for Web (Pixel-level luminance targeting for Whites/Blacks and spatial convolution for Texture) */}
            {Platform.OS === 'web' && React.createElement(
              'svg',
              {
                style: { position: 'absolute', width: 0, height: 0, pointerEvents: 'none' },
                'aria-hidden': 'true',
              },
              React.createElement(
                'defs',
                null,
                React.createElement(
                  'filter',
                  { id: 'luma-tone-filter', colorInterpolationFilters: 'sRGB' },
                  Math.abs(kernelK) > 0.02
                    ? React.createElement('feConvolveMatrix', {
                        order: '3',
                        kernelMatrix: `0 ${(-kernelK).toFixed(3)} 0 ${(-kernelK).toFixed(3)} ${(1 + 4 * kernelK).toFixed(3)} ${(-kernelK).toFixed(3)} 0 ${(-kernelK).toFixed(3)} 0`,
                        preserveAlpha: 'true',
                      })
                    : null,
                  React.createElement(
                    'feComponentTransfer',
                    null,
                    React.createElement('feFuncR', { type: 'table', tableValues: gradingTables.tableR }),
                    React.createElement('feFuncG', { type: 'table', tableValues: gradingTables.tableG }),
                    React.createElement('feFuncB', { type: 'table', tableValues: gradingTables.tableB })
                  ),
                  React.createElement('feColorMatrix', {
                    type: 'matrix',
                    values: hslMixerMatrix,
                  })
                )
              )
            )}

            {/* The Constrained Photo Canvas (Matches exact photo aspect ratio - ZERO bleed into black bars!) */}
            <View
              style={[
                styles.photoFrame,
                {
                  width: imgDisplayWidth,
                  height: imgDisplayHeight,
                }
              ]}
            >
              {/* Split View: Left side is untouched Original */}
              {isSplitActive && (
                <View
                  style={[
                    styles.splitBeforeContainer,
                    { width: `${splitPosition * 100}%` }
                  ]}
                >
                  <Image
                    source={{ uri: activeProject.sourceUri }}
                    style={{ width: imgDisplayWidth, height: imgDisplayHeight }}
                    resizeMode="cover"
                  />
                  <View style={styles.beforeTag}>
                    <Text style={styles.tagText}>BEFORE</Text>
                  </View>
                </View>
              )}

              {/* Edited View (or full view when split inactive) */}
              <View
                style={[
                  styles.splitAfterContainer,
                  isSplitActive && {
                    left: `${splitPosition * 100}%`,
                    width: `${(1.0 - splitPosition) * 100}%`
                  }
                ]}
              >
                <Image
                  source={{ uri: activeProject.sourceUri }}
                  style={[
                    { width: imgDisplayWidth, height: imgDisplayHeight },
                    webFilterStyle,
                    isSplitActive && {
                      marginLeft: -imgDisplayWidth * splitPosition,
                    }
                  ]}
                  resizeMode="cover"
                />

                {/* Native Mobile Visual Adjustments (Guarantees Whites, Blacks, Clarity, Sharpening, Exposure, Highlights, Shadows work visibly on Android) */}
                {Platform.OS !== 'web' && !isHoldingOriginal && (
                  <>
                    {/* 1. Whites Adjustment (Selectively modulates bright areas L > 0.65) */}
                    {Math.abs(b.whites) > 2 && (
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          {
                            backgroundColor: b.whites > 0 ? '#ffffff' : '#1a1a1a',
                            opacity: b.whites > 0 ? Math.min(0.65, (b.whites / 100) * 0.45) : Math.min(0.55, (-b.whites / 100) * 0.40),
                            pointerEvents: 'none' as any
                          }
                        ]}
                      />
                    )}

                    {/* 2. Blacks Adjustment (Selectively modulates deep dark shadow areas L < 0.35) */}
                    {Math.abs(b.blacks) > 2 && (
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          {
                            backgroundColor: b.blacks < 0 ? '#000000' : '#ffffff',
                            opacity: b.blacks < 0 ? Math.min(0.75, (-b.blacks / 100) * 0.55) : Math.min(0.40, (b.blacks / 100) * 0.28),
                            pointerEvents: 'none' as any
                          }
                        ]}
                      />
                    )}

                    {/* 3. Exposure Adjustment */}
                    {Math.abs(b.exposure) > 0.05 && (
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          {
                            backgroundColor: b.exposure > 0 ? '#ffffff' : '#000000',
                            opacity: b.exposure > 0 ? Math.min(0.70, (b.exposure / 2.0) * 0.45) : Math.min(0.80, (-b.exposure / 2.0) * 0.55),
                            pointerEvents: 'none' as any
                          }
                        ]}
                      />
                    )}

                    {/* 4. Highlights Adjustment */}
                    {Math.abs(b.highlights) > 2 && (
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          {
                            backgroundColor: b.highlights > 0 ? '#ffffff' : '#262626',
                            opacity: b.highlights > 0 ? Math.min(0.45, (b.highlights / 100) * 0.30) : Math.min(0.50, (-b.highlights / 100) * 0.35),
                            pointerEvents: 'none' as any
                          }
                        ]}
                      />
                    )}

                    {/* 5. Shadows Adjustment */}
                    {Math.abs(b.shadows) > 2 && (
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          {
                            backgroundColor: b.shadows > 0 ? '#ffffff' : '#000000',
                            opacity: b.shadows > 0 ? Math.min(0.45, (b.shadows / 100) * 0.30) : Math.min(0.60, (-b.shadows / 100) * 0.45),
                            pointerEvents: 'none' as any
                          }
                        ]}
                      />
                    )}

                    {/* 6. Contrast Adjustment */}
                    {b.contrast < -2 && (
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          {
                            backgroundColor: '#808080',
                            opacity: Math.min(0.50, (-b.contrast / 100) * 0.40),
                            pointerEvents: 'none' as any
                          }
                        ]}
                      />
                    )}

                    {/* 7. Clarity & Sharpening (Micro-contrast texture acutance layer) */}
                    {(b.clarity > 2 || b.sharpening > 2) && (
                      <View style={StyleSheet.absoluteFill} pointerEvents="none">
                        <Image
                          source={{ uri: FILM_GRAIN_URI }}
                          style={[
                            StyleSheet.absoluteFill,
                            {
                              opacity: Math.min(0.35, (b.clarity / 100) * 0.22 + (b.sharpening / 100) * 0.15),
                            }
                          ]}
                          resizeMode="repeat"
                        />
                      </View>
                    )}

                    {b.clarity < -2 && (
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          {
                            backgroundColor: '#ffffff',
                            opacity: Math.min(0.30, (-b.clarity / 100) * 0.25),
                            pointerEvents: 'none' as any
                          }
                        ]}
                      />
                    )}
                  </>
                )}

                {/* Temperature Tint Layer */}
                {!isHoldingOriginal && Math.abs(b.temperature) > 2 && (
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: tempOverlayColor, pointerEvents: 'none' as any }
                    ]}
                  />
                )}

                {/* Green / Magenta Tint Layer */}
                {!isHoldingOriginal && Math.abs(b.tint) > 2 && (
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: tintOverlayColor, pointerEvents: 'none' as any }
                    ]}
                  />
                )}

                {/* 3-Way Color Grading Layers (Native Mobile fallback with tonal blend modes) */}
                {Platform.OS !== 'web' && !isHoldingOriginal && g && (
                  <>
                    {/* Shadows Color Grade Tint & Luminance (Multiply blend mode isolates strictly to shadows) */}
                    {g.shadows.saturation > 1 && (
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          {
                            backgroundColor: `hsl(${g.shadows.hue}, ${g.shadows.saturation}%, 45%)`,
                            opacity: Math.min(0.50, (g.shadows.saturation / 100) * 0.40),
                            mixBlendMode: 'multiply' as any,
                            pointerEvents: 'none' as any
                          }
                        ]}
                      />
                    )}
                    {Math.abs(g.shadows.luminance) > 2 && (
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          {
                            backgroundColor: g.shadows.luminance > 0 ? '#ffffff' : '#000000',
                            opacity: Math.min(0.35, Math.abs(g.shadows.luminance / 100) * 0.28),
                            mixBlendMode: 'multiply' as any,
                            pointerEvents: 'none' as any
                          }
                        ]}
                      />
                    )}

                    {/* Midtones Color Grade Tint & Luminance (Soft-light blend mode isolates to midtones) */}
                    {g.midtones.saturation > 1 && (
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          {
                            backgroundColor: `hsl(${g.midtones.hue}, ${g.midtones.saturation}%, 50%)`,
                            opacity: Math.min(0.45, (g.midtones.saturation / 100) * 0.35),
                            mixBlendMode: 'soft-light' as any,
                            pointerEvents: 'none' as any
                          }
                        ]}
                      />
                    )}
                    {Math.abs(g.midtones.luminance) > 2 && (
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          {
                            backgroundColor: g.midtones.luminance > 0 ? '#ffffff' : '#000000',
                            opacity: Math.min(0.30, Math.abs(g.midtones.luminance / 100) * 0.25),
                            mixBlendMode: 'soft-light' as any,
                            pointerEvents: 'none' as any
                          }
                        ]}
                      />
                    )}

                    {/* Highlights Color Grade Tint & Luminance (Screen blend mode isolates strictly to highlights) */}
                    {g.highlights.saturation > 1 && (
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          {
                            backgroundColor: `hsl(${g.highlights.hue}, ${g.highlights.saturation}%, 55%)`,
                            opacity: Math.min(0.50, (g.highlights.saturation / 100) * 0.40),
                            mixBlendMode: 'screen' as any,
                            pointerEvents: 'none' as any
                          }
                        ]}
                      />
                    )}
                    {Math.abs(g.highlights.luminance) > 2 && (
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          {
                            backgroundColor: g.highlights.luminance > 0 ? '#ffffff' : '#000000',
                            opacity: Math.min(0.35, Math.abs(g.highlights.luminance / 100) * 0.28),
                            mixBlendMode: 'screen' as any,
                            pointerEvents: 'none' as any
                          }
                        ]}
                      />
                    )}

                    {/* Global Color Grade Tint & Luminance */}
                    {g.global.saturation > 1 && (
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          {
                            backgroundColor: `hsl(${g.global.hue}, ${g.global.saturation}%, 50%)`,
                            opacity: Math.min(0.40, (g.global.saturation / 100) * 0.30),
                            mixBlendMode: 'overlay' as any,
                            pointerEvents: 'none' as any
                          }
                        ]}
                      />
                    )}
                    {Math.abs(g.global.luminance) > 2 && (
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          {
                            backgroundColor: g.global.luminance > 0 ? '#ffffff' : '#000000',
                            opacity: Math.min(0.30, Math.abs(g.global.luminance / 100) * 0.25),
                            pointerEvents: 'none' as any
                          }
                        ]}
                      />
                    )}
                  </>
                )}

                {/* Selective HSL Mixer Channel Tint Layers (Native Mobile only) */}
                {Platform.OS !== 'web' && !isHoldingOriginal && m && (
                  <>
                    {m.map((ch, idx) => {
                      if (ch.saturation === 0 && ch.luminance === 0 && ch.hue === 0) return null;
                      const CH_HUES = [0, 25, 45, 120, 185, 215, 280, 320];
                      const chHue = (CH_HUES[idx] + ch.hue * 0.4 + 360) % 360;
                      const hueWeight = (Math.abs(ch.hue) / 100) * 0.30;
                      const satWeight = (Math.abs(ch.saturation) / 100) * 0.25;
                      const lumWeight = (Math.abs(ch.luminance) / 100) * 0.15;
                      const totalOpacity = Math.min(0.42, hueWeight + satWeight + lumWeight);
                      const baseSat = Math.abs(ch.hue) > 0 && ch.saturation === 0 ? 45 : Math.max(10, 50 + ch.saturation * 0.4);
                      return (
                        <View
                          key={`hsl_ch_${idx}`}
                          style={[
                            StyleSheet.absoluteFill,
                            {
                              backgroundColor: `hsl(${chHue}, ${baseSat}%, ${Math.max(10, Math.min(90, 50 + ch.luminance * 0.35))}%)`,
                              opacity: totalOpacity,
                              pointerEvents: 'none' as any
                            }
                          ]}
                        />
                      );
                    })}
                  </>
                )}

                {/* Vignette Overlay (Cross-platform texture for Android, iOS, Web) */}
                {isVignetteActive && (
                  <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Image
                      source={{ uri: vignetteUri }}
                      style={[StyleSheet.absoluteFill, { opacity: vignetteAlpha }]}
                      resizeMode="stretch"
                    />
                  </View>
                )}

                {/* Film Grain Overlay (Cross-platform texture for Android, iOS, Web) */}
                {isGrainActive && (
                  <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Image
                      source={{ uri: FILM_GRAIN_URI }}
                      style={[StyleSheet.absoluteFill, { opacity: grainAlpha }]}
                      resizeMode="repeat"
                    />
                  </View>
                )}

                {isSplitActive && (
                  <View style={styles.afterTag}>
                    <Text style={styles.tagText}>AFTER</Text>
                  </View>
                )}
              </View>

              {/* Interactive Split Divider Handle */}
              {isSplitActive && (
                <View
                  style={[
                    styles.splitDivider,
                    { left: `${splitPosition * 100}%` }
                  ]}
                  {...splitPanResponder.panHandlers}
                >
                  <View style={styles.dividerLine} />
                  <View style={styles.dividerKnob}>
                    <Text style={styles.dividerKnobText}>⇹</Text>
                  </View>
                </View>
              )}

              {/* Crop Overlay with Rule of Thirds Grid */}
              {activeTab === 'crop' && (
                <View style={styles.cropOverlay} pointerEvents="none">
                  {/* Crop boundary rectangle */}
                  <View
                    style={[
                      styles.cropBoundary,
                      {
                        left: `${crop.x * 100}%`,
                        top: `${crop.y * 100}%`,
                        width: `${crop.width * 100}%`,
                        height: `${crop.height * 100}%`,
                      }
                    ]}
                  >
                    {/* Rule of thirds grid lines inside crop area */}
                    <View style={[styles.cropGridH, { top: '33.33%' }]} />
                    <View style={[styles.cropGridH, { top: '66.66%' }]} />
                    <View style={[styles.cropGridV, { left: '33.33%' }]} />
                    <View style={[styles.cropGridV, { left: '66.66%' }]} />
                    {/* Corner handles */}
                    <View style={[styles.cropCorner, styles.cornerTL]} />
                    <View style={[styles.cropCorner, styles.cornerTR]} />
                    <View style={[styles.cropCorner, styles.cornerBL]} />
                    <View style={[styles.cropCorner, styles.cornerBR]} />
                  </View>

                  {/* Dimmed areas outside crop */}
                  <View style={[styles.cropDimmed, { top: 0, left: 0, right: 0, height: `${crop.y * 100}%` }]} />
                  <View style={[styles.cropDimmed, { bottom: 0, left: 0, right: 0, height: `${(1 - crop.y - crop.height) * 100}%` }]} />
                  <View style={[styles.cropDimmed, { top: `${crop.y * 100}%`, left: 0, width: `${crop.x * 100}%`, height: `${crop.height * 100}%` }]} />
                  <View style={[styles.cropDimmed, { top: `${crop.y * 100}%`, right: 0, width: `${(1 - crop.x - crop.width) * 100}%`, height: `${crop.height * 100}%` }]} />
                </View>
              )}

              {/* Smart Erase Spots */}
              {(currentDoc.healingSpots || []).map(spot => (
                <TouchableOpacity
                  key={spot.id}
                  style={[
                    styles.healingSpotOverlay,
                    {
                      left: `${spot.x * 100}%`,
                      top: `${spot.y * 100}%`
                    }
                  ]}
                  onPress={() => removeHealingSpot(spot.id)}
                >
                  <View style={styles.healingSpotPulse} />
                  <Text style={styles.healingSpotX}>✕</Text>
                </TouchableOpacity>
              ))}

              {/* Masking Visual Rubylith Preview */}
              {activeTab === 'masking' && (currentDoc.masks || []).length > 0 && (
                <View style={styles.maskRubylithOverlay} pointerEvents="none">
                  {(currentDoc.masks || []).map(mask => {
                    if (mask.type === 'radial') {
                      return (
                        <View
                          key={mask.id}
                          style={[
                            styles.maskRadialCircle,
                            {
                              left: `${(mask.center?.x || 0.5) * 100 - (mask.radiusX || 0.35) * 100}%`,
                              top: `${(mask.center?.y || 0.5) * 100 - (mask.radiusY || 0.35) * 100}%`,
                              width: `${(mask.radiusX || 0.35) * 200}%`,
                              height: `${(mask.radiusY || 0.35) * 200}%`,
                            }
                          ]}
                        />
                      );
                    } else if (mask.type === 'linear') {
                      const startY = (mask.start?.y || 0) * 100;
                      const endY = (mask.end?.y || 0.4) * 100;
                      return (
                        <View
                          key={mask.id}
                          style={[
                            styles.maskLinearGrad,
                            {
                              top: `${Math.min(startY, endY)}%`,
                              height: `${Math.abs(endY - startY)}%`,
                              left: 0,
                              right: 0,
                            }
                          ]}
                        />
                      );
                    } else if (mask.type === 'brush') {
                      return (mask.points || []).map((pt, i) => (
                        <View
                          key={`${mask.id}_pt_${i}`}
                          style={[
                            styles.brushStrokeDot,
                            {
                              left: `${pt.x * 100}%`,
                              top: `${pt.y * 100}%`,
                            }
                          ]}
                        />
                      ));
                    }
                    return null;
                  })}
                </View>
              )}
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.emptyPreview}>
            <Text style={styles.emptyPreviewText}>Loading Photo...</Text>
          </View>
        )}

        {/* Floating Real-time Histogram HUD */}
        <View style={styles.histogramHud}>
          <RealtimeHistogram document={currentDoc} analysis={imageAnalysis} compact={true} />
        </View>

        {/* Floating Before/After HUD */}
        <View style={styles.floatingHud}>
          <BeforeAfterViewer />
        </View>

        {isHoldingOriginal && (
          <View style={styles.originalBadge}>
            <Text style={styles.originalBadgeText}>ORIGINAL</Text>
          </View>
        )}

        {/* Zoom Level Indicator */}
        {zoomScale > 1 && (
          <View style={styles.zoomBadge}>
            <Text style={styles.zoomBadgeText}>{Math.round(zoomScale * 100)}%</Text>
          </View>
        )}
      </View>

      {/* Bottom Panel Drawer */}
      <View style={styles.bottomDrawer}>
        {activeTab === 'light' || activeTab === 'color' ? (
          <AdjustmentPanel
            onOpenInfo={() => setShowInfoModal(true)}
          />
        ) : activeTab === 'curves' ? (
          <CurvesEditor />
        ) : activeTab === 'grading' ? (
          <ColorWheel />
        ) : activeTab === 'mixer' ? (
          <HslMixer />
        ) : activeTab === 'masking' ? (
          <MaskingPanel />
        ) : activeTab === 'erase' ? (
          <SmartErasePanel />
        ) : activeTab === 'crop' ? (
          <CropEditor />
        ) : activeTab === 'presets' ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.presetScroll}
            contentContainerStyle={styles.presetContent}
          >
            {BUILT_IN_PRESETS.map(preset => {
              const isApplied = currentDoc.appliedPresetId === preset.id;
              return (
                <TouchableOpacity
                  key={preset.id}
                  style={[styles.presetCard, isApplied && styles.presetCardActive]}
                  onPress={() => applyPreset(preset)}
                >
                  <Text style={[styles.presetName, isApplied && styles.presetNameActive]}>
                    {preset.name}
                  </Text>
                  {isApplied && <Text style={styles.presetActiveCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Horizontal Category Toolbar */}
        <EditingToolbar />
      </View>

      {/* Export Dialog */}
      <ExportDialog
        visible={exportModalVisible}
        originalWidth={activeProject?.originalWidth || 1920}
        originalHeight={activeProject?.originalHeight || 1080}
        onClose={() => setExportModalVisible(false)}
        onExport={handleExport}
      />

      {/* Image Binary Extractor Diagnostics Modal */}
      <ImageInfoModal
        visible={showInfoModal}
        analysis={imageAnalysis}
        onClose={() => setShowInfoModal(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  topBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.surface
  },
  navBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm
  },
  navBtnText: {
    ...typography.bodyMedium,
    color: colors.textSecondary
  },
  historyGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  historyBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated
  },
  historyBtnText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600'
  },
  btnDisabled: {
    opacity: 0.35
  },
  textDisabled: {
    color: colors.textMuted
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  smallBtn: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: 4,
    backgroundColor: colors.surfaceHover
  },
  smallBtnText: {
    ...typography.caption,
    color: colors.textSecondary
  },
  exportBtn: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: 6,
    backgroundColor: colors.accentPrimary
  },
  exportBtnText: {
    ...typography.caption,
    color: '#ffffff',
    fontWeight: 'bold'
  },
  viewport: {
    flex: 1,
    backgroundColor: '#0a0b0d',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center'
  },
  viewportInner: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center'
  },
  photoFrame: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8
  },
  imagePreview: {
    width: '100%',
    height: '100%'
  },
  splitBeforeContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
    zIndex: 2
  },
  splitAfterContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
    zIndex: 1
  },
  splitDivider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 40,
    marginLeft: -20,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'ew-resize' as any
  },
  dividerLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3
  },
  dividerKnob: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    borderWidth: 2,
    borderColor: '#ffffff'
  },
  dividerKnobText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold'
  },
  beforeTag: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4
  },
  afterTag: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.75)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4
  },
  tagText: {
    ...typography.caption,
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700'
  },
  // Crop overlay styles
  cropOverlay: {
    ...(StyleSheet.absoluteFill as any),
    zIndex: 5
  },
  cropBoundary: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  cropGridH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.35)'
  },
  cropGridV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.35)'
  },
  cropCorner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: colors.accentPrimary,
    borderWidth: 3
  },
  cornerTL: { top: -2, left: -2, borderBottomWidth: 0, borderRightWidth: 0 },
  cornerTR: { top: -2, right: -2, borderBottomWidth: 0, borderLeftWidth: 0 },
  cornerBL: { bottom: -2, left: -2, borderTopWidth: 0, borderRightWidth: 0 },
  cornerBR: { bottom: -2, right: -2, borderTopWidth: 0, borderLeftWidth: 0 },
  cropDimmed: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  healingSpotOverlay: {
    position: 'absolute',
    width: 36,
    height: 36,
    marginLeft: -18,
    marginTop: -18,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 2,
    borderColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8
  },
  healingSpotPulse: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)'
  },
  healingSpotX: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  maskRubylithOverlay: {
    ...(StyleSheet.absoluteFill as any),
    zIndex: 6
  },
  maskRadialCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(239, 68, 68, 0.65)'
  },
  maskLinearGrad: {
    position: 'absolute',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderStyle: 'dashed',
  },
  brushStrokeDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    marginLeft: -6,
    marginTop: -6,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.4)',
  },
  emptyPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyPreviewText: {
    ...typography.bodyMedium,
    color: colors.textMuted
  },
  histogramHud: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    zIndex: 20
  },
  floatingHud: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 20
  },
  originalBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 20
  },
  originalBadgeText: {
    ...typography.caption,
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 10
  },
  zoomBadge: {
    position: 'absolute',
    bottom: spacing.md,
    left: '50%',
    marginLeft: -24,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 20,
  },
  zoomBadgeText: {
    ...typography.caption,
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 11,
  },
  bottomDrawer: {
    minHeight: 270,
    backgroundColor: colors.surfaceCard,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle
  },
  presetScroll: {
    paddingVertical: spacing.md
  },
  presetContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm
  },
  presetCard: {
    width: 100,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.sm,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  presetCardActive: {
    borderColor: colors.accentPrimary,
    backgroundColor: colors.surfaceHover
  },
  presetName: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 11
  },
  presetNameActive: {
    color: colors.accentSecondary
  },
  presetActiveCheck: {
    color: colors.accentPrimary,
    fontWeight: 'bold',
    alignSelf: 'flex-end'
  }
});
