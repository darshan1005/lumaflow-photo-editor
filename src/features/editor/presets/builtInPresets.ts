import { Preset } from '../../../types';

export const BUILT_IN_PRESETS: Preset[] = [
  {
    id: 'preset_vivid_nature',
    name: 'Vivid Nature',
    category: 'built-in',
    createdAt: 1700000000000,
    documentState: {
      basic: {
        exposure: 0.1,
        contrast: 20,
        highlights: -15,
        shadows: 20,
        whites: 10,
        blacks: -10,
        temperature: 4,
        tint: -6,
        vibrance: 25,
        saturation: 10,
        clarity: 15,
        vignette: -10,
        grain: 0,
        sharpening: 25
      }
    }
  },
  {
    id: 'preset_golden_hour',
    name: 'Golden Hour Warmth',
    category: 'built-in',
    createdAt: 1700000000000,
    documentState: {
      basic: {
        exposure: 0.15,
        contrast: 18,
        highlights: -25,
        shadows: 25,
        whites: 8,
        blacks: -4,
        temperature: 28,
        tint: 6,
        vibrance: 20,
        saturation: 8,
        clarity: 10,
        vignette: -15,
        grain: 10,
        sharpening: 20
      },
      colorGrading: {
        shadows: { hue: 240, saturation: 18, luminance: -4 },
        midtones: { hue: 35, saturation: 25, luminance: 4 },
        highlights: { hue: 45, saturation: 35, luminance: 8 },
        global: { hue: 38, saturation: 6, luminance: 0 },
        blending: 70,
        balance: -15
      }
    }
  },
  {
    id: 'preset_cinematic_teal_orange',
    name: 'Cinematic Teal & Orange',
    category: 'built-in',
    createdAt: 1700000000000,
    documentState: {
      basic: {
        exposure: 0.05,
        contrast: 28,
        highlights: -20,
        shadows: 15,
        whites: 12,
        blacks: -14,
        temperature: 6,
        tint: -4,
        vibrance: 20,
        saturation: 8,
        clarity: 20,
        vignette: -20,
        grain: 15,
        sharpening: 30
      },
      colorGrading: {
        shadows: { hue: 195, saturation: 42, luminance: -6 },
        midtones: { hue: 32, saturation: 22, luminance: 0 },
        highlights: { hue: 38, saturation: 46, luminance: 6 },
        global: { hue: 0, saturation: 0, luminance: 0 },
        blending: 65,
        balance: 10
      }
    }
  },
  {
    id: 'preset_monochrome_fineart',
    name: 'Monochrome Fine Art',
    category: 'built-in',
    createdAt: 1700000000000,
    documentState: {
      basic: {
        exposure: 0.1,
        contrast: 35,
        highlights: -25,
        shadows: 25,
        whites: 18,
        blacks: -16,
        temperature: 0,
        tint: 0,
        vibrance: -100,
        saturation: -100,
        clarity: 30,
        vignette: -25,
        grain: 25,
        sharpening: 40
      }
    }
  }
];
