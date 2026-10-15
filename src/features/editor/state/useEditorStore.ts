import { create } from 'zustand';
import {
  BasicAdjustments,
  ColorGradingAdjustments,
  CropTransform,
  EditDocument,
  Preset,
  ProjectMetadata
} from '../../../types';
import { HistoryManager } from '../history/HistoryManager';
import {
  cloneEditDocument,
  createDefaultBasicAdjustments,
  createDefaultColorGrading,
  createDefaultCrop,
  createDefaultHslMixer,
  createDefaultToneCurves,
  createNewEditDocument
} from '../models/EditDocument';
import { CurvePoint, HealingSpot, MaskAdjustment } from '../../../types';
import {
  applyPresetToDocument,
  normalizeCropTransform,
  normalizeEditDocumentToolState,
  normalizeHealingSpot,
  normalizeMaskAdjustment
} from '../presets/PresetManager';

export type EditorTab = 'light' | 'color' | 'curves' | 'grading' | 'mixer' | 'masking' | 'erase' | 'crop' | 'presets';

export interface EditorState {
  activeProject: ProjectMetadata | null;
  currentDocument: EditDocument;
  activeTab: EditorTab;
  isSplitViewActive: boolean;
  splitPosition: number; // 0.0 to 1.0 (divider line)
  isHoldingOriginal: boolean;
  historyManager: HistoryManager;
  canUndo: boolean;
  canRedo: boolean;
  activeMaskId: string | null;

  // Actions
  initializeSession: (project: ProjectMetadata, initialDoc?: EditDocument) => void;
  setActiveTab: (tab: EditorTab) => void;
  setSplitPosition: (pos: number) => void;
  beginAdjustment: () => void;
  endAdjustment: () => void;
  updateBasic: <K extends keyof BasicAdjustments>(key: K, value: BasicAdjustments[K], commitToHistory?: boolean) => void;
  applyAlgorithmicAutoLight: (adjustments: {
    exposure: number;
    contrast: number;
    highlights: number;
    shadows: number;
    whites: number;
    blacks: number;
    clarity: number;
    sharpening: number;
  }) => void;
  updateGradingTone: (
    wheel: 'shadows' | 'midtones' | 'highlights' | 'global',
    key: 'hue' | 'saturation' | 'luminance',
    value: number
  ) => void;
  updateGradingParams: (blending: number, balance: number) => void;
  updateHslMixer: (channel: number, key: 'hue' | 'saturation' | 'luminance', value: number) => void;
  updateCurvePoint: (channel: 'composite' | 'red' | 'green' | 'blue', index: number, point: CurvePoint) => void;
  updateCurveChannel: (channel: 'composite' | 'red' | 'green' | 'blue', points: CurvePoint[]) => void;
  resetCurves: (channel?: 'composite' | 'red' | 'green' | 'blue') => void;
  updateCrop: (update: Partial<CropTransform>) => void;
  addHealingSpot: (spot: Omit<HealingSpot, 'id'>) => void;
  removeHealingSpot: (id: string) => void;
  clearHealingSpots: () => void;
  setActiveMaskId: (id: string | null) => void;
  addMask: (mask: Omit<MaskAdjustment, 'id'>) => void;
  updateMask: (id: string, update: Partial<MaskAdjustment>) => void;
  removeMask: (id: string) => void;
  applyPreset: (preset: Preset) => void;
  undo: () => void;
  redo: () => void;
  resetActiveModule: () => void;
  resetAllAdjustments: () => void;
  toggleSplitView: () => void;
  setHoldingOriginal: (holding: boolean) => void;
}

export const useEditorStore = create<EditorState>((set, get) => {
  const history = new HistoryManager(50);
  const defaultDoc = createNewEditDocument('default', 'assets/sample.jpg');
  let adjustmentInProgress = false;

  const getActiveMaskId = (masks: MaskAdjustment[], preferredId: string | null): string | null => {
    if (masks.length === 0) return null;
    if (preferredId && masks.some(mask => mask.id === preferredId)) return preferredId;
    return masks[0].id;
  };

  const recordHistory = (document: EditDocument): void => {
    // beginAdjustment records the drag's starting point once. Skipping the
    // per-frame pushes makes one drag one undo step without changing callers.
    if (!adjustmentInProgress) history.push(document);
  };

  const createToolId = (prefix: 'heal' | 'mask'): string => (
    `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  );

  const commitDocument = (document: EditDocument, preferredMaskId = get().activeMaskId): void => {
    set({
      currentDocument: document,
      activeMaskId: getActiveMaskId(document.masks || [], preferredMaskId),
      canUndo: history.canUndo(),
      canRedo: history.canRedo()
    });
  };

  return {
    activeProject: null,
    currentDocument: defaultDoc,
    activeTab: 'light',
    isSplitViewActive: false,
    splitPosition: 0.5,
    isHoldingOriginal: false,
    historyManager: history,
    canUndo: false,
    canRedo: false,
    activeMaskId: null,

    initializeSession: (project, initialDoc) => {
      const doc = normalizeEditDocumentToolState(
        initialDoc ? cloneEditDocument(initialDoc) : createNewEditDocument(project.assetId, project.sourceUri)
      );
      history.clear();
      adjustmentInProgress = false;
      set({
        activeProject: project,
        currentDocument: doc,
        activeMaskId: getActiveMaskId(doc.masks || [], null),
        canUndo: false,
        canRedo: false
      });
    },

    setActiveTab: (tab) => set({ activeTab: tab }),

    beginAdjustment: () => {
      if (adjustmentInProgress) return;
      const { currentDocument } = get();
      history.push(currentDocument);
      adjustmentInProgress = true;
      set({
        canUndo: history.canUndo(),
        canRedo: history.canRedo()
      });
    },

    endAdjustment: () => {
      adjustmentInProgress = false;
      set({
        canUndo: history.canUndo(),
        canRedo: history.canRedo()
      });
    },

    updateBasic: (key, value, commitToHistory = false) => {
      const { currentDocument } = get();
      if (commitToHistory) {
        recordHistory(currentDocument);
      }
      const nextDoc = cloneEditDocument(currentDocument);
      nextDoc.basic[key] = value;
      nextDoc.updatedAt = Date.now();
      commitDocument(nextDoc);
    },

    applyAlgorithmicAutoLight: (adj) => {
      const { currentDocument } = get();
      recordHistory(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      nextDoc.basic.exposure = adj.exposure;
      nextDoc.basic.contrast = adj.contrast;
      nextDoc.basic.highlights = adj.highlights;
      nextDoc.basic.shadows = adj.shadows;
      nextDoc.basic.whites = adj.whites;
      nextDoc.basic.blacks = adj.blacks;
      nextDoc.basic.clarity = adj.clarity;
      nextDoc.basic.sharpening = adj.sharpening;
      nextDoc.updatedAt = Date.now();
      commitDocument(nextDoc);
    },

    updateGradingTone: (wheel, key, value) => {
      const { currentDocument } = get();
      recordHistory(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      nextDoc.colorGrading[wheel][key] = value;
      nextDoc.updatedAt = Date.now();
      commitDocument(nextDoc);
    },

    updateGradingParams: (blending, balance) => {
      const { currentDocument } = get();
      recordHistory(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      nextDoc.colorGrading.blending = blending;
      nextDoc.colorGrading.balance = balance;
      nextDoc.updatedAt = Date.now();
      commitDocument(nextDoc);
    },

    updateHslMixer: (channel, key, value) => {
      const { currentDocument } = get();
      recordHistory(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      nextDoc.hslMixer[channel][key] = value;
      nextDoc.updatedAt = Date.now();
      commitDocument(nextDoc);
    },

    updateCurvePoint: (channel, index, point) => {
      const { currentDocument } = get();
      recordHistory(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      if (!nextDoc.curves) nextDoc.curves = createDefaultToneCurves();
      nextDoc.curves[channel][index] = {
        x: Math.max(0, Math.min(255, Math.round(point.x))),
        y: Math.max(0, Math.min(255, Math.round(point.y)))
      };
      nextDoc.updatedAt = Date.now();
      commitDocument(nextDoc);
    },

    updateCurveChannel: (channel, points) => {
      const { currentDocument } = get();
      recordHistory(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      if (!nextDoc.curves) nextDoc.curves = createDefaultToneCurves();
      nextDoc.curves[channel] = points.map(pt => ({
        x: Math.max(0, Math.min(255, Math.round(pt.x))),
        y: Math.max(0, Math.min(255, Math.round(pt.y)))
      }));
      nextDoc.updatedAt = Date.now();
      commitDocument(nextDoc);
    },

    resetCurves: (channel) => {
      const { currentDocument } = get();
      recordHistory(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      const defCurves = createDefaultToneCurves();
      if (channel) {
        if (!nextDoc.curves) nextDoc.curves = defCurves;
        else nextDoc.curves[channel] = defCurves[channel];
      } else {
        nextDoc.curves = defCurves;
      }
      nextDoc.updatedAt = Date.now();
      commitDocument(nextDoc);
    },

    setSplitPosition: (pos) => set({ splitPosition: Math.max(0.05, Math.min(0.95, pos)) }),

    updateCrop: (update) => {
      const { currentDocument } = get();
      recordHistory(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      nextDoc.crop = normalizeCropTransform(update, nextDoc.crop);
      nextDoc.updatedAt = Date.now();
      commitDocument(nextDoc);
    },

    addHealingSpot: (spot) => {
      const { currentDocument } = get();
      recordHistory(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      const newSpot: HealingSpot = {
        ...normalizeHealingSpot(
          { ...spot, id: createToolId('heal') } as Partial<HealingSpot> & Record<string, unknown>
        )
      };
      nextDoc.healingSpots = [...(nextDoc.healingSpots || []), newSpot];
      nextDoc.updatedAt = Date.now();
      commitDocument(nextDoc);
    },

    removeHealingSpot: (id) => {
      const { currentDocument } = get();
      recordHistory(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      nextDoc.healingSpots = (nextDoc.healingSpots || []).filter(s => s.id !== id);
      nextDoc.updatedAt = Date.now();
      commitDocument(nextDoc);
    },

    clearHealingSpots: () => {
      const { currentDocument } = get();
      recordHistory(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      nextDoc.healingSpots = [];
      nextDoc.updatedAt = Date.now();
      commitDocument(nextDoc);
    },

    setActiveMaskId: (id) => {
      const { currentDocument } = get();
      set({ activeMaskId: getActiveMaskId(currentDocument.masks || [], id) });
    },

    addMask: (mask) => {
      const { currentDocument } = get();
      recordHistory(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      const newMask: MaskAdjustment = {
        ...normalizeMaskAdjustment(
          { ...mask, id: createToolId('mask') } as Partial<MaskAdjustment> & Record<string, unknown>
        )
      };
      nextDoc.masks = [...(nextDoc.masks || []), newMask];
      nextDoc.updatedAt = Date.now();
      commitDocument(nextDoc, newMask.id);
    },

    updateMask: (id, update) => {
      const { currentDocument } = get();
      const existingMask = (currentDocument.masks || []).find(mask => mask.id === id);
      if (!existingMask) return;
      recordHistory(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      const rawUpdate = update as Partial<MaskAdjustment> & Record<string, unknown>;
      const mergedMask = { ...existingMask, ...rawUpdate } as Partial<MaskAdjustment> & Record<string, unknown>;
      const mergedMaskRecord = mergedMask as Record<string, unknown>;
      (['start', 'end', 'center'] as const).forEach(key => {
        if (rawUpdate[key] && typeof rawUpdate[key] === 'object') {
          mergedMaskRecord[key] = {
            ...(existingMask[key] || {}),
            ...(rawUpdate[key] as Record<string, unknown>)
          };
        }
      });
      nextDoc.masks = (nextDoc.masks || []).map(mask => (
        mask.id === id
          ? normalizeMaskAdjustment(mergedMask, existingMask, id)
          : mask
      ));
      nextDoc.updatedAt = Date.now();
      commitDocument(nextDoc);
    },

    removeMask: (id) => {
      const { currentDocument } = get();
      recordHistory(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      nextDoc.masks = (nextDoc.masks || []).filter(m => m.id !== id);
      nextDoc.updatedAt = Date.now();
      const preferredMaskId = get().activeMaskId === id ? null : get().activeMaskId;
      commitDocument(nextDoc, preferredMaskId);
    },

    applyPreset: (preset) => {
      const { currentDocument } = get();
      recordHistory(currentDocument);
      const nextDoc = applyPresetToDocument(currentDocument, preset);
      commitDocument(nextDoc);
    },

    undo: () => {
      const { currentDocument } = get();
      const previous = history.undo(currentDocument);
      if (previous) {
        const restored = normalizeEditDocumentToolState(previous);
        commitDocument(restored);
      }
    },

    redo: () => {
      const { currentDocument } = get();
      const next = history.redo(currentDocument);
      if (next) {
        const restored = normalizeEditDocumentToolState(next);
        commitDocument(restored);
      }
    },

    resetActiveModule: () => {
      const { currentDocument, activeTab } = get();
      recordHistory(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);

      if (activeTab === 'light') {
        const d = createDefaultBasicAdjustments();
        nextDoc.basic.exposure = d.exposure;
        nextDoc.basic.contrast = d.contrast;
        nextDoc.basic.highlights = d.highlights;
        nextDoc.basic.shadows = d.shadows;
        nextDoc.basic.whites = d.whites;
        nextDoc.basic.blacks = d.blacks;
        nextDoc.basic.clarity = d.clarity;
        nextDoc.basic.sharpening = d.sharpening;
        nextDoc.basic.vignette = d.vignette;
        nextDoc.basic.grain = d.grain;
      } else if (activeTab === 'color') {
        const d = createDefaultBasicAdjustments();
        nextDoc.basic.temperature = d.temperature;
        nextDoc.basic.tint = d.tint;
        nextDoc.basic.vibrance = d.vibrance;
        nextDoc.basic.saturation = d.saturation;
      } else if (activeTab === 'grading') {
        nextDoc.colorGrading = createDefaultColorGrading();
      } else if (activeTab === 'curves') {
        nextDoc.curves = createDefaultToneCurves();
      } else if (activeTab === 'mixer') {
        nextDoc.hslMixer = createDefaultHslMixer();
      } else if (activeTab === 'crop') {
        nextDoc.crop = createDefaultCrop();
      } else if (activeTab === 'erase') {
        nextDoc.healingSpots = [];
      } else if (activeTab === 'masking') {
        nextDoc.masks = [];
      } else if (activeTab === 'presets') {
        nextDoc.appliedPresetId = undefined;
      }

      nextDoc.updatedAt = Date.now();
      commitDocument(nextDoc, activeTab === 'masking' ? null : get().activeMaskId);
    },

    resetAllAdjustments: () => {
      const { currentDocument } = get();
      recordHistory(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      nextDoc.basic = createDefaultBasicAdjustments();
      nextDoc.colorGrading = createDefaultColorGrading();
      nextDoc.curves = createDefaultToneCurves();
      nextDoc.hslMixer = createDefaultHslMixer();
      nextDoc.crop = createDefaultCrop();
      nextDoc.healingSpots = [];
      nextDoc.masks = [];
      nextDoc.appliedPresetId = undefined;
      nextDoc.updatedAt = Date.now();
      commitDocument(nextDoc, null);
    },

    toggleSplitView: () => set(state => ({ isSplitViewActive: !state.isSplitViewActive })),
    setHoldingOriginal: (holding) => set({ isHoldingOriginal: holding })
  };
});
