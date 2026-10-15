import {
  ColorGradingAdjustments,
  CropTransform,
  EditDocument,
  HealingSpot,
  HslMixerAdjustments,
  MaskAdjustment,
  Preset,
  ToneCurvesAdjustments
} from '../../../types';
import {
  cloneEditDocument,
  createDefaultCrop
} from '../models/EditDocument';
import { BUILT_IN_PRESETS } from './builtInPresets';

const MIN_CROP_SIZE = 0.000001;

type NormalizedPoint = { x: number; y: number };

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const cloneValue = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const clampFinite = (value: unknown, min: number, max: number, fallback: number): number => {
  const safeFallback = typeof fallback === 'number' && Number.isFinite(fallback) ? fallback : min;
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : safeFallback;
  return Math.max(min, Math.min(max, numeric));
};

const mergeRecord = <T extends object>(current: T, incoming: unknown): T => {
  if (!isRecord(incoming)) return cloneValue(current);
  return { ...cloneValue(current), ...cloneValue(incoming) } as T;
};

const normalizePoint = (
  point: Partial<NormalizedPoint> | undefined,
  fallback?: NormalizedPoint
): NormalizedPoint | undefined => {
  if (!point && !fallback) return undefined;
  return {
    x: clampFinite(point?.x, 0, 1, fallback?.x ?? 0),
    y: clampFinite(point?.y, 0, 1, fallback?.y ?? 0)
  };
};

const normalizeRotation = (value: unknown, fallback: number): number => {
  const safeFallback = typeof fallback === 'number' && Number.isFinite(fallback) ? fallback : 0;
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : safeFallback;
  const quarterTurns = Math.round(numeric / 90);
  return ((quarterTurns * 90) % 360 + 360) % 360;
};

export function normalizeCropTransform(
  crop: Partial<CropTransform> | undefined,
  fallback: CropTransform = createDefaultCrop()
): CropTransform {
  const fallbackWidth = clampFinite(fallback.width, MIN_CROP_SIZE, 1, 1);
  const fallbackHeight = clampFinite(fallback.height, MIN_CROP_SIZE, 1, 1);
  const width = clampFinite(crop?.width, MIN_CROP_SIZE, 1, fallbackWidth);
  const height = clampFinite(crop?.height, MIN_CROP_SIZE, 1, fallbackHeight);
  const x = clampFinite(
    crop?.x,
    0,
    Math.max(0, 1 - width),
    Math.min(clampFinite(fallback.x, 0, 1, 0), 1 - width)
  );
  const y = clampFinite(
    crop?.y,
    0,
    Math.max(0, 1 - height),
    Math.min(clampFinite(fallback.y, 0, 1, 0), 1 - height)
  );

  return {
    x,
    y,
    width,
    height,
    rotation: normalizeRotation(crop?.rotation, fallback.rotation),
    flipHorizontal: typeof crop?.flipHorizontal === 'boolean'
      ? crop.flipHorizontal
      : typeof fallback.flipHorizontal === 'boolean' ? fallback.flipHorizontal : false,
    flipVertical: typeof crop?.flipVertical === 'boolean'
      ? crop.flipVertical
      : typeof fallback.flipVertical === 'boolean' ? fallback.flipVertical : false,
    straightenAngle: clampFinite(crop?.straightenAngle, -45, 45, fallback.straightenAngle)
  };
}

export function normalizeHealingSpot(
  spot: Partial<HealingSpot> & Record<string, unknown>,
  fallback?: HealingSpot,
  fallbackId = 'heal_0'
): HealingSpot {
  const normalized = {
    ...(fallback ? cloneValue(fallback) : {}),
    ...cloneValue(spot)
  } as HealingSpot & Record<string, unknown>;

  normalized.id = typeof normalized.id === 'string' && normalized.id.length > 0
    ? normalized.id
    : fallback?.id || fallbackId;
  normalized.x = clampFinite(normalized.x, 0, 1, fallback?.x ?? 0);
  normalized.y = clampFinite(normalized.y, 0, 1, fallback?.y ?? 0);
  normalized.radius = clampFinite(normalized.radius, 0, 1, fallback?.radius ?? 0);
  normalized.sourceX = clampFinite(normalized.sourceX, 0, 1, fallback?.sourceX ?? normalized.x);
  normalized.sourceY = clampFinite(normalized.sourceY, 0, 1, fallback?.sourceY ?? normalized.y);
  normalized.mode = normalized.mode === 'clone' ? 'clone' : 'heal';
  normalized.opacity = clampFinite(normalized.opacity, 0, 100, fallback?.opacity ?? 100);

  return normalized;
}

export function normalizeMaskAdjustment(
  mask: Partial<MaskAdjustment> & Record<string, unknown>,
  fallback?: MaskAdjustment,
  fallbackId = 'mask_0'
): MaskAdjustment {
  const normalized = {
    ...(fallback ? cloneValue(fallback) : {}),
    ...cloneValue(mask)
  } as MaskAdjustment & Record<string, unknown>;

  normalized.id = typeof normalized.id === 'string' && normalized.id.length > 0
    ? normalized.id
    : fallback?.id || fallbackId;
  normalized.name = typeof normalized.name === 'string' && normalized.name.length > 0
    ? normalized.name
    : fallback?.name || 'Mask';
  normalized.type = normalized.type === 'linear' || normalized.type === 'radial'
    ? normalized.type
    : 'brush';
  normalized.inverted = typeof normalized.inverted === 'boolean'
    ? normalized.inverted
    : fallback?.inverted ?? false;
  normalized.opacity = clampFinite(normalized.opacity, 0, 100, fallback?.opacity ?? 100);
  normalized.exposure = clampFinite(normalized.exposure, -2, 2, fallback?.exposure ?? 0);
  normalized.contrast = clampFinite(normalized.contrast, -100, 100, fallback?.contrast ?? 0);
  normalized.saturation = clampFinite(normalized.saturation, -100, 100, fallback?.saturation ?? 0);
  normalized.temperature = clampFinite(normalized.temperature, -100, 100, fallback?.temperature ?? 0);
  normalized.highlights = clampFinite(normalized.highlights, -100, 100, fallback?.highlights ?? 0);
  normalized.shadows = clampFinite(normalized.shadows, -100, 100, fallback?.shadows ?? 0);

  const points = Array.isArray(normalized.points)
    ? normalized.points.map(point => normalizePoint(point) as NormalizedPoint)
    : fallback?.points?.map(point => ({ ...point }));
  if (points) normalized.points = points;

  const start = normalizePoint(normalized.start, fallback?.start);
  const end = normalizePoint(normalized.end, fallback?.end);
  const center = normalizePoint(normalized.center, fallback?.center);
  if (start) normalized.start = start;
  if (end) normalized.end = end;
  if (center) normalized.center = center;

  if (normalized.radiusX !== undefined || fallback?.radiusX !== undefined) {
    normalized.radiusX = clampFinite(normalized.radiusX, 0, 1, fallback?.radiusX ?? 0);
  }
  if (normalized.radiusY !== undefined || fallback?.radiusY !== undefined) {
    normalized.radiusY = clampFinite(normalized.radiusY, 0, 1, fallback?.radiusY ?? 0);
  }

  return normalized;
}

export function normalizeHealingSpots(
  spots: HealingSpot[] | undefined,
  fallback: HealingSpot[] = []
): HealingSpot[] {
  if (!Array.isArray(spots)) return [];
  return spots.map((spot, index) => {
    const rawSpot = (spot || {}) as Partial<HealingSpot> & Record<string, unknown>;
    const fallbackSpot = typeof rawSpot.id === 'string'
      ? fallback.find(candidate => candidate.id === rawSpot.id)
      : fallback[index];
    return normalizeHealingSpot(rawSpot, fallbackSpot, `heal_${index}`);
  });
}

export function normalizeMasks(
  masks: MaskAdjustment[] | undefined,
  fallback: MaskAdjustment[] = []
): MaskAdjustment[] {
  if (!Array.isArray(masks)) return [];
  return masks.map((mask, index) => {
    const rawMask = (mask || {}) as Partial<MaskAdjustment> & Record<string, unknown>;
    const fallbackMask = typeof rawMask.id === 'string'
      ? fallback.find(candidate => candidate.id === rawMask.id)
      : fallback[index];
    return normalizeMaskAdjustment(rawMask, fallbackMask, `mask_${index}`);
  });
}

export function normalizeEditDocumentToolState(document: EditDocument): EditDocument {
  const normalized = cloneEditDocument(document);
  normalized.crop = normalizeCropTransform(normalized.crop);
  normalized.healingSpots = normalizeHealingSpots(normalized.healingSpots);
  normalized.masks = normalizeMasks(normalized.masks);
  return normalized;
}

const mergeColorGrading = (
  current: ColorGradingAdjustments,
  incoming: unknown
): ColorGradingAdjustments => {
  if (!isRecord(incoming)) return cloneValue(current);
  const update = incoming as Partial<ColorGradingAdjustments>;
  return {
    ...cloneValue(current),
    ...cloneValue(update),
    shadows: mergeRecord(current.shadows, update.shadows),
    midtones: mergeRecord(current.midtones, update.midtones),
    highlights: mergeRecord(current.highlights, update.highlights),
    global: mergeRecord(current.global, update.global)
  };
};

const mergeHslMixer = (current: HslMixerAdjustments, incoming: unknown): HslMixerAdjustments => {
  if (!Array.isArray(incoming)) return cloneValue(current);
  const merged = current.map(channel => cloneValue(channel)) as HslMixerAdjustments;
  incoming.forEach((channel, index) => {
    if (index >= merged.length || !isRecord(channel)) return;
    merged[index] = mergeRecord(merged[index], channel);
  });
  return merged;
};

const mergeCurves = (current: ToneCurvesAdjustments, incoming: unknown): ToneCurvesAdjustments => {
  if (!isRecord(incoming)) return cloneValue(current);
  const merged = cloneValue(current);
  (['composite', 'red', 'green', 'blue'] as const).forEach(channel => {
    if (Array.isArray(incoming[channel])) {
      merged[channel] = cloneValue(incoming[channel]) as ToneCurvesAdjustments[typeof channel];
    }
  });
  return merged;
};

/**
 * Applies only the editable fields present in a preset. Object-valued controls
 * merge recursively, while supplied collection fields replace that collection
 * and are cloned so neither the preset nor the source document is mutated.
 */
export function applyPresetToDocument(document: EditDocument, preset: Preset): EditDocument {
  const updated = normalizeEditDocumentToolState(document);
  const state = preset.documentState || {};

  if (isRecord(state.basic)) {
    updated.basic = { ...updated.basic, ...cloneValue(state.basic) };
  }
  if (state.colorGrading) {
    updated.colorGrading = mergeColorGrading(updated.colorGrading, state.colorGrading);
  }
  if (state.hslMixer) {
    updated.hslMixer = mergeHslMixer(updated.hslMixer, state.hslMixer);
  }
  if (state.curves) {
    updated.curves = mergeCurves(updated.curves, state.curves);
  }
  if (state.crop) {
    updated.crop = normalizeCropTransform(state.crop, updated.crop);
  }
  if (Array.isArray(state.healingSpots)) {
    updated.healingSpots = normalizeHealingSpots(state.healingSpots, updated.healingSpots);
  }
  if (Array.isArray(state.masks)) {
    updated.masks = normalizeMasks(state.masks, updated.masks);
  }

  updated.appliedPresetId = preset.id;
  updated.updatedAt = Date.now();
  return updated;
}

export class PresetManager {
  private userPresets: Preset[] = [];

  constructor(initialUserPresets: Preset[] = []) {
    this.userPresets = [...initialUserPresets];
  }

  getAllPresets(): Preset[] {
    return [...BUILT_IN_PRESETS, ...this.userPresets];
  }

  getPresetById(id: string): Preset | undefined {
    return this.getAllPresets().find(p => p.id === id);
  }

  applyPreset(document: EditDocument, preset: Preset): EditDocument {
    return applyPresetToDocument(document, preset);
  }

  createUserPreset(name: string, document: EditDocument): Preset {
    const snapshot = normalizeEditDocumentToolState(document);
    const newPreset: Preset = {
      id: `usr_preset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      category: 'user',
      createdAt: Date.now(),
      documentState: {
        basic: cloneValue(snapshot.basic),
        colorGrading: cloneValue(snapshot.colorGrading),
        hslMixer: cloneValue(snapshot.hslMixer),
        curves: cloneValue(snapshot.curves),
        crop: cloneValue(snapshot.crop),
        healingSpots: cloneValue(snapshot.healingSpots),
        masks: cloneValue(snapshot.masks)
      }
    };
    this.userPresets.push(newPreset);
    return newPreset;
  }

  deleteUserPreset(id: string): boolean {
    const index = this.userPresets.findIndex(p => p.id === id);
    if (index !== -1) {
      this.userPresets.splice(index, 1);
      return true;
    }
    return false;
  }
}
