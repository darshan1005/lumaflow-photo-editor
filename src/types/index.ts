/**
 * Lumaflow Mobile - Global Type Definitions
 */

export interface BasicAdjustments {
  // Light & Exposure
  exposure: number;       // -2.0 to +2.0 EV
  contrast: number;       // -100 to +100
  highlights: number;     // -100 to +100
  shadows: number;        // -100 to +100
  whites: number;         // -100 to +100
  blacks: number;         // -100 to +100

  // White Balance & Color
  temperature: number;    // -100 (cool) to +100 (warm)
  tint: number;           // -100 (green) to +100 (magenta)
  vibrance: number;       // -100 to +100
  saturation: number;     // -100 to +100

  // Optics & Detail
  clarity: number;        // -100 to +100
  vignette: number;       // -100 to +100
  grain: number;          // 0 to 100
  sharpening: number;     // 0 to 100
}

export interface ColorWheelTone {
  hue: number;            // 0 to 360
  saturation: number;     // 0 to 100
  luminance: number;      // -100 to +100
}

export interface ColorGradingAdjustments {
  shadows: ColorWheelTone;
  midtones: ColorWheelTone;
  highlights: ColorWheelTone;
  global: ColorWheelTone;
  blending: number;       // 0 to 100
  balance: number;        // -100 to +100
}

export interface HslChannel {
  hue: number;            // -100 to +100
  saturation: number;     // -100 to +100
  luminance: number;      // -100 to +100
}

export type HslMixerAdjustments = [
  HslChannel, // Red (0)
  HslChannel, // Orange (1)
  HslChannel, // Yellow (2)
  HslChannel, // Green (3)
  HslChannel, // Aqua (4)
  HslChannel, // Blue (5)
  HslChannel, // Purple (6)
  HslChannel  // Magenta (7)
];

export interface CropTransform {
  x: number;              // 0.0 to 1.0 (normalized origin X)
  y: number;              // 0.0 to 1.0 (normalized origin Y)
  width: number;          // 0.0 to 1.0 (normalized width)
  height: number;         // 0.0 to 1.0 (normalized height)
  rotation: number;       // 0, 90, 180, 270 degrees
  flipHorizontal: boolean;
  flipVertical: boolean;
  straightenAngle: number;// -45 to +45 degrees
}

export interface HealingSpot {
  id: string;
  x: number;          // normalized 0.0 to 1.0
  y: number;          // normalized 0.0 to 1.0
  radius: number;     // normalized radius (e.g. 0.03 = 3% of image width)
  sourceX: number;    // sample point X
  sourceY: number;    // sample point Y
  mode: 'heal' | 'clone';
  opacity: number;
}

export type MaskType = 'brush' | 'linear' | 'radial';

export interface MaskAdjustment {
  id: string;
  name: string;
  type: MaskType;
  inverted: boolean;
  opacity: number;    // 0 to 100
  // Geometric parameters
  points?: Array<{ x: number; y: number }>; // for brush strokes
  start?: { x: number; y: number };          // for linear gradient
  end?: { x: number; y: number };            // for linear gradient
  center?: { x: number; y: number };         // for radial gradient
  radiusX?: number;                          // for radial gradient
  radiusY?: number;                          // for radial gradient
  // Local selective corrections
  exposure: number;   // -2.0 to +2.0
  contrast: number;   // -100 to +100
  saturation: number; // -100 to +100
  temperature: number;// -100 to +100
  highlights: number; // -100 to +100
  shadows: number;    // -100 to +100
}

export interface CurvePoint {
  x: number; // 0 to 255
  y: number; // 0 to 255
}

export interface ToneCurvesAdjustments {
  composite: CurvePoint[]; // Grey / RGB composite
  red: CurvePoint[];       // Red channel
  green: CurvePoint[];     // Green channel
  blue: CurvePoint[];      // Blue channel
}

export interface EditDocument {
  version: number;
  id: string;
  assetId: string;
  sourceUri: string;
  createdAt: number;
  updatedAt: number;
  appliedPresetId?: string;
  
  // Tonal & Color Adjustments
  basic: BasicAdjustments;
  colorGrading: ColorGradingAdjustments;
  hslMixer: HslMixerAdjustments;
  curves: ToneCurvesAdjustments;
  crop: CropTransform;

  // Selective Adjustments & Retouching
  healingSpots: HealingSpot[];
  masks: MaskAdjustment[];
}

export interface Preset {
  id: string;
  name: string;
  category: 'built-in' | 'user';
  createdAt: number;
  documentState: Partial<EditDocument>;
}

export interface ProjectMetadata {
  id: string;
  assetId: string;
  name: string;
  sourceUri: string;
  thumbnailUri?: string;
  originalWidth: number;
  originalHeight: number;
  createdAt: number;
  updatedAt: number;
}

export interface ExportOptions {
  format: 'jpeg' | 'png';
  quality: number;        // 0.1 to 1.0
  scale: number;          // 0.25, 0.5, 1.0
  customWidth?: number;
  customHeight?: number;
  preserveMetadata?: boolean;
}
