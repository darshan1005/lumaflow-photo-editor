import { createNewEditDocument } from '../../src/features/editor/models/EditDocument';
import { PresetManager } from '../../src/features/editor/presets/PresetManager';
import { useEditorStore } from '../../src/features/editor/state/useEditorStore';
import { EditDocument, HealingSpot, MaskAdjustment, Preset, ProjectMetadata } from '../../src/types';

const project: ProjectMetadata = {
  id: 'project_editor_tools',
  assetId: 'asset_editor_tools',
  name: 'Editor tools test',
  sourceUri: 'file://editor-tools.jpg',
  originalWidth: 1200,
  originalHeight: 800,
  createdAt: 1,
  updatedAt: 1
};

const createMask = (id: string): MaskAdjustment => ({
  id,
  name: `Mask ${id}`,
  type: 'brush',
  inverted: false,
  opacity: 100,
  points: [{ x: 0.25, y: 0.25 }],
  exposure: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  highlights: 0,
  shadows: 0
});

const createHealingSpot = (id: string): HealingSpot => ({
  id,
  x: 0.2,
  y: 0.3,
  radius: 0.04,
  sourceX: 0.25,
  sourceY: 0.3,
  mode: 'heal',
  opacity: 100
});

const asPreset = (documentState: Partial<EditDocument>): Preset => ({
  id: 'test_nested_preset',
  name: 'Nested test preset',
  category: 'user',
  createdAt: 1,
  documentState
});

beforeEach(() => {
  useEditorStore.getState().initializeSession(project, createNewEditDocument(project.assetId, project.sourceUri));
});

describe('PresetManager nested state application', () => {
  test('deeply merges nested controls, clones supplied values, and preserves omitted edits', () => {
    const document = createNewEditDocument('asset', 'file://image.jpg');
    document.basic.exposure = 0.75;
    document.colorGrading.shadows.saturation = 32;
    document.colorGrading.midtones.hue = 20;
    document.hslMixer[1].saturation = 44;
    document.curves.green[1].y = 81;
    document.crop = {
      x: 0.2,
      y: 0.15,
      width: 0.6,
      height: 0.7,
      rotation: 90,
      flipHorizontal: true,
      flipVertical: false,
      straightenAngle: 12
    };
    document.healingSpots = [createHealingSpot('heal-existing')];
    document.masks = [createMask('mask-existing')];

    const preset = asPreset({
      colorGrading: { shadows: { hue: 210 } } as EditDocument['colorGrading'],
      hslMixer: [{ hue: 25 }] as unknown as EditDocument['hslMixer'],
      curves: { red: [{ x: 0, y: 0 }, { x: 128, y: 170 }, { x: 255, y: 255 }] } as EditDocument['curves'],
      crop: { x: 0.1, width: 0.8, height: 1 } as EditDocument['crop'],
      healingSpots: [{ id: 'heal-existing', x: 0.8, mode: 'clone' }] as EditDocument['healingSpots'],
      masks: [{ id: 'mask-existing', opacity: 45 }] as EditDocument['masks']
    });

    const manager = new PresetManager();
    const applied = manager.applyPreset(document, preset);

    expect(applied.appliedPresetId).toBe(preset.id);
    expect(applied.basic.exposure).toBe(0.75);
    expect(applied.colorGrading.shadows).toEqual({ hue: 210, saturation: 32, luminance: 0 });
    expect(applied.colorGrading.midtones.hue).toBe(20);
    expect(applied.hslMixer[0]).toEqual({ hue: 25, saturation: 0, luminance: 0 });
    expect(applied.hslMixer[1].saturation).toBe(44);
    expect(applied.curves.red).toEqual([{ x: 0, y: 0 }, { x: 128, y: 170 }, { x: 255, y: 255 }]);
    expect(applied.curves.green[1].y).toBe(81);
    expect(applied.crop).toMatchObject({ x: 0.1, y: 0, width: 0.8, height: 1, rotation: 90, flipHorizontal: true });
    expect(applied.healingSpots[0]).toMatchObject({
      id: 'heal-existing',
      x: 0.8,
      y: 0.3,
      radius: 0.04,
      mode: 'clone'
    });
    expect(applied.masks[0]).toMatchObject({
      id: 'mask-existing',
      opacity: 45,
      name: 'Mask mask-existing',
      points: [{ x: 0.25, y: 0.25 }]
    });

    expect(applied.colorGrading).not.toBe(document.colorGrading);
    expect(applied.hslMixer).not.toBe(document.hslMixer);
    expect(applied.curves.red).not.toBe(document.curves.red);
    expect(applied.masks).not.toBe(document.masks);
    expect(document.colorGrading.shadows.hue).toBe(0);
    expect(document.masks[0].opacity).toBe(100);
  });

  test('captures crop, curves, healing, and masks in a user preset without sharing state', () => {
    const document = createNewEditDocument('asset', 'file://image.jpg');
    document.crop.width = 0.75;
    document.healingSpots = [createHealingSpot('heal-1')];
    document.masks = [createMask('mask-1')];
    document.curves.red[2].y = 150;

    const manager = new PresetManager();
    const preset = manager.createUserPreset('  Complete tools  ', document);
    const state = preset.documentState;

    expect(preset.name).toBe('Complete tools');
    expect(state.crop?.width).toBe(0.75);
    expect(state.healingSpots).toEqual(document.healingSpots);
    expect(state.masks).toEqual(document.masks);
    expect(state.curves?.red[2].y).toBe(150);

    document.masks[0].opacity = 10;
    document.healingSpots[0].mode = 'clone';
    expect(state.masks?.[0].opacity).toBe(100);
    expect(state.healingSpots?.[0].mode).toBe('heal');
  });
});

describe('Editor tools store correctness', () => {
  test('normalizes ratio-shaped crop updates and clamps transform fields', () => {
    const { updateCrop } = useEditorStore.getState();

    updateCrop({
      x: 0.1,
      y: 0.2,
      width: 0.8,
      height: 1,
      rotation: 450,
      straightenAngle: 90
    });

    let crop = useEditorStore.getState().currentDocument.crop;
    expect(crop.x).toBe(0.1);
    expect(crop.y).toBe(0);
    expect(crop.width / crop.height).toBeCloseTo(0.8);
    expect(crop.rotation).toBe(90);
    expect(crop.straightenAngle).toBe(45);

    updateCrop({ x: 0.95, width: 0.5, height: 0.5 });
    crop = useEditorStore.getState().currentDocument.crop;
    expect(crop.x).toBe(0.5);
    expect(crop.y).toBe(0);
    expect(crop.width + crop.x).toBeLessThanOrEqual(1);
    expect(crop.height + crop.y).toBeLessThanOrEqual(1);
  });

  test('preserves healing mode and brush metadata while normalizing values', () => {
    const { addHealingSpot } = useEditorStore.getState();
    const spotWithMetadata = {
      x: 1.5,
      y: -0.5,
      radius: 2,
      sourceX: -1,
      sourceY: 3,
      mode: 'clone' as const,
      opacity: 140,
      brushSize: 42,
      feather: 65
    };

    addHealingSpot(spotWithMetadata);
    const spot = useEditorStore.getState().currentDocument.healingSpots[0] as HealingSpot & {
      brushSize: number;
      feather: number;
    };

    expect(spot).toMatchObject({
      x: 1,
      y: 0,
      radius: 1,
      sourceX: 0,
      sourceY: 1,
      mode: 'clone',
      opacity: 100,
      brushSize: 42,
      feather: 65
    });
  });

  test('keeps active mask lifecycle consistent through add, remove, reset, undo, and initialize', () => {
    const initial = createNewEditDocument(project.assetId, project.sourceUri);
    initial.masks = [createMask('first'), createMask('second')];
    useEditorStore.getState().initializeSession(project, initial);

    let state = useEditorStore.getState();
    expect(state.activeMaskId).toBe('first');

    state.updateMask('first', {
      opacity: 150,
      exposure: 5,
      points: [{ x: -1, y: 2 }]
    });
    state = useEditorStore.getState();
    expect(state.currentDocument.masks[0]).toMatchObject({
      opacity: 100,
      exposure: 2,
      points: [{ x: 0, y: 1 }]
    });

    state.setActiveMaskId('second');
    state.removeMask('second');
    state = useEditorStore.getState();
    expect(state.activeMaskId).toBe('first');
    expect(state.currentDocument.masks.map(mask => mask.id)).toEqual(['first']);

    state.undo();
    state = useEditorStore.getState();
    expect(state.currentDocument.masks.map(mask => mask.id)).toEqual(['first', 'second']);
    expect(state.activeMaskId).toEqual(expect.stringMatching(/^first$|^second$/));
    expect(state.currentDocument.masks.some(mask => mask.id === state.activeMaskId)).toBe(true);

    state.redo();
    state = useEditorStore.getState();
    expect(state.currentDocument.masks).toHaveLength(1);
    expect(state.activeMaskId).toBe('first');

    state.addHealingSpot(createHealingSpot('heal-reset'));
    state.resetAllAdjustments();
    state = useEditorStore.getState();
    expect(state.activeMaskId).toBeNull();
    expect(state.currentDocument.masks).toEqual([]);
    expect(state.currentDocument.healingSpots).toEqual([]);
    state.undo();
    state = useEditorStore.getState();
    expect(state.currentDocument.masks).toHaveLength(1);
    expect(state.activeMaskId).toBe('first');
    expect(state.currentDocument.healingSpots).toHaveLength(1);

    const empty = createNewEditDocument(project.assetId, project.sourceUri);
    useEditorStore.getState().initializeSession(project, empty);
    expect(useEditorStore.getState().activeMaskId).toBeNull();

    state = useEditorStore.getState();
    state.addMask(createMask('generated-id'));
    const addedMaskId = useEditorStore.getState().activeMaskId;
    expect(addedMaskId).toBeTruthy();
    state.removeMask(addedMaskId as string);
    expect(useEditorStore.getState().activeMaskId).toBeNull();
    state.undo();
    state = useEditorStore.getState();
    expect(state.activeMaskId).toBe(addedMaskId);
    expect(state.currentDocument.masks.some(mask => mask.id === addedMaskId)).toBe(true);
  });

  test('applies a preset as one history entry and restores appliedPresetId on undo/redo', () => {
    const store = useEditorStore.getState();
    const preset = asPreset({
      colorGrading: { shadows: { hue: 180 } } as EditDocument['colorGrading'],
      hslMixer: [{ hue: 35 }] as unknown as EditDocument['hslMixer']
    });

    store.applyPreset(preset);
    let state = useEditorStore.getState();
    expect(state.currentDocument.appliedPresetId).toBe(preset.id);
    expect(state.currentDocument.colorGrading.shadows.hue).toBe(180);
    expect(state.currentDocument.hslMixer[0].hue).toBe(35);
    expect(state.historyManager.getDepth()).toEqual({ undo: 1, redo: 0 });

    state.undo();
    state = useEditorStore.getState();
    expect(state.currentDocument.appliedPresetId).toBeUndefined();
    expect(state.currentDocument.colorGrading.shadows.hue).toBe(0);
    expect(state.historyManager.getDepth()).toEqual({ undo: 0, redo: 1 });

    state.redo();
    expect(useEditorStore.getState().currentDocument.appliedPresetId).toBe(preset.id);

    // Tapping the same preset again de-selects it and restores baseline
    store.applyPreset(preset);
    state = useEditorStore.getState();
    expect(state.currentDocument.appliedPresetId).toBeUndefined();
    expect(state.currentDocument.colorGrading.shadows.hue).toBe(0);
    expect(state.currentDocument.hslMixer[0].hue).toBe(0);
  });

  test('deselectPreset explicitly reverts applied preset to baseline', () => {
    const store = useEditorStore.getState();
    const preset = asPreset({
      basic: { contrast: 30 } as unknown as EditDocument['basic']
    });

    store.applyPreset(preset);
    expect(useEditorStore.getState().currentDocument.appliedPresetId).toBe(preset.id);
    expect(useEditorStore.getState().currentDocument.basic.contrast).toBe(30);

    store.deselectPreset();
    expect(useEditorStore.getState().currentDocument.appliedPresetId).toBeUndefined();
    expect(useEditorStore.getState().currentDocument.basic.contrast).toBe(0);
  });

  test('coalesces slider updates between beginAdjustment and endAdjustment', () => {
    const store = useEditorStore.getState();
    store.beginAdjustment();
    store.updateBasic('exposure', 0.25);
    store.updateBasic('exposure', 0.5);
    store.updateBasic('exposure', 0.75);
    store.endAdjustment();

    expect(useEditorStore.getState().historyManager.getDepth()).toEqual({ undo: 1, redo: 0 });
    store.undo();
    expect(useEditorStore.getState().currentDocument.basic.exposure).toBe(0);
  });
});
