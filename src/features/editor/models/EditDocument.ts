import {
  BasicAdjustments,
  ColorGradingAdjustments,
  CropTransform,
  CurvePoint,
  EditDocument,
  HslMixerAdjustments,
  ToneCurvesAdjustments
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

export function createDefaultToneCurves(): ToneCurvesAdjustments {
  return {
    composite: [
      { x: 0, y: 0 },
      { x: 64, y: 64 },
      { x: 128, y: 128 },
      { x: 192, y: 192 },
      { x: 255, y: 255 }
    ],
    red: [
      { x: 0, y: 0 },
      { x: 64, y: 64 },
      { x: 128, y: 128 },
      { x: 192, y: 192 },
      { x: 255, y: 255 }
    ],
    green: [
      { x: 0, y: 0 },
      { x: 64, y: 64 },
      { x: 128, y: 128 },
      { x: 192, y: 192 },
      { x: 255, y: 255 }
    ],
    blue: [
      { x: 0, y: 0 },
      { x: 64, y: 64 },
      { x: 128, y: 128 },
      { x: 192, y: 192 },
      { x: 255, y: 255 }
    ]
  };
}

/**
 * Computes a 256-entry monotonic lookup table from a set of control points.
 */
export function interpolateCurveLut(points: CurvePoint[]): Uint8Array {
  const lut = new Uint8Array(256);
  if (!points || points.length === 0) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }

  // Sort points by X
  const sorted = [...points].sort((a, b) => a.x - b.x);

  // If only 1 point, flat fill
  if (sorted.length === 1) {
    const val = Math.max(0, Math.min(255, Math.round(sorted[0].y)));
    lut.fill(val);
    return lut;
  }

  // Linear / piecewise interpolation between sorted points
  let ptIdx = 0;
  for (let x = 0; x < 256; x++) {
    while (ptIdx < sorted.length - 2 && x > sorted[ptIdx + 1].x) {
      ptIdx++;
    }

    const p0 = sorted[ptIdx];
    const p1 = sorted[ptIdx + 1];

    if (x <= p0.x) {
      lut[x] = Math.max(0, Math.min(255, Math.round(p0.y)));
    } else if (x >= p1.x) {
      lut[x] = Math.max(0, Math.min(255, Math.round(p1.y)));
    } else {
      const t = (x - p0.x) / Math.max(1, p1.x - p0.x);
      // Smooth Hermite interpolation: 3t^2 - 2t^3
      const smoothT = t * t * (3 - 2 * t);
      const y = p0.y + (p1.y - p0.y) * smoothT;
      lut[x] = Math.max(0, Math.min(255, Math.round(y)));
    }
  }

  return lut;
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
    curves: createDefaultToneCurves(),
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
  if (!parsed.curves) {
    parsed.curves = createDefaultToneCurves();
  }
  return parsed as EditDocument;
}
