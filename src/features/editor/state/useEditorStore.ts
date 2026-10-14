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
  createNewEditDocument
} from '../models/EditDocument';
import { HealingSpot, MaskAdjustment } from '../../../types';

export type EditorTab = 'light' | 'color' | 'grading' | 'mixer' | 'masking' | 'erase' | 'crop' | 'presets';

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
      const doc = initialDoc ? cloneEditDocument(initialDoc) : createNewEditDocument(project.assetId, project.sourceUri);
      history.clear();
      set({
        activeProject: project,
        currentDocument: doc,
        canUndo: false,
        canRedo: false
      });
    },

    setActiveTab: (tab) => set({ activeTab: tab }),

    beginAdjustment: () => {
      const { currentDocument } = get();
      history.push(currentDocument);
      set({
        canUndo: history.canUndo(),
        canRedo: history.canRedo()
      });
    },

    endAdjustment: () => {
      set({
        canUndo: history.canUndo(),
        canRedo: history.canRedo()
      });
    },

    updateBasic: (key, value, commitToHistory = false) => {
      const { currentDocument } = get();
      if (commitToHistory) {
        history.push(currentDocument);
      }
      const nextDoc = cloneEditDocument(currentDocument);
      nextDoc.basic[key] = value;
      nextDoc.updatedAt = Date.now();
      set({
        currentDocument: nextDoc,
        canUndo: history.canUndo(),
        canRedo: history.canRedo()
      });
    },

    applyAlgorithmicAutoLight: (adj) => {
      const { currentDocument } = get();
      history.push(currentDocument);
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
      set({
        currentDocument: nextDoc,
        canUndo: history.canUndo(),
        canRedo: history.canRedo()
      });
    },

    updateGradingTone: (wheel, key, value) => {
      const { currentDocument } = get();
      history.push(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      nextDoc.colorGrading[wheel][key] = value;
      nextDoc.updatedAt = Date.now();
      set({
        currentDocument: nextDoc,
        canUndo: history.canUndo(),
        canRedo: history.canRedo()
      });
    },

    updateGradingParams: (blending, balance) => {
      const { currentDocument } = get();
      history.push(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      nextDoc.colorGrading.blending = blending;
      nextDoc.colorGrading.balance = balance;
      nextDoc.updatedAt = Date.now();
      set({
        currentDocument: nextDoc,
        canUndo: history.canUndo(),
        canRedo: history.canRedo()
      });
    },

    updateHslMixer: (channel, key, value) => {
      const { currentDocument } = get();
      history.push(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      nextDoc.hslMixer[channel][key] = value;
      nextDoc.updatedAt = Date.now();
      set({
        currentDocument: nextDoc,
        canUndo: history.canUndo(),
        canRedo: history.canRedo()
      });
    },

    setSplitPosition: (pos) => set({ splitPosition: Math.max(0.05, Math.min(0.95, pos)) }),

    updateCrop: (update) => {
      const { currentDocument } = get();
      history.push(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      nextDoc.crop = { ...nextDoc.crop, ...update };
      nextDoc.updatedAt = Date.now();
      set({
        currentDocument: nextDoc,
        canUndo: history.canUndo(),
        canRedo: history.canRedo()
      });
    },

    addHealingSpot: (spot) => {
      const { currentDocument } = get();
      history.push(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      const newSpot: HealingSpot = {
        ...spot,
        id: `heal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
      };
      nextDoc.healingSpots = [...(nextDoc.healingSpots || []), newSpot];
      nextDoc.updatedAt = Date.now();
      set({
        currentDocument: nextDoc,
        canUndo: history.canUndo(),
        canRedo: history.canRedo()
      });
    },

    removeHealingSpot: (id) => {
      const { currentDocument } = get();
      history.push(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      nextDoc.healingSpots = (nextDoc.healingSpots || []).filter(s => s.id !== id);
      nextDoc.updatedAt = Date.now();
      set({
        currentDocument: nextDoc,
        canUndo: history.canUndo(),
        canRedo: history.canRedo()
      });
    },

    clearHealingSpots: () => {
      const { currentDocument } = get();
      history.push(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      nextDoc.healingSpots = [];
      nextDoc.updatedAt = Date.now();
      set({
        currentDocument: nextDoc,
        canUndo: history.canUndo(),
        canRedo: history.canRedo()
      });
    },

    setActiveMaskId: (id) => set({ activeMaskId: id }),

    addMask: (mask) => {
      const { currentDocument } = get();
      history.push(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      const newMask: MaskAdjustment = {
        ...mask,
        id: `mask_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
      };
      nextDoc.masks = [...(nextDoc.masks || []), newMask];
      nextDoc.updatedAt = Date.now();
      set({
        currentDocument: nextDoc,
        activeMaskId: newMask.id,
        canUndo: history.canUndo(),
        canRedo: history.canRedo()
      });
    },

    updateMask: (id, update) => {
      const { currentDocument } = get();
      history.push(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      nextDoc.masks = (nextDoc.masks || []).map(m => (m.id === id ? { ...m, ...update } : m));
      nextDoc.updatedAt = Date.now();
      set({
        currentDocument: nextDoc,
        canUndo: history.canUndo(),
        canRedo: history.canRedo()
      });
    },

    removeMask: (id) => {
      const { currentDocument } = get();
      history.push(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      nextDoc.masks = (nextDoc.masks || []).filter(m => m.id !== id);
      nextDoc.updatedAt = Date.now();
      set({
        currentDocument: nextDoc,
        activeMaskId: null,
        canUndo: history.canUndo(),
        canRedo: history.canRedo()
      });
    },

    applyPreset: (preset) => {
      const { currentDocument } = get();
      history.push(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      nextDoc.appliedPresetId = preset.id;
      if (preset.documentState.basic) {
        nextDoc.basic = { ...nextDoc.basic, ...preset.documentState.basic };
      }
      if (preset.documentState.colorGrading) {
        nextDoc.colorGrading = { ...nextDoc.colorGrading, ...preset.documentState.colorGrading };
      }
      if (preset.documentState.hslMixer) {
        nextDoc.hslMixer = [...preset.documentState.hslMixer];
      }
      nextDoc.updatedAt = Date.now();
      set({
        currentDocument: nextDoc,
        canUndo: history.canUndo(),
        canRedo: history.canRedo()
      });
    },

    undo: () => {
      const { currentDocument } = get();
      const previous = history.undo(currentDocument);
      if (previous) {
        set({
          currentDocument: previous,
          canUndo: history.canUndo(),
          canRedo: history.canRedo()
        });
      }
    },

    redo: () => {
      const { currentDocument } = get();
      const next = history.redo(currentDocument);
      if (next) {
        set({
          currentDocument: next,
          canUndo: history.canUndo(),
          canRedo: history.canRedo()
        });
      }
    },

    resetActiveModule: () => {
      const { currentDocument, activeTab } = get();
      history.push(currentDocument);
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

      set({
        currentDocument: nextDoc,
        canUndo: history.canUndo(),
        canRedo: history.canRedo()
      });
    },

    resetAllAdjustments: () => {
      const { currentDocument } = get();
      history.push(currentDocument);
      const nextDoc = cloneEditDocument(currentDocument);
      nextDoc.basic = createDefaultBasicAdjustments();
      nextDoc.colorGrading = createDefaultColorGrading();
      nextDoc.hslMixer = createDefaultHslMixer();
      nextDoc.crop = createDefaultCrop();
      nextDoc.appliedPresetId = undefined;
      set({
        currentDocument: nextDoc,
        canUndo: history.canUndo(),
        canRedo: history.canRedo()
      });
    },

    toggleSplitView: () => set(state => ({ isSplitViewActive: !state.isSplitViewActive })),
    setHoldingOriginal: (holding) => set({ isHoldingOriginal: holding })
  };
});
