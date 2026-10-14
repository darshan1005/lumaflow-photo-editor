import {
  BasicAdjustments,
  ColorGradingAdjustments,
  CropTransform,
  EditDocument,
  HslMixerAdjustments
} from '../../../types';

export const CURRENT_DOCUMENT_VERSION = 1;

export function createDefaultBasicAdjustments(): BasicAdjustments {
  return {
    exposure: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    whites: 0,
    blacks: 0,
    temperature: 0,
    tint: 0,
    vibrance: 0,
    saturation: 0,
    clarity: 0,
    vignette: 0,
    grain: 0,
    sharpening: 0
  };
}

export function createDefaultColorGrading(): ColorGradingAdjustments {
  return {
    shadows: { hue: 0, saturation: 0, luminance: 0 },
    midtones: { hue: 0, saturation: 0, luminance: 0 },
    highlights: { hue: 0, saturation: 0, luminance: 0 },
    global: { hue: 0, saturation: 0, luminance: 0 },
    blending: 50,
    balance: 0
  };
}

export function createDefaultHslMixer(): HslMixerAdjustments {
  return [
    { hue: 0, saturation: 0, luminance: 0 }, // Red
    { hue: 0, saturation: 0, luminance: 0 }, // Orange
    { hue: 0, saturation: 0, luminance: 0 }, // Yellow
    { hue: 0, saturation: 0, luminance: 0 }, // Green
    { hue: 0, saturation: 0, luminance: 0 }, // Aqua
    { hue: 0, saturation: 0, luminance: 0 }, // Blue
    { hue: 0, saturation: 0, luminance: 0 }, // Purple
    { hue: 0, saturation: 0, luminance: 0 }  // Magenta
  ];
}

export function createDefaultCrop(): CropTransform {
  return {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    rotation: 0,
    flipHorizontal: false,
    flipVertical: false,
    straightenAngle: 0
  };
}

export function createNewEditDocument(assetId: string, sourceUri: string): EditDocument {
  const now = Date.now();
  return {
    version: CURRENT_DOCUMENT_VERSION,
    id: `doc_${now}_${Math.random().toString(36).substring(2, 9)}`,
    assetId,
    sourceUri,
    createdAt: now,
    updatedAt: now,
    basic: createDefaultBasicAdjustments(),
    colorGrading: createDefaultColorGrading(),
    hslMixer: createDefaultHslMixer(),
    crop: createDefaultCrop(),
    healingSpots: [],
    masks: []
  };
}

export function validateEditDocument(doc: EditDocument): boolean {
  if (!doc || doc.version !== CURRENT_DOCUMENT_VERSION) return false;
  if (!doc.basic || !doc.colorGrading || !doc.hslMixer || !doc.crop) return false;

  // Validate Basic Ranges
  const b = doc.basic;
  if (b.exposure < -2.0 || b.exposure > 2.0) return false;
  if (b.contrast < -100 || b.contrast > 100) return false;
  if (b.temperature < -100 || b.temperature > 100) return false;
  if (b.tint < -100 || b.tint > 100) return false;
  if (b.saturation < -100 || b.saturation > 100) return false;

  // Validate Crop Bounds
  const c = doc.crop;
  if (c.width <= 0 || c.width > 1 || c.height <= 0 || c.height > 1) return false;
  if (c.x < 0 || c.x + c.width > 1.0001 || c.y < 0 || c.y + c.height > 1.0001) return false;

  return true;
}

export function cloneEditDocument(doc: EditDocument): EditDocument {
  return JSON.parse(JSON.stringify(doc));
}

export function serializeEditDocument(doc: EditDocument): string {
  return JSON.stringify(doc);
}

export function deserializeEditDocument(json: string): EditDocument {
  const parsed = JSON.parse(json);
  if (parsed.version < CURRENT_DOCUMENT_VERSION) {
    // Migration hook
    parsed.version = CURRENT_DOCUMENT_VERSION;
  }
  return parsed as EditDocument;
}
