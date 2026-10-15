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
      },
      hslMixer: [
        { hue: 0, saturation: 10, luminance: 0 },
        { hue: 0, saturation: 15, luminance: 5 },
        { hue: 5, saturation: 18, luminance: 4 },
        { hue: 10, saturation: 28, luminance: -4 },
        { hue: 0, saturation: 22, luminance: 0 },
        { hue: -5, saturation: 24, luminance: -2 },
        { hue: 0, saturation: 0, luminance: 0 },
        { hue: 0, saturation: 0, luminance: 0 }
      ]
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
  },
  {
    id: 'preset_clean_portrait',
    name: 'Clean Portrait',
    category: 'built-in',
    createdAt: 1700000000000,
    documentState: {
      basic: {
        exposure: 0.08,
        contrast: -6,
        highlights: -18,
        shadows: 18,
        whites: 4,
        blacks: -3,
        temperature: 4,
        tint: 2,
        vibrance: 12,
        saturation: -4,
        clarity: -8,
        vignette: -8,
        grain: 0,
        sharpening: 18
      },
      colorGrading: {
        shadows: { hue: 215, saturation: 8, luminance: 2 },
        midtones: { hue: 28, saturation: 10, luminance: 3 },
        highlights: { hue: 38, saturation: 8, luminance: 4 },
        global: { hue: 30, saturation: 3, luminance: 0 },
        blending: 60,
        balance: 0
      }
    }
  },
  {
    id: 'preset_cool_urban_cinema',
    name: 'Cool Urban Cinema',
    category: 'built-in',
    createdAt: 1700000000000,
    documentState: {
      basic: {
        exposure: -0.05,
        contrast: 24,
        highlights: -16,
        shadows: 8,
        whites: 6,
        blacks: -18,
        temperature: -18,
        tint: 5,
        vibrance: 16,
        saturation: -6,
        clarity: 18,
        vignette: 18,
        grain: 12,
        sharpening: 28
      },
      colorGrading: {
        shadows: { hue: 205, saturation: 28, luminance: -5 },
        midtones: { hue: 190, saturation: 10, luminance: 0 },
        highlights: { hue: 42, saturation: 18, luminance: 3 },
        global: { hue: 205, saturation: 4, luminance: 0 },
        blending: 58,
        balance: 18
      }
    }
  },
  {
    id: 'preset_vintage_70s_film',
    name: 'Vintage 70s Film',
    category: 'built-in',
    createdAt: 1700000000000,
    documentState: {
      basic: {
        exposure: 0.05,
        contrast: -8,
        highlights: -22,
        shadows: 16,
        whites: -10,
        blacks: 14,
        temperature: 16,
        tint: 8,
        vibrance: 8,
        saturation: -8,
        clarity: -5,
        vignette: -18,
        grain: 28,
        sharpening: 15
      },
      colorGrading: {
        shadows: { hue: 140, saturation: 18, luminance: 2 },
        midtones: { hue: 40, saturation: 20, luminance: 0 },
        highlights: { hue: 50, saturation: 26, luminance: -2 },
        global: { hue: 35, saturation: 6, luminance: 0 },
        blending: 65,
        balance: -10
      },
      curves: {
        composite: [{ x: 0, y: 28 }, { x: 75, y: 72 }, { x: 185, y: 182 }, { x: 255, y: 242 }],
        red: [{ x: 0, y: 0 }, { x: 128, y: 132 }, { x: 255, y: 255 }],
        green: [{ x: 0, y: 0 }, { x: 128, y: 128 }, { x: 255, y: 255 }],
        blue: [{ x: 0, y: 20 }, { x: 128, y: 124 }, { x: 255, y: 235 }]
      }
    }
  },
  {
    id: 'preset_moody_storm',
    name: 'Moody Storm',
    category: 'built-in',
    createdAt: 1700000000000,
    documentState: {
      basic: {
        exposure: -0.20,
        contrast: 32,
        highlights: -35,
        shadows: -10,
        whites: 15,
        blacks: -25,
        temperature: -10,
        tint: -4,
        vibrance: 5,
        saturation: -25,
        clarity: 28,
        vignette: -30,
        grain: 10,
        sharpening: 35
      },
      colorGrading: {
        shadows: { hue: 210, saturation: 35, luminance: -10 },
        midtones: { hue: 215, saturation: 15, luminance: -4 },
        highlights: { hue: 45, saturation: 20, luminance: 2 },
        global: { hue: 210, saturation: 8, luminance: 0 },
        blending: 60,
        balance: 15
      }
    }
  },
  {
    id: 'preset_pastel_dream',
    name: 'Pastel Dream',
    category: 'built-in',
    createdAt: 1700000000000,
    documentState: {
      basic: {
        exposure: 0.35,
        contrast: -18,
        highlights: -15,
        shadows: 30,
        whites: 10,
        blacks: 12,
        temperature: 6,
        tint: 10,
        vibrance: 22,
        saturation: -8,
        clarity: -12,
        vignette: 0,
        grain: 0,
        sharpening: 14
      },
      colorGrading: {
        shadows: { hue: 280, saturation: 15, luminance: 5 },
        midtones: { hue: 340, saturation: 12, luminance: 3 },
        highlights: { hue: 55, saturation: 18, luminance: 5 },
        global: { hue: 330, saturation: 5, luminance: 0 },
        blending: 75,
        balance: -5
      }
    }
  },
  {
    id: 'preset_noir_high_contrast',
    name: 'Film Noir Contrast',
    category: 'built-in',
    createdAt: 1700000000000,
    documentState: {
      basic: {
        exposure: -0.05,
        contrast: 55,
        highlights: -10,
        shadows: -25,
        whites: 28,
        blacks: -35,
        temperature: 0,
        tint: 0,
        vibrance: -100,
        saturation: -100,
        clarity: 45,
        vignette: -40,
        grain: 35,
        sharpening: 50
      },
      curves: {
        composite: [{ x: 0, y: 0 }, { x: 64, y: 38 }, { x: 192, y: 220 }, { x: 255, y: 255 }],
        red: [{ x: 0, y: 0 }, { x: 128, y: 128 }, { x: 255, y: 255 }],
        green: [{ x: 0, y: 0 }, { x: 128, y: 128 }, { x: 255, y: 255 }],
        blue: [{ x: 0, y: 0 }, { x: 128, y: 128 }, { x: 255, y: 255 }]
      }
    }
  },
  {
    id: 'preset_cyberpunk_neon',
    name: 'Cyberpunk Neon',
    category: 'built-in',
    createdAt: 1700000000000,
    documentState: {
      basic: {
        exposure: -0.08,
        contrast: 36,
        highlights: 10,
        shadows: -12,
        whites: 20,
        blacks: -22,
        temperature: -12,
        tint: 25,
        vibrance: 40,
        saturation: 18,
        clarity: 25,
        vignette: -25,
        grain: 12,
        sharpening: 32
      },
      colorGrading: {
        shadows: { hue: 270, saturation: 48, luminance: -8 },
        midtones: { hue: 190, saturation: 30, luminance: 0 },
        highlights: { hue: 325, saturation: 55, luminance: 8 },
        global: { hue: 290, saturation: 12, luminance: 0 },
        blending: 70,
        balance: 20
      }
    }
  },
  {
    id: 'preset_warm_sunset_glow',
    name: 'Sunset Coral Glow',
    category: 'built-in',
    createdAt: 1700000000000,
    documentState: {
      basic: {
        exposure: 0.12,
        contrast: 16,
        highlights: -20,
        shadows: 18,
        whites: 14,
        blacks: -8,
        temperature: 35,
        tint: 14,
        vibrance: 28,
        saturation: 12,
        clarity: 12,
        vignette: -22,
        grain: 8,
        sharpening: 22
      },
      colorGrading: {
        shadows: { hue: 25, saturation: 30, luminance: -2 },
        midtones: { hue: 30, saturation: 38, luminance: 4 },
        highlights: { hue: 15, saturation: 48, luminance: 8 },
        global: { hue: 25, saturation: 10, luminance: 0 },
        blending: 68,
        balance: -8
      }
    }
  },
  {
    id: 'preset_nordic_crisp',
    name: 'Nordic Crisp Clean',
    category: 'built-in',
    createdAt: 1700000000000,
    documentState: {
      basic: {
        exposure: 0.22,
        contrast: 12,
        highlights: -30,
        shadows: 15,
        whites: 22,
        blacks: -6,
        temperature: -14,
        tint: -2,
        vibrance: 10,
        saturation: -18,
        clarity: 16,
        vignette: 0,
        grain: 0,
        sharpening: 26
      },
      colorGrading: {
        shadows: { hue: 200, saturation: 18, luminance: 0 },
        midtones: { hue: 205, saturation: 8, luminance: 2 },
        highlights: { hue: 190, saturation: 12, luminance: 4 },
        global: { hue: 0, saturation: 0, luminance: 0 },
        blending: 60,
        balance: 12
      }
    }
  },
  {
    id: 'preset_matte_aesthetic',
    name: 'Matte Film Aesthetic',
    category: 'built-in',
    createdAt: 1700000000000,
    documentState: {
      basic: {
        exposure: 0.05,
        contrast: -12,
        highlights: -28,
        shadows: 20,
        whites: -15,
        blacks: 25,
        temperature: 8,
        tint: -2,
        vibrance: 14,
        saturation: -10,
        clarity: -6,
        vignette: -12,
        grain: 20,
        sharpening: 16
      },
      curves: {
        composite: [{ x: 0, y: 34 }, { x: 80, y: 76 }, { x: 175, y: 170 }, { x: 255, y: 235 }],
        red: [{ x: 0, y: 0 }, { x: 128, y: 128 }, { x: 255, y: 255 }],
        green: [{ x: 0, y: 0 }, { x: 128, y: 128 }, { x: 255, y: 255 }],
        blue: [{ x: 0, y: 12 }, { x: 128, y: 126 }, { x: 255, y: 245 }]
      }
    }
  },
  {
    id: 'preset_emerald_forest',
    name: 'Emerald Forest',
    category: 'built-in',
    createdAt: 1700000000000,
    documentState: {
      basic: {
        exposure: 0.06,
        contrast: 22,
        highlights: -24,
        shadows: 16,
        whites: 8,
        blacks: -12,
        temperature: -4,
        tint: -12,
        vibrance: 30,
        saturation: 5,
        clarity: 18,
        vignette: -18,
        grain: 6,
        sharpening: 28
      },
      colorGrading: {
        shadows: { hue: 175, saturation: 32, luminance: -6 },
        midtones: { hue: 145, saturation: 20, luminance: 0 },
        highlights: { hue: 85, saturation: 25, luminance: 4 },
        global: { hue: 160, saturation: 6, luminance: 0 },
        blending: 62,
        balance: 8
      },
      hslMixer: [
        { hue: 0, saturation: 0, luminance: 0 },
        { hue: 0, saturation: 10, luminance: 0 },
        { hue: 20, saturation: -10, luminance: 0 },
        { hue: 15, saturation: 32, luminance: -8 },
        { hue: 0, saturation: 24, luminance: -4 },
        { hue: 0, saturation: 12, luminance: 0 },
        { hue: 0, saturation: 0, luminance: 0 },
        { hue: 0, saturation: 0, luminance: 0 }
      ]
    }
  },
  {
    id: 'preset_editorial_bronze',
    name: 'Editorial Bronze',
    category: 'built-in',
    createdAt: 1700000000000,
    documentState: {
      basic: {
        exposure: 0.10,
        contrast: 22,
        highlights: -16,
        shadows: 12,
        whites: 10,
        blacks: -10,
        temperature: 18,
        tint: 4,
        vibrance: 18,
        saturation: -2,
        clarity: 14,
        vignette: -16,
        grain: 8,
        sharpening: 24
      },
      colorGrading: {
        shadows: { hue: 30, saturation: 24, luminance: -6 },
        midtones: { hue: 38, saturation: 28, luminance: 2 },
        highlights: { hue: 45, saturation: 25, luminance: 6 },
        global: { hue: 32, saturation: 8, luminance: 0 },
        blending: 66,
        balance: -6
      }
    }
  }
];
