import { BasicAdjustments, ColorGradingAdjustments, HslMixerAdjustments } from '../../types';

export interface ColorGradingTransferTables {
  tableR: string;
  tableG: string;
  tableB: string;
}

/**
 * Helper to convert HSL to normalized RGB [0..1]
 */
export function hslToRgbNorm(hDeg: number, sRatio: number, lRatio: number = 0.5): [number, number, number] {
  const c = (1 - Math.abs(2 * lRatio - 1)) * sRatio;
  const hp = (((hDeg % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hp >= 0 && hp < 1) { r1 = c; g1 = x; }
  else if (hp >= 1 && hp < 2) { r1 = x; g1 = c; }
  else if (hp >= 2 && hp < 3) { g1 = c; b1 = x; }
  else if (hp >= 3 && hp < 4) { g1 = x; b1 = c; }
  else if (hp >= 4 && hp < 5) { r1 = x; b1 = c; }
  else if (hp >= 5 && hp < 6) { r1 = c; b1 = x; }
  const m = lRatio - c / 2;
  return [r1 + m, g1 + m, b1 + m];
}

/**
 * Computes per-channel chromatic and luminance deltas for a color grading wheel.
 * Chromatic displacement is strictly proportional to the user's chosen saturation.
 */
export function computeWheelChannelDeltas(
  hue: number,
  saturation: number,
  luminance: number
): [number, number, number] {
  let dR = 0, dG = 0, dB = 0;
  if (saturation > 0) {
    const sRatio = saturation / 100;
    const [r, g, b] = hslToRgbNorm(hue, sRatio, 0.5);
    // Neutral gray is 0.5. Chromatic displacement range is [-0.5, 0.5]
    // Multiplied by 0.75 for punchy, responsive grading
    dR = (r - 0.5) * 0.75;
    dG = (g - 0.5) * 0.75;
    dB = (b - 0.5) * 0.75;
  }
  const dLum = (luminance / 100) * 0.28;
  return [dR + dLum, dG + dLum, dB + dLum];
}

/**
 * Generates independent 33-point transfer tables for R, G, and B.
 * 
 * 1. Base Tone Curve:
 *    - Whites: ONLY modulates high luminance band (x in [0.65, 1.0])
 *    - Blacks: ONLY modulates deep dark luminance band (x in [0.0, 0.35])
 *    - Highlights & Shadows: targets mid-high and mid-low registers
 * 
 * 2. 3-Way Color Grading:
 *    - Shadows: STRICTLY targets dark tones (x < shadowCutoff). Highlights are 100% untouched.
 *    - Highlights: STRICTLY targets bright tones (x > highlightCutoff). Shadows are 100% untouched.
 *    - Midtones: Bell curve targeting middle gray, protecting both deep blacks and specular whites.
 *    - Global: Master grade across all tones.
 *    - Balance: Shifts the crossover midpoint between shadows and highlights.
 *    - Blending: Adjusts the transition overlap width.
 */
export function generateColorGradingTables(
  whites: number,
  blacks: number,
  highlights: number,
  shadows: number,
  g?: ColorGradingAdjustments
): ColorGradingTransferTables {
  const steps = 33;
  const valuesR: number[] = [];
  const valuesG: number[] = [];
  const valuesB: number[] = [];

  const wFactor = whites / 100;
  const bFactor = blacks / 100;
  const hFactor = highlights / 100;
  const sFactor = shadows / 100;

  // Grade wheel channel deltas
  const [sR, sG, sB] = g ? computeWheelChannelDeltas(g.shadows.hue, g.shadows.saturation, g.shadows.luminance) : [0, 0, 0];
  const [mR, mG, mB] = g ? computeWheelChannelDeltas(g.midtones.hue, g.midtones.saturation, g.midtones.luminance) : [0, 0, 0];
  const [hR, hG, hB] = g ? computeWheelChannelDeltas(g.highlights.hue, g.highlights.saturation, g.highlights.luminance) : [0, 0, 0];
  const [globR, globG, globB] = g ? computeWheelChannelDeltas(g.global.hue, g.global.saturation, g.global.luminance) : [0, 0, 0];

  const balance = g?.balance ?? 0;
  const blending = g?.blending ?? 50;

  // Midpoint shifted by balance (-100 to +100 shifts between 0.32 and 0.68)
  const centerPoint = 0.50 + (balance / 100) * 0.18;
  // Blend width controlled by blending (0 to 100 gives 0.22 to 0.58)
  const blendWidth = 0.22 + (blending / 100) * 0.36;

  const shadowCutoff = Math.min(0.85, Math.max(0.20, centerPoint + blendWidth * 0.5));
  const highlightCutoff = Math.max(0.15, Math.min(0.80, centerPoint - blendWidth * 0.5));

  for (let i = 0; i < steps; i++) {
    const x = i / (steps - 1);

    // 1. Blacks: targets ONLY x in [0.0, 0.35]
    let deltaBlack = 0;
    if (x < 0.35) {
      const wBlack = Math.pow((0.35 - x) / 0.35, 1.8);
      if (bFactor > 0) {
        deltaBlack = bFactor * 0.30 * wBlack;
      } else {
        deltaBlack = bFactor * 0.40 * wBlack * (x + 0.15);
      }
    }

    // 2. Whites: targets ONLY x in [0.65, 1.0]
    let deltaWhite = 0;
    if (x > 0.65) {
      const wWhite = Math.pow((x - 0.65) / 0.35, 1.8);
      deltaWhite = wFactor * 0.35 * wWhite;
    }

    // 3. Highlights: targets [0.45, 0.95]
    let deltaHigh = 0;
    if (x > 0.45 && x < 0.95) {
      const wHigh = Math.sin(((x - 0.45) / 0.50) * Math.PI);
      deltaHigh = hFactor * 0.18 * wHigh;
    }

    // 4. Shadows: targets [0.05, 0.55]
    let deltaShadow = 0;
    if (x > 0.05 && x < 0.55) {
      const wShadow = Math.sin(((x - 0.05) / 0.50) * Math.PI);
      deltaShadow = sFactor * 0.18 * wShadow;
    }

    const yBase = Math.max(0, Math.min(1, x + deltaBlack + deltaWhite + deltaHigh + deltaShadow));

    // Color Grading Tonal Isolation Weights:
    // Shadows: strictly zero for x >= shadowCutoff (bright highlights stay 100% clean)
    const wS = x < shadowCutoff ? Math.pow((shadowCutoff - x) / shadowCutoff, 1.6) : 0;

    // Highlights: strictly zero for x <= highlightCutoff (dark shadows stay 100% clean)
    const wH = x > highlightCutoff ? Math.pow((x - highlightCutoff) / (1.0 - highlightCutoff), 1.6) : 0;

    // Midtones: bell curve peaking at centerPoint, zero at both pure black and pure white
    const wM = Math.max(0, 1.0 - wS - wH);

    // Apply per-channel modulations
    const yR = Math.max(0, Math.min(1, yBase + wS * sR + wM * mR + wH * hR + globR));
    const yG = Math.max(0, Math.min(1, yBase + wS * sG + wM * mG + wH * hG + globG));
    const yB = Math.max(0, Math.min(1, yBase + wS * sB + wM * mB + wH * hB + globB));

    valuesR.push(parseFloat(yR.toFixed(4)));
    valuesG.push(parseFloat(yG.toFixed(4)));
    valuesB.push(parseFloat(yB.toFixed(4)));
  }

  return {
    tableR: valuesR.join(' '),
    tableG: valuesG.join(' '),
    tableB: valuesB.join(' ')
  };
}

export interface HslMixerCoefficients {
  r_r: number; r_g: number; r_b: number; r_const: number;
  g_r: number; g_g: number; g_b: number; g_const: number;
  b_r: number; b_g: number; b_b: number; b_const: number;
}

/**
 * Computes the 3x4 affine color matrix coefficients for the 8-channel HSL mixer.
 * Channel 0: Red
 * Channel 1: Orange
 * Channel 2: Yellow
 * Channel 3: Green
 * Channel 4: Aqua
 * Channel 5: Blue
 * Channel 6: Purple
 * Channel 7: Magenta
 */
export function computeHslMixerCoefficients(m?: HslMixerAdjustments): HslMixerCoefficients {
  // Identity baseline
  let r_r = 1.0, r_g = 0.0, r_b = 0.0, r_const = 0.0;
  let g_r = 0.0, g_g = 1.0, g_b = 0.0, g_const = 0.0;
  let b_r = 0.0, b_g = 0.0, b_b = 1.0, b_const = 0.0;

  if (!m) {
    return { r_r, r_g, r_b, r_const, g_r, g_g, g_b, g_const, b_r, b_g, b_b, b_const };
  }

  // 0. Red Channel (Affects reds: hue shifts toward yellow or magenta)
  const red = m[0];
  if (red) {
    const h = red.hue / 100; // -1 to +1
    const s = red.saturation / 100;
    const l = red.luminance / 100;
    if (h > 0) {
      g_r += h * 0.45; // Shift red toward orange/yellow (add green to red channel)
    } else if (h < 0) {
      b_r += (-h) * 0.45; // Shift red toward magenta (add blue to red channel)
    }
    r_r += s * 0.40;
    r_const += l * 0.15;
  }

  // 1. Orange Channel (Skin tones: hue shifts toward red or yellow)
  const orange = m[1];
  if (orange) {
    const h = orange.hue / 100;
    const s = orange.saturation / 100;
    const l = orange.luminance / 100;
    if (h > 0) {
      g_r += h * 0.35; // Shift orange toward yellow
      g_g += h * 0.15;
    } else if (h < 0) {
      r_g += (-h) * 0.35; // Shift orange toward deep red
    }
    r_r += s * 0.25;
    g_g += s * 0.20;
    r_const += l * 0.14;
    g_const += l * 0.10;
  }

  // 2. Yellow Channel (Foliage/warm lights: hue shifts toward orange or green)
  const yellow = m[2];
  if (yellow) {
    const h = yellow.hue / 100;
    const s = yellow.saturation / 100;
    const l = yellow.luminance / 100;
    if (h > 0) {
      g_r += h * 0.35; // Shift yellow toward green
      r_g -= h * 0.20;
    } else if (h < 0) {
      r_g += (-h) * 0.35; // Shift yellow toward warm orange
      g_r -= (-h) * 0.15;
    }
    r_r += s * 0.25;
    g_g += s * 0.25;
    r_const += l * 0.12;
    g_const += l * 0.12;
  }

  // 3. Green Channel (Grass/trees: hue shifts toward yellow or aqua)
  const green = m[3];
  if (green) {
    const h = green.hue / 100;
    const s = green.saturation / 100;
    const l = green.luminance / 100;
    if (h > 0) {
      b_g += h * 0.55; // Shift green toward emerald/aqua (add blue to green)
      r_g -= h * 0.20;
    } else if (h < 0) {
      r_g += (-h) * 0.55; // Shift green toward warm olive/yellow (add red to green)
      b_g -= (-h) * 0.20;
    }
    g_g += s * 0.45;
    g_const += l * 0.18;
  }

  // 4. Aqua Channel (Cyan water/tropical skies: hue shifts toward green or blue)
  const aqua = m[4];
  if (aqua) {
    const h = aqua.hue / 100;
    const s = aqua.saturation / 100;
    const l = aqua.luminance / 100;
    if (h > 0) {
      b_g += h * 0.35; // Shift aqua toward deep blue
      g_b -= h * 0.20;
    } else if (h < 0) {
      g_b += (-h) * 0.35; // Shift aqua toward green
      b_g -= (-h) * 0.20;
    }
    g_g += s * 0.25;
    b_b += s * 0.25;
    g_const += l * 0.14;
    b_const += l * 0.14;
  }

  // 5. Blue Channel (Skies/water: hue shifts toward aqua/teal or purple)
  const blue = m[5];
  if (blue) {
    const h = blue.hue / 100;
    const s = blue.saturation / 100;
    const l = blue.luminance / 100;
    if (h > 0) {
      r_b += h * 0.55; // Shift blue toward purple/violet (add red to blue)
      g_b -= h * 0.20;
    } else if (h < 0) {
      g_b += (-h) * 0.55; // Shift blue toward teal/aqua (add green to blue)
      r_b -= (-h) * 0.20;
    }
    b_b += s * 0.45;
    b_const += l * 0.18;
  }

  // 6. Purple Channel (Violets/florals: hue shifts toward blue or magenta)
  const purple = m[6];
  if (purple) {
    const h = purple.hue / 100;
    const s = purple.saturation / 100;
    const l = purple.luminance / 100;
    if (h > 0) {
      r_b += h * 0.35; // Shift purple toward magenta
    } else if (h < 0) {
      b_r += (-h) * 0.35; // Shift purple toward blue
    }
    r_r += s * 0.25;
    b_b += s * 0.25;
    r_const += l * 0.14;
    b_const += l * 0.14;
  }

  // 7. Magenta Channel (Pink/sunset highlights: hue shifts toward purple or red)
  const magenta = m[7];
  if (magenta) {
    const h = magenta.hue / 100;
    const s = magenta.saturation / 100;
    const l = magenta.luminance / 100;
    if (h > 0) {
      r_b -= h * 0.30;
      r_r += h * 0.30; // Shift magenta toward red
    } else if (h < 0) {
      b_r += (-h) * 0.40; // Shift magenta toward purple
    }
    r_r += s * 0.35;
    b_b += s * 0.35;
    r_const += l * 0.16;
    b_const += l * 0.16;
  }

  return { r_r, r_g, r_b, r_const, g_r, g_g, g_b, g_const, b_r, b_g, b_b, b_const };
}

/**
 * Generates the SVG 4x5 feColorMatrix value string for the HSL Mixer
 */
export function generateHslMixerMatrix(m?: HslMixerAdjustments): string {
  const c = computeHslMixerCoefficients(m);
  return [
    c.r_r.toFixed(3), c.r_g.toFixed(3), c.r_b.toFixed(3), '0', c.r_const.toFixed(3),
    c.g_r.toFixed(3), c.g_g.toFixed(3), c.g_b.toFixed(3), '0', c.g_const.toFixed(3),
    c.b_r.toFixed(3), c.b_g.toFixed(3), c.b_b.toFixed(3), '0', c.b_const.toFixed(3),
    '0', '0', '0', '1', '0'
  ].join(' ');
}
