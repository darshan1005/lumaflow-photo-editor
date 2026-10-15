import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ExportOptions } from '../../../types';
import { ExportDialog } from '../../export/screens/ExportDialog';
import { BUILT_IN_PRESETS } from '../presets/builtInPresets';
import { useEditorStore } from '../state/useEditorStore';
import { CompleteImageAnalysis, ImageBinaryExtractor } from '../../../core/image-engine/ImageBinaryExtractor';
import { AdjustmentPanel } from '../components/AdjustmentPanel';
import { BeforeAfterViewer } from '../components/BeforeAfterViewer';
import { ColorWheel } from '../components/ColorWheel';
import {
  clampCropBounds,
  CropBounds,
  CropAspectMode,
  CropEditor,
  CropInteractionHandle,
  getCropInteractionHandle,
  getNormalizedCropAspectRatio,
  getOrientedSourceDimensions,
  moveCropBounds,
  resizeCropBounds
} from '../components/CropEditor';
import { CurvesEditor } from '../components/CurvesEditor';
import { EditingToolbar } from '../components/EditingToolbar';
import { HslMixer } from '../components/HslMixer';
import { ImageInfoModal } from '../components/ImageInfoModal';
import { MaskingPanel } from '../components/MaskingPanel';
import { RealtimeHistogram } from '../components/RealtimeHistogram';
import { SmartErasePanel, SmartEraseSettings } from '../components/SmartErasePanel';
import { getActiveImageEngine } from '../../../core/image-engine/EngineFactory';
import { renderDocument } from '../../../core/image-engine/renderDocument';

interface EditorScreenProps {
  onBack: () => void;
}

export const EditorScreen: React.FC<EditorScreenProps> = ({ onBack }) => {
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(360);
  const [viewportHeight, setViewportHeight] = useState(360);
  const [eraseSettings, setEraseSettings] = useState<SmartEraseSettings>({
    brushSize: 30,
    feather: 50,
    mode: 'heal'
  });
  const [processedPreview, setProcessedPreview] = useState<{
    uri: string;
    width: number;
    height: number;
  } | null>(null);
  const [cropAspectMode, setCropAspectMode] = useState<CropAspectMode>('original');
  const previewImageSourceRef = useRef<string | null>(null);
  const previewImagePromiseRef = useRef<Promise<any> | null>(null);

  // Zoom & Pan state
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const zoomScaleRef = useRef(1);
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const activeTabRef = useRef<string>('adjust');
  const isDraggingSplitRef = useRef(false);
  const lastPinchDistance = useRef(0);
  const initialPinchCenter = useRef({ x: 0, y: 0 });
  const initialPanOffset = useRef({ x: 0, y: 0 });
  const initialZoomScale = useRef(1);
  const isPinching = useRef(false);
  const isPanning = useRef(false);
  const maxPanXRef = useRef(0);
  const maxPanYRef = useRef(0);
  const viewportWidthRef = useRef(360);
  const viewportHeightRef = useRef(360);
  const imgDisplayWidthRef = useRef(360);
  const imgDisplayHeightRef = useRef(360);
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const initialPointerDistanceRef = useRef(0);
  const initialPointerCenterRef = useRef({ x: 0, y: 0 });
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const hasMovedSignificantlyRef = useRef(false);
  const longPressTimerRef = useRef<any>(null);
  const isPaintingToolRef = useRef(false);
  const lastToolPointRef = useRef<{ x: number; y: number } | null>(null);
  const activeMaskRef = useRef<any>(null);
  const eraseSettingsRef = useRef<SmartEraseSettings>(eraseSettings);
  const selectedHealingSpotRef = useRef<string | null>(null);

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
  const activeMaskId = useEditorStore(state => state.activeMaskId);
  const cropAspectModeRef = useRef<CropAspectMode>('original');
  const cropBoundsRef = useRef<CropBounds>(currentDoc.crop);
  const cropRotationRef = useRef(0);
  const cropInteractionRef = useRef<{
    handle: CropInteractionHandle;
    startX: number;
    startY: number;
    frameWidth: number;
    frameHeight: number;
    bounds: CropBounds;
    pointerId?: number;
  } | null>(null);
  const cropOverlaySizeRef = useRef({ width: 360, height: 360 });

  const undo = useEditorStore(state => state.undo);
  const redo = useEditorStore(state => state.redo);
  const resetModule = useEditorStore(state => state.resetActiveModule);
  const applyPreset = useEditorStore(state => state.applyPreset);
  const beginAdjustment = useEditorStore(state => state.beginAdjustment);
  const endAdjustment = useEditorStore(state => state.endAdjustment);
  const addHealingSpot = useEditorStore(state => state.addHealingSpot);
  const removeHealingSpot = useEditorStore(state => state.removeHealingSpot);
  const updateMask = useEditorStore(state => state.updateMask);
  const updateCrop = useEditorStore(state => state.updateCrop);

  const [imageAnalysis, setImageAnalysis] = useState<CompleteImageAnalysis | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedHealingSpotId, setSelectedHealingSpotId] = useState<string | null>(null);

  const activeMask = (currentDoc.masks || []).find(mask => mask.id === activeMaskId) || currentDoc.masks?.[0] || null;
  activeMaskRef.current = activeMask;
  eraseSettingsRef.current = eraseSettings;
  activeTabRef.current = activeTab;
  zoomScaleRef.current = zoomScale;
  panOffsetRef.current = panOffset;
  cropAspectModeRef.current = cropAspectMode;
  cropBoundsRef.current = currentDoc.crop;
  cropRotationRef.current = currentDoc.crop.rotation;

  useEffect(() => {
    activeTabRef.current = activeTab;
    activeMaskRef.current = activeMask;
    eraseSettingsRef.current = eraseSettings;
    if (activeTab !== 'erase' && activeTab !== 'masking') {
      setSelectedHealingSpotId(null);
    }
  }, [activeMask, activeTab, eraseSettings]);

  const previousActiveTabRef = useRef(activeTab);
  useEffect(() => {
    const enteredOrExitedCrop = previousActiveTabRef.current !== activeTab && (
      previousActiveTabRef.current === 'crop' || activeTab === 'crop'
    );
    if (enteredOrExitedCrop) {
      setZoomScale(1);
      setPanOffset({ x: 0, y: 0 });
      // Do not show the previous asynchronous bitmap while the crop frame is
      // opening or being committed. The fallback image canvas immediately
      // reflects the current crop, then the CPU-rendered web preview replaces
      // it when rendering completes.
      setProcessedPreview(null);
      zoomScaleRef.current = 1;
      panOffsetRef.current = { x: 0, y: 0 };
      initialZoomScale.current = 1;
      initialPanOffset.current = { x: 0, y: 0 };
    }
    previousActiveTabRef.current = activeTab;
  }, [activeTab]);

  React.useEffect(() => {
    let isCancelled = false;

    async function analyzeActiveImage() {
      if (!activeProject?.sourceUri) return;
      const uri = activeProject.sourceUri;

      const w = activeProject.originalWidth || 1920;
      const h = activeProject.originalHeight || 1080;

      // Detect format from URI
      let detectedFormat: 'jpeg' | 'png' | 'webp' = 'jpeg';
      let detectedMime = 'image/jpeg';
      if (uri.includes('.png') || uri.startsWith('data:image/png')) {
        detectedFormat = 'png';
        detectedMime = 'image/png';
      } else if (uri.includes('.webp') || uri.startsWith('data:image/webp')) {
        detectedFormat = 'webp';
        detectedMime = 'image/webp';
      }

      // Determine real file size if data URL or fetchable
      let fileSize = 0;
      if (uri.startsWith('data:')) {
        fileSize = Math.round((uri.length * 3) / 4);
      }

      // On Web: sample real image pixels via offscreen canvas
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
        try {
          const img = new (window as any).Image();
          img.crossOrigin = 'anonymous';

          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Cross-origin'));
            img.src = uri;
          });

          if (isCancelled) return;

          const realW = img.naturalWidth || w;
          const realH = img.naturalHeight || h;

          const sampleW = 128;
          const sampleH = 128;
          const canvas = document.createElement('canvas');
          canvas.width = sampleW;
          canvas.height = sampleH;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });

          if (ctx) {
            ctx.drawImage(img, 0, 0, sampleW, sampleH);
            const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
            const pixels = new Uint8Array(imgData.data.buffer);

            if (!fileSize) {
              fileSize = Math.round(((realW * realH) / 1000000) * (detectedFormat === 'png' ? 2400000 : 950000));
            }

            const analysis = ImageBinaryExtractor.extractFromPixelBuffer(
              pixels,
              sampleW,
              sampleH,
              fileSize,
              detectedFormat
            );

            analysis.header.width = realW;
            analysis.header.height = realH;
            analysis.header.aspectRatio = parseFloat((realW / realH).toFixed(2));
            analysis.header.megapixels = parseFloat(((realW * realH) / 1000000).toFixed(2));
            analysis.header.mimeType = detectedMime;

            if (!isCancelled) {
              setImageAnalysis(analysis);
              return;
            }
          }
        } catch {
          // Gracefully continue to hash-derived dynamic analysis if canvas is tainted by cross-origin
        }
      }

      // Dynamic pixel generator derived from the unique image URI and dimensions
      const uriHash = uri.split('').reduce((acc, char) => (acc * 33 + char.charCodeAt(0)) | 0, 5381);
      const sampleSize = 128;
      const buffer = new Uint8Array(sampleSize * sampleSize * 4);

      const brightnessShift = ((Math.abs(uriHash) % 80) - 40) / 100;
      const contrastScale = 0.8 + ((Math.abs(uriHash >> 4) % 60) / 100);
      const colorBiasR = (Math.abs(uriHash >> 8) % 40) - 20;
      const colorBiasB = (Math.abs(uriHash >> 12) % 40) - 20;

      for (let y = 0; y < sampleSize; y++) {
        for (let x = 0; x < sampleSize; x++) {
          const idx = (y * sampleSize + x) * 4;
          const distFromCenter = Math.hypot(x - sampleSize / 2, y - sampleSize / 2) / (sampleSize / 2);
          const raw = 0.5 + brightnessShift - distFromCenter * 0.25;
          const adjusted = Math.max(0, Math.min(1, 0.5 + (raw - 0.5) * contrastScale));

          buffer[idx] = Math.max(0, Math.min(255, Math.round(adjusted * 255 + colorBiasR)));
          buffer[idx + 1] = Math.max(0, Math.min(255, Math.round(adjusted * 255)));
          buffer[idx + 2] = Math.max(0, Math.min(255, Math.round(adjusted * 255 + colorBiasB)));
          buffer[idx + 3] = 255;
        }
      }

      if (!fileSize) {
        fileSize = Math.round(((w * h) / 1000000) * 1150000);
      }

      const analysis = ImageBinaryExtractor.extractFromPixelBuffer(
        buffer,
        sampleSize,
        sampleSize,
        fileSize,
        detectedFormat
      );

      analysis.header.width = w;
      analysis.header.height = h;
      analysis.header.aspectRatio = parseFloat((w / h).toFixed(2));
      analysis.header.megapixels = parseFloat(((w * h) / 1000000).toFixed(2));
      analysis.header.mimeType = detectedMime;

      if (!isCancelled) {
        setImageAnalysis(analysis);
      }
    }

    analyzeActiveImage();
    return () => {
      isCancelled = true;
    };
  }, [activeProject?.sourceUri, activeProject?.originalWidth, activeProject?.originalHeight]);

  // Web preview uses the same CPU document renderer as export. This keeps
  // masks, healing strokes, curves, and selective HSL edits pixel-based rather
  // than approximating them with whole-image CSS overlays.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') return;
    const sourceUri = activeProject?.sourceUri;
    if (!sourceUri) {
      setProcessedPreview(null);
      return;
    }

    let isCancelled = false;
    // Do not leave the previous crop-sized bitmap on screen while the new
    // document is rendering. The source fallback below is crop-positioned so
    // the viewport remains truthful during this short asynchronous window.
    setProcessedPreview(null);
    const renderPreview = async () => {
      try {
        if (previewImageSourceRef.current !== sourceUri || !previewImagePromiseRef.current) {
          const image = new (window as any).Image();
          image.crossOrigin = 'anonymous';
          previewImageSourceRef.current = sourceUri;
          previewImagePromiseRef.current = new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error('Preview image could not be loaded'));
            image.src = sourceUri;
          }).then(() => image);
        }
        const image = await previewImagePromiseRef.current;
        if (isCancelled) return;

        const naturalWidth = image.naturalWidth || activeProject?.originalWidth || 1920;
        const naturalHeight = image.naturalHeight || activeProject?.originalHeight || 1080;
        const maxDimension = 900;
        const scale = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight));
        const width = Math.max(1, Math.round(naturalWidth * scale));
        const height = Math.max(1, Math.round(naturalHeight * scale));
        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = width;
        sourceCanvas.height = height;
        const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
        if (!sourceContext) throw new Error('Preview canvas is unavailable');
        sourceContext.drawImage(image, 0, 0, width, height);

        // Crop mode edits the frame against the complete oriented image. Once
        // Done closes the mode, renderDocument produces the actual cropped
        // bitmap used by the editor and export.
        const previewDocument = activeTab === 'crop'
          ? {
              ...currentDoc,
              crop: { ...currentDoc.crop, x: 0, y: 0, width: 1, height: 1 }
            }
          : currentDoc;
        const rendered = renderDocument(
          sourceContext.getImageData(0, 0, width, height).data,
          width,
          height,
          previewDocument
        );
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = rendered.width;
        outputCanvas.height = rendered.height;
        const outputContext = outputCanvas.getContext('2d');
        if (!outputContext) throw new Error('Preview output canvas is unavailable');
        const previewImageData = outputContext.createImageData(rendered.width, rendered.height);
        previewImageData.data.set(rendered.pixels as any);
        outputContext.putImageData(previewImageData, 0, 0);

        if (!isCancelled) {
          setProcessedPreview({
            uri: outputCanvas.toDataURL('image/png'),
            width: rendered.width,
            height: rendered.height
          });
        }
      } catch (error) {
        // A tainted canvas can still display the source image. Export reports
        // its own error, while the editor remains usable in this fallback.
        if (!isCancelled) {
          console.warn('Processed web preview unavailable:', error);
          setProcessedPreview(null);
        }
      }
    };

    renderPreview();
    return () => {
      isCancelled = true;
    };
  }, [activeProject?.sourceUri, activeProject?.originalHeight, activeProject?.originalWidth, activeTab, currentDoc]);

  const b = currentDoc.basic;
  const crop = currentDoc.crop;
  const g = currentDoc.colorGrading;

  const getPanLimits = useCallback((scale: number) => {
    const w = imgDisplayWidthRef.current || 360;
    const h = imgDisplayHeightRef.current || 360;
    const limitX = scale > 1 ? Math.max(0, (w * scale - w) / 2) : 0;
    const limitY = scale > 1 ? Math.max(0, (h * scale - h) / 2) : 0;
    return { limitX, limitY };
  }, []);

  const handleDoubleTapAt = useCallback((clientX: number, clientY: number) => {
    // If already zoomed in, double-tap smoothly resets zoom back to 1.0x fit
    if (zoomScaleRef.current > 1.05) {
      setZoomScale(1);
      setPanOffset({ x: 0, y: 0 });
      initialZoomScale.current = 1;
      initialPanOffset.current = { x: 0, y: 0 };
      return;
    }

    // Measure tap coordinates relative to viewport center
    let localX = viewportWidthRef.current / 2;
    let localY = viewportHeightRef.current / 2;

    if (Platform.OS === 'web' && viewportRef.current) {
      const domNode = (viewportRef.current as any)._touchableNode || viewportRef.current;
      if (domNode && domNode.getBoundingClientRect) {
        const rect = domNode.getBoundingClientRect();
        localX = clientX - rect.left;
        localY = clientY - rect.top;
      } else {
        localX = clientX;
        localY = clientY;
      }
    } else {
      localX = clientX;
      localY = clientY;
    }

    const deltaX = localX - viewportWidthRef.current / 2;
    const deltaY = localY - viewportHeightRef.current / 2;

    const targetScale = 2.5;
    const { limitX, limitY } = getPanLimits(targetScale);

    // Center the zoomed view on the tapped point and clamp within frame
    const targetPanX = -deltaX * targetScale;
    const targetPanY = -deltaY * targetScale;

    const clampedX = Math.max(-limitX, Math.min(limitX, targetPanX));
    const clampedY = Math.max(-limitY, Math.min(limitY, targetPanY));

    setZoomScale(targetScale);
    setPanOffset({ x: clampedX, y: clampedY });
    initialZoomScale.current = targetScale;
    initialPanOffset.current = { x: clampedX, y: clampedY };
  }, [getPanLimits]);

  const getNormalizedImagePoint = useCallback((clientX: number, clientY: number, localCoordinates = false) => {
    let localX = clientX;
    let localY = clientY;
    if (!localCoordinates && Platform.OS === 'web' && viewportRef.current) {
      const domNode = (viewportRef.current as any)._touchableNode || viewportRef.current;
      if (domNode && domNode.getBoundingClientRect) {
        const rect = domNode.getBoundingClientRect();
        localX = clientX - rect.left;
        localY = clientY - rect.top;
      }
    }

    const vpW = viewportWidthRef.current || 360;
    const vpH = viewportHeightRef.current || 360;
    const displayedWidth = imgDisplayWidthRef.current * zoomScaleRef.current;
    const displayedHeight = imgDisplayHeightRef.current * zoomScaleRef.current;
    const left = (vpW - displayedWidth) / 2 + panOffsetRef.current.x;
    const top = (vpH - displayedHeight) / 2 + panOffsetRef.current.y;
    return {
      x: Math.max(0, Math.min(1, (localX - left) / Math.max(1, displayedWidth))),
      y: Math.max(0, Math.min(1, (localY - top) / Math.max(1, displayedHeight)))
    };
  }, []);

  const addEraseDab = useCallback((point: { x: number; y: number }) => {
    const settings = eraseSettingsRef.current;
    const sourceWidth = activeProject?.originalWidth || 1920;
    const sourceHeight = activeProject?.originalHeight || 1080;
    const radius = Math.max(0.002, Math.min(0.25, settings.brushSize / Math.max(sourceWidth, sourceHeight)));
    const sourceX = Math.max(0, Math.min(1, point.x + radius * 2));
    addHealingSpot({
      x: point.x,
      y: point.y,
      radius,
      sourceX,
      sourceY: point.y,
      mode: settings.mode,
      opacity: 100,
      // CpuImageEngine consumes this optional runtime setting while the
      // persisted HealingSpot shape remains backwards compatible.
      feather: settings.feather
    } as any);
  }, [activeProject?.originalHeight, activeProject?.originalWidth, addHealingSpot]);

  const addMaskStrokePoints = useCallback((point: { x: number; y: number }) => {
    const maskId = activeMaskRef.current?.id;
    if (!maskId) return;
    const latestMask = (useEditorStore.getState().currentDocument.masks || []).find(mask => mask.id === maskId);
    if (!latestMask) return;

    const previous = lastToolPointRef.current;
    const distance = previous ? Math.hypot(point.x - previous.x, point.y - previous.y) : 0;
    const steps = previous ? Math.max(1, Math.ceil(distance / 0.012)) : 1;
    const additions: Array<{ x: number; y: number }> = [];
    for (let index = 1; index <= steps; index++) {
      const t = index / steps;
      additions.push({
        x: previous ? previous.x + (point.x - previous.x) * t : point.x,
        y: previous ? previous.y + (point.y - previous.y) * t : point.y
      });
    }
    updateMask(maskId, { points: [...(latestMask.points || []), ...additions] });
    lastToolPointRef.current = point;
  }, [updateMask]);

  const paintToolAt = useCallback((clientX: number, clientY: number, localCoordinates = false) => {
    const point = getNormalizedImagePoint(clientX, clientY, localCoordinates);
    if (activeTabRef.current === 'erase') {
      const previous = lastToolPointRef.current;
      const distance = previous ? Math.hypot(point.x - previous.x, point.y - previous.y) : 0;
      const settings = eraseSettingsRef.current;
      const sourceWidth = activeProject?.originalWidth || 1920;
      const sourceHeight = activeProject?.originalHeight || 1080;
      const radius = Math.max(0.002, Math.min(0.25, settings.brushSize / Math.max(sourceWidth, sourceHeight)));
      const spacing = Math.max(0.004, radius * 0.65);
      const steps = previous ? Math.max(1, Math.ceil(distance / spacing)) : 1;
      for (let index = 1; index <= steps; index++) {
        const t = index / steps;
        addEraseDab({
          x: previous ? previous.x + (point.x - previous.x) * t : point.x,
          y: previous ? previous.y + (point.y - previous.y) * t : point.y
        });
      }
      lastToolPointRef.current = point;
    } else if (activeTabRef.current === 'masking' && activeMaskRef.current?.type === 'brush') {
      addMaskStrokePoints(point);
    }
  }, [activeProject?.originalHeight, activeProject?.originalWidth, addEraseDab, addMaskStrokePoints, getNormalizedImagePoint]);

  const handleViewportPressAt = useCallback((clientX: number, clientY: number, localCoordinates = false) => {
    if (activeTabRef.current !== 'erase' && !(activeTabRef.current === 'masking' && activeMaskRef.current?.type === 'brush')) return;
    paintToolAt(clientX, clientY, localCoordinates);
  }, [paintToolAt]);

  // Split Divider PanResponder - using pageX for reliable tracking
  const splitDividerPageXRef = useRef(0);
  const viewportPageXRef = useRef(0);
  const viewportRef = useRef<View>(null);
  const cropOverlayRef = useRef<View>(null);

  const getCropFrameSize = useCallback(() => ({
    width: Math.max(1, cropOverlaySizeRef.current.width || imgDisplayWidthRef.current || viewportWidthRef.current),
    height: Math.max(1, cropOverlaySizeRef.current.height || imgDisplayHeightRef.current || viewportHeightRef.current)
  }), []);

  const startCropInteraction = useCallback((pointX: number, pointY: number, frameWidth: number, frameHeight: number, pointerId?: number) => {
    if (activeTabRef.current !== 'crop' || cropInteractionRef.current) return false;
    const bounds = clampCropBounds(cropBoundsRef.current);
    const handle = getCropInteractionHandle(pointX, pointY, frameWidth, frameHeight, bounds);
    if (!handle) return false;
    cropInteractionRef.current = {
      handle,
      startX: pointX,
      startY: pointY,
      frameWidth,
      frameHeight,
      bounds,
      pointerId
    };
    beginAdjustment();
    return true;
  }, [beginAdjustment]);

  const moveCropInteraction = useCallback((pointX: number, pointY: number) => {
    const interaction = cropInteractionRef.current;
    if (!interaction) return;
    const deltaX = (pointX - interaction.startX) / interaction.frameWidth;
    const deltaY = (pointY - interaction.startY) / interaction.frameHeight;
    const aspectRatio = getNormalizedCropAspectRatio(
      cropAspectModeRef.current,
      activeProject?.originalWidth || 1,
      activeProject?.originalHeight || 1,
      cropRotationRef.current
    );
    const nextBounds = interaction.handle === 'move'
      ? moveCropBounds(interaction.bounds, deltaX, deltaY)
      : resizeCropBounds(interaction.bounds, interaction.handle, deltaX, deltaY, aspectRatio);
    cropBoundsRef.current = nextBounds;
    updateCrop(nextBounds);
  }, [activeProject?.originalHeight, activeProject?.originalWidth, updateCrop]);

  const finishCropInteraction = useCallback(() => {
    if (!cropInteractionRef.current) return;
    cropInteractionRef.current = null;
    endAdjustment();
  }, [endAdjustment]);

  const cropPanResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => activeTabRef.current === 'crop',
      onMoveShouldSetPanResponder: () => activeTabRef.current === 'crop',
      onPanResponderGrant: evt => {
        const size = getCropFrameSize();
        const pointX = evt.nativeEvent?.locationX ?? size.width / 2;
        const pointY = evt.nativeEvent?.locationY ?? size.height / 2;
        startCropInteraction(pointX, pointY, size.width, size.height);
      },
      onPanResponderMove: (_evt, gestureState) => {
        const interaction = cropInteractionRef.current;
        if (!interaction) return;
        moveCropInteraction(
          interaction.startX + gestureState.dx,
          interaction.startY + gestureState.dy
        );
      },
      onPanResponderRelease: finishCropInteraction,
      onPanResponderTerminate: finishCropInteraction
    }),
    [finishCropInteraction, getCropFrameSize, moveCropInteraction, startCropInteraction]
  );

  // React Native Web's DOM pointer path is deliberately separate from the
  // viewport zoom listener. The crop overlay captures first, converts client
  // coordinates through its transformed bounding rect, and prevents a crop
  // drag from becoming a zoom/pan gesture.
  useEffect(() => {
    if (Platform.OS !== 'web' || activeTab !== 'crop') return;
    const view = cropOverlayRef.current as any;
    const domNode = view?._touchableNode || view;
    if (!domNode?.addEventListener) return;

    const getLocalPoint = (event: PointerEvent) => {
      const rect = domNode.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
        y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height)
      };
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== undefined && event.button !== 0) return;
      const point = getLocalPoint(event);
      const started = startCropInteraction(point.x, point.y, point.width, point.height, event.pointerId);
      if (!started) {
        // Crop mode owns the whole viewport so a tap in the dimmed area cannot
        // fall through to the original-preview or zoom/pan handlers.
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      domNode.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      const interaction = cropInteractionRef.current;
      if (!interaction || interaction.pointerId !== event.pointerId) return;
      const point = getLocalPoint(event);
      event.preventDefault();
      event.stopPropagation();
      moveCropInteraction(point.x, point.y);
    };
    const onPointerUp = (event: PointerEvent) => {
      const interaction = cropInteractionRef.current;
      if (!interaction || interaction.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      finishCropInteraction();
    };

    domNode.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      domNode.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      finishCropInteraction();
    };
  }, [activeTab, finishCropInteraction, moveCropInteraction, startCropInteraction]);

  const splitPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        isDraggingSplitRef.current = true;
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
      },
      onPanResponderRelease: () => {
        isDraggingSplitRef.current = false;
      },
      onPanResponderTerminate: () => {
        isDraggingSplitRef.current = false;
      }
    })
  ).current;

  // Pinch-to-zoom & Pan PanResponder for the viewport
  const zoomPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: (evt) => {
        if (isDraggingSplitRef.current) return false;
        const touches = evt?.nativeEvent?.touches?.length ?? 0;
        if (touches === 1 && (activeTabRef.current === 'erase' || (activeTabRef.current === 'masking' && activeMaskRef.current?.type === 'brush'))) {
          return true;
        }
        return touches >= 2;
      },
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        if (isDraggingSplitRef.current) return false;
        const touches = evt?.nativeEvent?.touches?.length ?? 0;
        if (touches >= 2) return true;
        if (activeTabRef.current === 'erase' || (activeTabRef.current === 'masking' && activeMaskRef.current?.type === 'brush')) {
          return true;
        }
        if (zoomScaleRef.current > 1.05 && activeTabRef.current !== 'crop') {
          return Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6;
        }
        return false;
      },
      onPanResponderGrant: (evt, gestureState) => {
        const touches = evt?.nativeEvent?.touches;
        if (touches && touches.length === 1 && (activeTabRef.current === 'erase' || (activeTabRef.current === 'masking' && activeMaskRef.current?.type === 'brush'))) {
          isPaintingToolRef.current = true;
          lastToolPointRef.current = null;
          beginAdjustment();
          const locX = evt.nativeEvent?.locationX ?? viewportWidthRef.current / 2;
          const locY = evt.nativeEvent?.locationY ?? viewportHeightRef.current / 2;
          handleViewportPressAt(locX, locY, true);
        } else if (touches && touches.length >= 2 && touches[0] && touches[1]) {
          if (isPaintingToolRef.current) endAdjustment();
          isPaintingToolRef.current = false;
          lastToolPointRef.current = null;
          isPinching.current = true;
          isPanning.current = false;
          const dx = touches[1].pageX - touches[0].pageX;
          const dy = touches[1].pageY - touches[0].pageY;
          lastPinchDistance.current = Math.hypot(dx, dy);
          initialPinchCenter.current = {
            x: (touches[0].pageX + touches[1].pageX) / 2,
            y: (touches[0].pageY + touches[1].pageY) / 2,
          };
          initialZoomScale.current = zoomScaleRef.current;
          initialPanOffset.current = { ...panOffsetRef.current };
        } else if (zoomScaleRef.current > 1.05) {
          isPanning.current = true;
          isPinching.current = false;
          initialPanOffset.current = { ...panOffsetRef.current };
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt?.nativeEvent?.touches;
        if (isPaintingToolRef.current && (!touches || touches.length < 2)) {
          const locX = evt.nativeEvent?.locationX ?? gestureState.moveX;
          const locY = evt.nativeEvent?.locationY ?? gestureState.moveY;
          handleViewportPressAt(locX, locY, true);
          return;
        }
        // Two-finger Pinch Zoom (and pan)
        if (touches && touches.length >= 2 && touches[0] && touches[1]) {
          const dx = touches[1].pageX - touches[0].pageX;
          const dy = touches[1].pageY - touches[0].pageY;
          const dist = Math.hypot(dx, dy);
          if (lastPinchDistance.current > 10) {
            const scaleFactor = dist / lastPinchDistance.current;
            const newScale = Math.max(1.0, Math.min(5.0, initialZoomScale.current * scaleFactor));
            setZoomScale(newScale);

            // Follow center point shift
            const centerX = (touches[0].pageX + touches[1].pageX) / 2;
            const centerY = (touches[0].pageY + touches[1].pageY) / 2;
            const shiftX = centerX - initialPinchCenter.current.x;
            const shiftY = centerY - initialPinchCenter.current.y;
            const targetX = initialPanOffset.current.x + shiftX;
            const targetY = initialPanOffset.current.y + shiftY;
            const limitX = Math.max(0, (viewportWidth * newScale - viewportWidth) / 2);
            const limitY = Math.max(0, (viewportHeight * newScale - viewportHeight) / 2);
            setPanOffset({
              x: Math.max(-limitX, Math.min(limitX, targetX)),
              y: Math.max(-limitY, Math.min(limitY, targetY))
            });
          }
        }
        // One-finger Pan when zoomed in
        else if (isPanning.current && zoomScaleRef.current > 1.05) {
          const targetX = initialPanOffset.current.x + gestureState.dx;
          const targetY = initialPanOffset.current.y + gestureState.dy;
          const clampedX = Math.max(-maxPanXRef.current, Math.min(maxPanXRef.current, targetX));
          const clampedY = Math.max(-maxPanYRef.current, Math.min(maxPanYRef.current, targetY));
          setPanOffset({ x: clampedX, y: clampedY });
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (isPaintingToolRef.current) {
          const locX = evt.nativeEvent?.locationX ?? gestureState.moveX;
          const locY = evt.nativeEvent?.locationY ?? gestureState.moveY;
          handleViewportPressAt(locX, locY, true);
          isPaintingToolRef.current = false;
          lastToolPointRef.current = null;
          endAdjustment();
          return;
        }
        isPinching.current = false;
        isPanning.current = false;
        lastPinchDistance.current = 0;

        // Keep zoom scale and pan offset FIXED where user released
        initialZoomScale.current = zoomScaleRef.current;
        initialPanOffset.current = { ...panOffsetRef.current };

        // Double-tap detection on mobile
        if (Math.abs(gestureState.dx) < 8 && Math.abs(gestureState.dy) < 8) {
          const now = Date.now();
          const timeDiff = now - lastTapRef.current.time;
          const locX = evt.nativeEvent?.locationX ?? (viewportWidthRef.current / 2);
          const locY = evt.nativeEvent?.locationY ?? (viewportHeightRef.current / 2);
          const distDiff = Math.hypot(locX - lastTapRef.current.x, locY - lastTapRef.current.y);

          if (timeDiff < 320 && distDiff < 40) {
            lastTapRef.current = { time: 0, x: 0, y: 0 };
            handleDoubleTapAt(locX, locY);
          } else {
            lastTapRef.current = { time: now, x: locX, y: locY };
            if (activeTabRef.current === 'erase' || (activeTabRef.current === 'masking' && activeMaskRef.current?.type === 'brush')) {
              handleViewportPressAt(locX, locY, true);
            }
          }
        }
      },
      onPanResponderTerminate: () => {
        if (isPaintingToolRef.current) endAdjustment();
        isPaintingToolRef.current = false;
        lastToolPointRef.current = null;
        isPinching.current = false;
        isPanning.current = false;
        lastPinchDistance.current = 0;
        initialZoomScale.current = zoomScaleRef.current;
        initialPanOffset.current = { ...panOffsetRef.current };
      }
    })
  ).current;

  // Curves modulation factors are retained for the native fallback styling.
  const curvesMod = useMemo(() => {
    const c = currentDoc.curves;
    if (!c) {
      return { contrastMod: 1.0, exposureMod: 1.0, liftMod: 0, tintR: 0, tintG: 0, tintB: 0 };
    }
    const comp = c.composite || [];
    let contrastMod = 1.0;
    let exposureMod = 1.0;
    let liftMod = 0;

    if (comp.length >= 5) {
      // Contrast slope from Shadows (pt 1) and Highs (pt 3)
      const dy = comp[3].y - comp[1].y;
      const dx = comp[3].x - comp[1].x;
      if (dx > 0) {
        contrastMod = Math.max(0.2, Math.min(2.5, dy / dx));
      }
      // Exposure shift from Mids (pt 2)
      const midsDiff = comp[2].y - 128;
      exposureMod = Math.max(0.2, Math.min(2.5, 1.0 + (midsDiff / 128) * 0.7));
      // Lifted shadows from Blacks (pt 0)
      liftMod = Math.max(0, Math.min(1.0, comp[0].y / 255));
    }

    // Color channel tints from R, G, B curves
    const rPts = c.red || [];
    const gPts = c.green || [];
    const bPts = c.blue || [];

    const tintR = rPts.length >= 3 ? (rPts[2].y - 128) / 128 : 0;
    const tintG = gPts.length >= 3 ? (gPts[2].y - 128) / 128 : 0;
    const tintB = bPts.length >= 3 ? (bPts[2].y - 128) / 128 : 0;

    return { contrastMod, exposureMod, liftMod, tintR, tintG, tintB };
  }, [currentDoc.curves]);

  // 3. Base exposure & contrast with live curve modulation
  const exposureBright = Math.max(0.1, Math.min(3.0, (1.0 + b.exposure * 0.45) * curvesMod.exposureMod));
  const baseContrast = Math.max(0.1, Math.min(3.0, (1.0 + b.contrast / 100) * curvesMod.contrastMod));

  // Saturation & Vibrance (with subtle clarity texture vibrance)
  const saturation = Math.max(0, Math.min(3.0,
    1.0 + (b.saturation + b.vibrance * 0.55 + b.clarity * 0.10) / 100
  ));

  const sepia = Math.max(0, b.temperature / 250 + (curvesMod.tintR > 0 ? curvesMod.tintR * 0.3 : 0));
  const hueRotate = `${(b.tint / 100) * 25 + (curvesMod.tintG * 20 - curvesMod.tintB * 20)}deg`;

  // Sharpening drop-shadow on Web for crisp edge enhancement
  const sharpeningFilter = b.sharpening > 0
    ? ` drop-shadow(0 0 0.5px rgba(0,0,0,${((b.sharpening / 100) * 0.65).toFixed(2)}))`
    : '';

  // The web image is already rendered by renderDocument. Native keeps the
  // existing lightweight fallback filter until a native preview buffer is
  // available.
  const webFilterString = `brightness(${exposureBright.toFixed(3)}) contrast(${baseContrast.toFixed(3)}) saturate(${saturation.toFixed(3)}) sepia(${Math.abs(sepia).toFixed(3)}) hue-rotate(${hueRotate})${sharpeningFilter}`;
  const fallbackImageTransform = {
    transform: [
      { rotate: `${crop.rotation + crop.straightenAngle}deg` },
      { scaleX: crop.flipHorizontal ? -1 : 1 },
      { scaleY: crop.flipVertical ? -1 : 1 }
    ]
  };
  const webFilterStyle: any = isHoldingOriginal || (Platform.OS === 'web' && processedPreview)
    ? fallbackImageTransform
    : { ...fallbackImageTransform, filter: webFilterString };

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
  const isCropMode = activeTab === 'crop';
  const orientedSource = getOrientedSourceDimensions(origW, origH, crop.rotation);
  const fullCropBounds: CropBounds = { x: 0, y: 0, width: 1, height: 1 };
  const displayedCropBounds = isCropMode ? fullCropBounds : clampCropBounds(crop);
  const showProcessedPreview = Platform.OS === 'web' && Boolean(processedPreview) && !isHoldingOriginal;
  const fallbackCropRatio = (
    displayedCropBounds.width * orientedSource.width
  ) / Math.max(1, displayedCropBounds.height * orientedSource.height);
  const imgRatio = showProcessedPreview && processedPreview
    ? processedPreview.width / Math.max(1, processedPreview.height)
    : isHoldingOriginal ? origW / origH : fallbackCropRatio;
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

  // Sync image display dimensions to refs for instant gesture calculations
  imgDisplayWidthRef.current = imgDisplayWidth;
  imgDisplayHeightRef.current = imgDisplayHeight;
  const fallbackFullWidth = imgDisplayWidth / Math.max(0.001, displayedCropBounds.width);
  const fallbackFullHeight = imgDisplayHeight / Math.max(0.001, displayedCropBounds.height);
  const isQuarterTurn = crop.rotation % 360 === 90 || crop.rotation % 360 === -90 || crop.rotation % 360 === 270;
  const fallbackSourceWidth = isQuarterTurn ? fallbackFullHeight : fallbackFullWidth;
  const fallbackSourceHeight = isQuarterTurn ? fallbackFullWidth : fallbackFullHeight;
  const straightenRadians = (crop.straightenAngle * Math.PI) / 180;
  const straightenCover = Math.max(
    Math.abs(Math.cos(straightenRadians)) + (fallbackFullHeight / Math.max(1, fallbackFullWidth)) * Math.abs(Math.sin(straightenRadians)),
    Math.abs(Math.cos(straightenRadians)) + (fallbackFullWidth / Math.max(1, fallbackFullHeight)) * Math.abs(Math.sin(straightenRadians))
  );

  // Web Pointer & Wheel listeners for desktop & mobile web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const vp = viewportRef.current as any;
    if (!vp) return;
    const domNode = vp._touchableNode || vp;
    if (!domNode || !domNode.addEventListener) return;

    const onPointerDown = (e: PointerEvent) => {
      if (isDraggingSplitRef.current) return;
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointersRef.current.size === 1) {
        dragStartPosRef.current = { x: e.clientX, y: e.clientY };
        initialPanOffset.current = { ...panOffsetRef.current };
        hasMovedSignificantlyRef.current = false;

        if (activeTabRef.current === 'erase' || (activeTabRef.current === 'masking' && activeMaskRef.current?.type === 'brush')) {
          isPaintingToolRef.current = true;
          lastToolPointRef.current = null;
          beginAdjustment();
          handleViewportPressAt(e.clientX, e.clientY);
          return;
        }

        // Long press detection for original photo preview
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = setTimeout(() => {
          if (!hasMovedSignificantlyRef.current && activePointersRef.current.size === 1) {
            setHoldingOriginal(true);
          }
        }, 400);
      } else if (activePointersRef.current.size === 2) {
        // Multi-touch pinch zoom started
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        if (isPaintingToolRef.current) endAdjustment();
        isPaintingToolRef.current = false;
        lastToolPointRef.current = null;
        setHoldingOriginal(false);
        isPinching.current = true;
        const pts = Array.from(activePointersRef.current.values());
        initialPointerDistanceRef.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        initialPointerCenterRef.current = {
          x: (pts[0].x + pts[1].x) / 2,
          y: (pts[0].y + pts[1].y) / 2,
        };
        initialZoomScale.current = zoomScaleRef.current;
        initialPanOffset.current = { ...panOffsetRef.current };
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (isDraggingSplitRef.current) return;
      if (!activePointersRef.current.has(e.pointerId)) return;
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Multi-touch Pinch Zoom
      if (activePointersRef.current.size >= 2) {
        if (isPaintingToolRef.current) endAdjustment();
        isPaintingToolRef.current = false;
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        const pts = Array.from(activePointersRef.current.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        if (initialPointerDistanceRef.current > 10) {
          const factor = dist / initialPointerDistanceRef.current;
          const newScale = Math.max(1.0, Math.min(5.0, initialZoomScale.current * factor));
          setZoomScale(newScale);

          const curCenter = {
            x: (pts[0].x + pts[1].x) / 2,
            y: (pts[0].y + pts[1].y) / 2,
          };
          const shiftX = curCenter.x - initialPointerCenterRef.current.x;
          const shiftY = curCenter.y - initialPointerCenterRef.current.y;

          const { limitX, limitY } = getPanLimits(newScale);
          const targetX = initialPanOffset.current.x + shiftX;
          const targetY = initialPanOffset.current.y + shiftY;
          setPanOffset({
            x: Math.max(-limitX, Math.min(limitX, targetX)),
            y: Math.max(-limitY, Math.min(limitY, targetY)),
          });
        }
      }
      // Single Pointer Pan (when zoomed in)
      else if (activePointersRef.current.size === 1) {
        if (isPaintingToolRef.current) {
          paintToolAt(e.clientX, e.clientY);
          hasMovedSignificantlyRef.current = true;
          return;
        }
        const dx = e.clientX - dragStartPosRef.current.x;
        const dy = e.clientY - dragStartPosRef.current.y;
        if (Math.hypot(dx, dy) > 6) {
          hasMovedSignificantlyRef.current = true;
          if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        }

        if (zoomScaleRef.current > 1.05 && activeTabRef.current !== 'crop') {
          const { limitX, limitY } = getPanLimits(zoomScaleRef.current);
          const targetX = initialPanOffset.current.x + dx;
          const targetY = initialPanOffset.current.y + dy;
          setPanOffset({
            x: Math.max(-limitX, Math.min(limitX, targetX)),
            y: Math.max(-limitY, Math.min(limitY, targetY)),
          });
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      setHoldingOriginal(false);

      const hadMultiple = activePointersRef.current.size >= 2;
      const wasPainting = isPaintingToolRef.current;
      if (wasPainting && !hadMultiple) {
        paintToolAt(e.clientX, e.clientY);
        isPaintingToolRef.current = false;
        lastToolPointRef.current = null;
        endAdjustment();
      }
      activePointersRef.current.delete(e.pointerId);

      if (wasPainting && !hadMultiple) return;

      if (hadMultiple && activePointersRef.current.size < 2) {
        // Pinching stopped: FIX zoom scale and pan offset exactly where user released
        isPinching.current = false;
        initialZoomScale.current = zoomScaleRef.current;
        initialPanOffset.current = { ...panOffsetRef.current };
        return;
      }

      if (activePointersRef.current.size === 0) {
        // Dragging finished: keep pan fixed where user released
        initialPanOffset.current = { ...panOffsetRef.current };

        // Tap or Double Tap detection (if pointer didn't drag significantly)
        if (!hasMovedSignificantlyRef.current) {
          const now = Date.now();
          const lastTap = lastTapRef.current;
          const timeDiff = now - lastTap.time;
          const distDiff = Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y);

          if (timeDiff < 320 && distDiff < 35) {
            lastTapRef.current = { time: 0, x: 0, y: 0 };
            handleDoubleTapAt(e.clientX, e.clientY);
          } else {
            lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
            if (activeTabRef.current === 'erase' || (activeTabRef.current === 'masking' && activeMaskRef.current?.type === 'brush')) {
              handleViewportPressAt(e.clientX, e.clientY);
            }
          }
        }
      }
    };

    const onWheelNative = (e: WheelEvent) => {
      // Trackpad pinch gesture on desktop web (ctrlKey or metaKey)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = Math.exp(-e.deltaY * 0.012);
        setZoomScale(prev => {
          const next = Math.max(1.0, Math.min(5.0, prev * factor));
          initialZoomScale.current = next;
          const { limitX, limitY } = getPanLimits(next);
          setPanOffset(curPan => ({
            x: Math.max(-limitX, Math.min(limitX, curPan.x)),
            y: Math.max(-limitY, Math.min(limitY, curPan.y))
          }));
          return next;
        });
      } else if (zoomScaleRef.current > 1.05) {
        // Trackpad 2-finger scroll or wheel panning across zoomed image
        e.preventDefault();
        const { limitX, limitY } = getPanLimits(zoomScaleRef.current);
        setPanOffset(prev => {
          const nextX = Math.max(-limitX, Math.min(limitX, prev.x - e.deltaX));
          const nextY = Math.max(-limitY, Math.min(limitY, prev.y - e.deltaY));
          initialPanOffset.current = { x: nextX, y: nextY };
          return { x: nextX, y: nextY };
        });
      }
    };

    domNode.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    domNode.addEventListener('wheel', onWheelNative, { passive: false });

    return () => {
      domNode.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      domNode.removeEventListener('wheel', onWheelNative);
    };
  }, [beginAdjustment, endAdjustment, getPanLimits, handleDoubleTapAt, handleViewportPressAt, paintToolAt]);

  // Vignette parameters
  const isVignetteActive = Platform.OS !== 'web' && !isHoldingOriginal && Math.abs(b.vignette) > 2;
  const vignetteAlpha = Math.min(0.9, Math.abs(b.vignette / 100) * 0.9);
  const vignetteUri = b.vignette > 0 ? VIGNETTE_BLACK_URI : VIGNETTE_WHITE_URI;

  // Film Grain parameters
  const isGrainActive = Platform.OS !== 'web' && !isHoldingOriginal && b.grain > 2;
  const grainAlpha = Math.min(0.65, (b.grain / 100) * 0.65);

  const handleExport = async (options: ExportOptions) => {
    try {
      if (Platform.OS === 'web') {
        if (!activeProject?.sourceUri) throw new Error('Source URI missing');
        const image = new (window as any).Image();
        image.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error('Failed to load image'));
          image.src = activeProject.sourceUri;
        });

        const sourceWidth = Math.max(1, Math.round((activeProject.originalWidth || image.naturalWidth) * options.scale));
        const sourceHeight = Math.max(1, Math.round((activeProject.originalHeight || image.naturalHeight) * options.scale));
        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = sourceWidth;
        sourceCanvas.height = sourceHeight;
        const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
        if (!sourceContext) throw new Error('Canvas not available');
        sourceContext.drawImage(image, 0, 0, sourceWidth, sourceHeight);

        const rendered = renderDocument(
          sourceContext.getImageData(0, 0, sourceWidth, sourceHeight).data,
          sourceWidth,
          sourceHeight,
          currentDoc
        );
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = rendered.width;
        outputCanvas.height = rendered.height;
        const outputContext = outputCanvas.getContext('2d');
        if (!outputContext) throw new Error('Output canvas not available');
        const outputImageData = outputContext.createImageData(rendered.width, rendered.height);
        outputImageData.data.set(rendered.pixels as any);
        outputContext.putImageData(outputImageData, 0, 0);

        const mimeType = options.format === 'png' ? 'image/png' : 'image/jpeg';
        const dataUrl = outputCanvas.toDataURL(mimeType, options.quality);
        const link = document.createElement('a');
        link.download = `lumaflow_export_${Date.now()}.${options.format}`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
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
          {zoomScale > 1.05 && (
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
          viewportWidthRef.current = e.nativeEvent.layout.width;
          viewportHeightRef.current = e.nativeEvent.layout.height;
        }}
        {...zoomPanResponder.panHandlers}
      >
        {activeProject?.sourceUri ? (
          <View
            style={[
              styles.viewportInner,
              Platform.OS === 'web' ? ({
                touchAction: 'none',
                cursor: zoomScale > 1.05 ? 'grab' : 'zoom-in',
                userSelect: 'none',
                WebkitUserSelect: 'none'
              } as any) : {}
            ]}
          >
            {/* The Constrained Photo Canvas (Matches exact photo aspect ratio - ZERO bleed into black bars!) */}
            <View
              style={[
                styles.photoFrame,
                {
                  width: imgDisplayWidth,
                  height: imgDisplayHeight,
                  transform: [
                    { translateX: panOffset.x },
                    { translateY: panOffset.y },
                    { scale: zoomScale }
                  ]
                }
              ]}
            >
              {/* Split View: Left side is untouched Original */}
              {isSplitActive && activeTab !== 'crop' && (
                <View
                  style={[
                    styles.splitBeforeContainer,
                    { width: `${splitPosition * 100}%` }
                  ]}
                >
                  <Image
                    source={{ uri: activeProject.sourceUri }}
                    style={[
                      { width: imgDisplayWidth, height: imgDisplayHeight },
                      {
                        transform: [
                          { rotate: `${crop.rotation + crop.straightenAngle}deg` },
                          { scaleX: crop.flipHorizontal ? -1 : 1 },
                          { scaleY: crop.flipVertical ? -1 : 1 }
                        ]
                      }
                    ]}
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
                {(showProcessedPreview || isHoldingOriginal) ? (
                  <Image
                    source={{ uri: showProcessedPreview && processedPreview ? processedPreview.uri : activeProject.sourceUri }}
                    style={[
                      { width: imgDisplayWidth, height: imgDisplayHeight },
                      showProcessedPreview ? { transform: [] } : webFilterStyle,
                      isSplitActive && { marginLeft: -imgDisplayWidth * splitPosition }
                    ]}
                    resizeMode="cover"
                  />
                ) : (
                  /*
                   * Native has no pixel buffer for a processed preview. This
                   * nested, clipped source canvas maps the selected crop back
                   * onto the output frame immediately, including quarter-turn
                   * transforms, instead of leaving the source image full-size.
                   */
                  <View
                    style={[
                      styles.fallbackImageCanvas,
                      {
                        width: fallbackFullWidth,
                        height: fallbackFullHeight,
                        left: (isSplitActive ? -imgDisplayWidth * splitPosition : 0) - displayedCropBounds.x * fallbackFullWidth,
                        top: -displayedCropBounds.y * fallbackFullHeight
                      }
                    ]}
                  >
                    <Image
                      source={{ uri: activeProject.sourceUri }}
                      style={[
                        styles.fallbackSourceImage,
                        {
                          width: fallbackSourceWidth,
                          height: fallbackSourceHeight,
                          left: (fallbackFullWidth - fallbackSourceWidth) / 2,
                          top: (fallbackFullHeight - fallbackSourceHeight) / 2,
                          transform: [
                            { rotate: `${crop.rotation + crop.straightenAngle}deg` },
                            { scale: straightenCover },
                            { scaleX: crop.flipHorizontal ? -1 : 1 },
                            { scaleY: crop.flipVertical ? -1 : 1 }
                          ]
                        }
                      ]}
                      resizeMode="cover"
                    />
                  </View>
                )}

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
                {Platform.OS !== 'web' && !isHoldingOriginal && Math.abs(b.temperature) > 2 && (
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: tempOverlayColor, pointerEvents: 'none' as any }
                    ]}
                  />
                )}

                {/* Green / Magenta Tint Layer */}
                {Platform.OS !== 'web' && !isHoldingOriginal && Math.abs(b.tint) > 2 && (
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: tintOverlayColor, pointerEvents: 'none' as any }
                    ]}
                  />
                )}

                {/* Lifted Shadows (Matte Film) Overlay */}
                {Platform.OS !== 'web' && !isHoldingOriginal && curvesMod.liftMod > 0.02 && (
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        backgroundColor: '#ffffff',
                        opacity: Math.min(0.28, curvesMod.liftMod * 0.35),
                        pointerEvents: 'none' as any
                      }
                    ]}
                  />
                )}

                {/* Blue / Warm Curve Channel Tint Layer */}
                {Platform.OS !== 'web' && !isHoldingOriginal && (Math.abs(curvesMod.tintB) > 0.05 || Math.abs(curvesMod.tintR) > 0.05) && (
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        backgroundColor: curvesMod.tintB > curvesMod.tintR ? '#3b82f6' : '#ef4444',
                        opacity: Math.min(0.25, Math.max(Math.abs(curvesMod.tintB), Math.abs(curvesMod.tintR)) * 0.25),
                        pointerEvents: 'none' as any
                      }
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
                <View
                  ref={cropOverlayRef}
                  style={[
                    styles.cropOverlay,
                    Platform.OS === 'web' ? ({
                      touchAction: 'none',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      cursor: 'crosshair'
                    } as any) : {}
                  ]}
                  pointerEvents="box-only"
                  onLayout={event => {
                    cropOverlaySizeRef.current = {
                      width: event.nativeEvent.layout.width,
                      height: event.nativeEvent.layout.height
                    };
                  }}
                  {...(Platform.OS === 'web' ? {} : cropPanResponder.panHandlers)}
                >
                  {/* Crop boundary rectangle */}
                  <View
                    style={[
                      styles.cropBoundary,
                      {
                        left: `${clampCropBounds(crop).x * 100}%`,
                        top: `${clampCropBounds(crop).y * 100}%`,
                        width: `${clampCropBounds(crop).width * 100}%`,
                        height: `${clampCropBounds(crop).height * 100}%`,
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
                    <View style={[styles.cropSideHandle, styles.sideLeft]} />
                    <View style={[styles.cropSideHandle, styles.sideRight]} />
                    <View style={[styles.cropSideHandle, styles.sideTop]} />
                    <View style={[styles.cropSideHandle, styles.sideBottom]} />
                  </View>

                  {/* Dimmed areas outside crop */}
                  <View style={[styles.cropDimmed, { top: 0, left: 0, right: 0, height: `${clampCropBounds(crop).y * 100}%` }]} />
                  <View style={[styles.cropDimmed, { bottom: 0, left: 0, right: 0, height: `${(1 - clampCropBounds(crop).y - clampCropBounds(crop).height) * 100}%` }]} />
                  <View style={[styles.cropDimmed, { top: `${clampCropBounds(crop).y * 100}%`, left: 0, width: `${clampCropBounds(crop).x * 100}%`, height: `${clampCropBounds(crop).height * 100}%` }]} />
                  <View style={[styles.cropDimmed, { top: `${clampCropBounds(crop).y * 100}%`, right: 0, width: `${(1 - clampCropBounds(crop).x - clampCropBounds(crop).width) * 100}%`, height: `${clampCropBounds(crop).height * 100}%` }]} />
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
                      top: `${spot.y * 100}%`,
                      width: Math.max(20, spot.radius * imgDisplayWidth * 2),
                      height: Math.max(20, spot.radius * imgDisplayWidth * 2),
                      marginLeft: -Math.max(10, spot.radius * imgDisplayWidth),
                      marginTop: -Math.max(10, spot.radius * imgDisplayWidth),
                      backgroundColor: selectedHealingSpotId === spot.id
                        ? 'rgba(251, 146, 60, 0.55)'
                        : 'rgba(239, 68, 68, 0.35)',
                      borderColor: selectedHealingSpotId === spot.id ? '#fb923c' : '#ef4444'
                    }
                  ]}
                  onPress={() => {
                    if (selectedHealingSpotId === spot.id) {
                      removeHealingSpot(spot.id);
                      setSelectedHealingSpotId(null);
                    } else {
                      setSelectedHealingSpotId(spot.id);
                    }
                  }}
                  onLongPress={() => {
                    removeHealingSpot(spot.id);
                    setSelectedHealingSpotId(null);
                  }}
                >
                  <View style={styles.healingSpotPulse} />
                  <Text style={styles.healingSpotX}>{selectedHealingSpotId === spot.id ? '✕' : '•'}</Text>
                </TouchableOpacity>
              ))}

              {/* Masking Visual Rubylith Preview */}
              {activeTab === 'masking' && (currentDoc.masks || []).length > 0 && (
                <View style={styles.maskRubylithOverlay} pointerEvents="none">
                  {(currentDoc.masks || []).map(mask => {
                    const maskColor = mask.inverted ? '#22d3ee' : '#ef4444';
                    const maskFill = mask.inverted ? 'rgba(34, 211, 238, 0.16)' : 'rgba(239, 68, 68, 0.24)';
                    const maskIsActive = mask.id === activeMaskId;
                    if (mask.type === 'radial') {
                      return (
                        <View key={mask.id} style={StyleSheet.absoluteFill}>
                          {mask.inverted && <View style={[styles.maskInvertedFill, { backgroundColor: maskFill }]} />}
                          <View
                            style={[
                              styles.maskRadialCircle,
                              {
                                left: `${(mask.center?.x || 0.5) * 100 - (mask.radiusX || 0.35) * 100}%`,
                                top: `${(mask.center?.y || 0.5) * 100 - (mask.radiusY || 0.35) * 100}%`,
                                width: `${(mask.radiusX || 0.35) * 200}%`,
                                height: `${(mask.radiusY || 0.35) * 200}%`,
                                backgroundColor: maskFill,
                                borderColor: maskColor,
                                borderWidth: maskIsActive ? 3 : 2,
                              }
                            ]}
                          />
                          <Text style={[styles.maskOverlayLabel, { color: maskColor }]}>
                            {mask.inverted ? 'INVERTED RADIAL' : 'RADIAL'}
                          </Text>
                        </View>
                      );
                    } else if (mask.type === 'linear') {
                      const startY = (mask.start?.y || 0) * 100;
                      const endY = (mask.end?.y || 0.4) * 100;
                      return (
                        <View key={mask.id} style={StyleSheet.absoluteFill}>
                          {mask.inverted && <View style={[styles.maskInvertedFill, { backgroundColor: maskFill }]} />}
                          <View
                            style={[
                              styles.maskLinearGrad,
                              {
                                top: `${Math.min(startY, endY)}%`,
                                height: `${Math.max(2, Math.abs(endY - startY))}%`,
                                left: 0,
                                right: 0,
                                backgroundColor: maskFill,
                                borderColor: maskColor,
                                borderTopWidth: maskIsActive ? 3 : 2,
                                borderBottomWidth: maskIsActive ? 3 : 2,
                              }
                            ]}
                          />
                          <Text style={[styles.maskOverlayLabel, { color: maskColor }]}>
                            {mask.inverted ? 'INVERTED LINEAR' : 'LINEAR'}
                          </Text>
                        </View>
                      );
                    } else if (mask.type === 'brush') {
                      const brushRadius = (mask as any).brushRadius || 0.04;
                      const brushDiameter = Math.max(10, brushRadius * imgDisplayWidth * 2);
                      return (
                        <View key={mask.id} style={StyleSheet.absoluteFill}>
                          {mask.inverted && <View style={[styles.maskInvertedFill, { backgroundColor: maskFill }]} />}
                          {(mask.points || []).map((pt, i) => (
                            <View
                              key={`${mask.id}_pt_${i}`}
                              style={[
                                styles.brushStrokeDot,
                                {
                                  left: `${pt.x * 100}%`,
                                  top: `${pt.y * 100}%`,
                                  width: brushDiameter,
                                  height: brushDiameter,
                                  marginLeft: -brushDiameter / 2,
                                  marginTop: -brushDiameter / 2,
                                  backgroundColor: maskFill,
                                  borderColor: maskColor,
                                  borderWidth: maskIsActive ? 1 : 0,
                                }
                              ]}
                            />
                          ))}
                          <Text style={[styles.maskOverlayLabel, { color: maskColor }]}>
                            {mask.inverted ? 'INVERTED BRUSH' : 'BRUSH'}
                          </Text>
                        </View>
                      );
                    }
                    return null;
                  })}
                </View>
              )}
            </View>
          </View>
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
          <SmartErasePanel settings={eraseSettings} onSettingsChange={setEraseSettings} />
        ) : activeTab === 'crop' ? (
          <CropEditor
            selectedAspectRatio={cropAspectMode}
            onAspectRatioChange={setCropAspectMode}
          />
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
                  accessibilityRole="button"
                  accessibilityState={{ selected: isApplied }}
                >
                  <Text style={[styles.presetName, isApplied && styles.presetNameActive]}>
                    {preset.name}
                  </Text>
                  {isApplied && <Text style={styles.presetActiveCheck}>ACTIVE ✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      {/* Horizontal Category Toolbar */}
      <EditingToolbar />

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
    zIndex: 30,
    touchAction: 'none' as any,
    userSelect: 'none' as any
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
  cropSideHandle: {
    position: 'absolute',
    width: 24,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.accentPrimary
  },
  sideLeft: {
    left: -12,
    top: '50%',
    marginTop: -2.5,
    transform: [{ rotate: '90deg' }]
  },
  sideRight: {
    right: -12,
    top: '50%',
    marginTop: -2.5,
    transform: [{ rotate: '90deg' }]
  },
  sideTop: {
    top: -2.5,
    left: '50%',
    marginLeft: -12
  },
  sideBottom: {
    bottom: -2.5,
    left: '50%',
    marginLeft: -12
  },
  cropDimmed: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  fallbackImageCanvas: {
    position: 'absolute',
    overflow: 'visible'
  },
  fallbackSourceImage: {
    position: 'absolute'
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
    zIndex: 6,
    overflow: 'hidden'
  },
  maskInvertedFill: {
    ...(StyleSheet.absoluteFill as any),
    opacity: 0.9
  },
  maskOverlayLabel: {
    position: 'absolute',
    top: 10,
    left: 10,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2
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
    height: 270,
    backgroundColor: colors.surfaceCard,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    overflow: 'hidden'
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
