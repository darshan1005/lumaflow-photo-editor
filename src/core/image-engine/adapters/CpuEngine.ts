import {
  EditDocument,
  ExportOptions,
  HslMixerAdjustments,
  MaskAdjustment
} from '../../../types';
import { IImageEngine } from '../interfaces/ImageEngine';

type Point = { x: number; y: number };

type HealingSpotWithFeather = EditDocument['healingSpots'][number] & {
  feather?: number;
};

type MaskWithBrushOptions = MaskAdjustment & {
  brushRadius?: number;
  feather?: number;
};

interface GlobalSettings {
  exposureScale: number;
  wbR: number;
  wbG: number;
  wbB: number;
  compositeCurve: Uint8Array;
  redCurve: Uint8Array;
  greenCurve: Uint8Array;
  blueCurve: Uint8Array;
  shadowsTint: [number, number, number];
  midtonesTint: [number, number, number];
  highlightsTint: [number, number, number];
  globalTint: [number, number, number];
  shadowsLuma: number;
  midtonesLuma: number;
  highlightsLuma: number;
  globalLuma: number;
  midThreshold: number;
  blendWidth: number;
}

const IDENTITY_HSL_CHANNEL = { hue: 0, saturation: 0, luminance: 0 };

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function finiteOr(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? value as number : fallback;
}

function clampPercent(value: number | undefined, fallback = 100): number {
  return clamp(finiteOr(value, fallback) / 100, 0, 1);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function distanceSquared(a: Point, b: Point, aspectRatio: number): number {
  const dx = a.x - b.x;
  const dy = (a.y - b.y) * aspectRatio;
  return dx * dx + dy * dy;
}

/**
 * Return the spatial contribution of a mask at normalized source coordinates.
 * `aspectRatio` is height / width, which keeps brush radii expressed in source
 * width units circular on non-square images. The returned value includes both
 * inversion and the mask opacity.
 */
export function maskWeight(
  mask: MaskAdjustment,
  x: number,
  y: number,
  aspectRatio = 1
): number {
  const extended = mask as MaskWithBrushOptions;
  const aspect = Math.max(1e-6, finiteOr(aspectRatio, 1));
  const point = { x, y };
  let spatial = 0;

  if (mask.type === 'linear') {
    const start = mask.start;
    const end = mask.end;
    if (start && end) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const lengthSquared = dx * dx + dy * dy;
      if (lengthSquared < 1e-12) {
        spatial = distanceSquared(point, start, aspect) < 1e-8 ? 1 : 0;
      } else {
        // Projection gives a real plateau before start and a hard zero after
        // end, while smoothstep makes the transition feathered.
        const projection = ((x - start.x) * dx + (y - start.y) * dy) / lengthSquared;
        spatial = projection <= 0 ? 1 : projection >= 1 ? 0 : 1 - smoothstep(0, 1, projection);
      }
    }
  } else if (mask.type === 'radial') {
    const center = mask.center || { x: 0.5, y: 0.5 };
    const radiusX = Math.max(1e-6, finiteOr(mask.radiusX, 0.35));
    const radiusY = Math.max(1e-6, finiteOr(mask.radiusY, 0.35));
    const normalizedDistance = Math.sqrt(
      Math.pow((x - center.x) / radiusX, 2) +
      Math.pow(((y - center.y) * aspect) / radiusY, 2)
    );
    spatial = 1 - smoothstep(0, 1, normalizedDistance);
  } else if (mask.type === 'brush') {
    const points = mask.points || [];
    const brushRadius = Math.max(1e-6, finiteOr(extended.brushRadius, 0.04));
    const feather = clamp(finiteOr(extended.feather, 50), 0, 100) / 100;
    let strongestDab = 0;

    // Each point is an independent dab. In particular, this intentionally
    // does not turn a sparse point list into an unintended connecting stroke.
    for (const dab of points) {
      const distance = Math.sqrt(distanceSquared(point, dab, aspect)) / brushRadius;
      const dabWeight = distance <= 1 - feather
        ? 1
        : feather <= 0
          ? 0
          : 1 - smoothstep(1 - feather, 1, distance);
      strongestDab = Math.max(strongestDab, dabWeight);
    }
    spatial = strongestDab;
  }

  const invertedSpatial = mask.inverted ? 1 - spatial : spatial;
  return clamp(invertedSpatial) * clampPercent(mask.opacity, 100);
}

export class CpuImageEngine implements IImageEngine {
  async initialize(): Promise<void> {
    // No-op for CPU engine
  }

  async loadImage(uri: string): Promise<{ width: number; height: number }> {
    return { width: 1920, height: 1080 };
  }

  // Linearize sRGB to radiometric space.
  private srgbToLinear(c: number): number {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  // De-linearize back to perceptual sRGB.
  private linearToSrgb(c: number): number {
    const clamped = clamp(c);
    return clamped <= 0.0031308
      ? clamped * 12.92
      : 1.055 * Math.pow(clamped, 1.0 / 2.4) - 0.055;
  }

  // RGB [0..1] to HSL [0..1].
  private rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const l = (max + min) * 0.5;
    let s = 0;
    let h = 0;

    if (delta > 1e-5) {
      s = l > 0.5 ? delta / (2.0 - max - min) : delta / (max + min);
      if (max === r) {
        h = (g - b) / delta + (g < b ? 6.0 : 0.0);
      } else if (max === g) {
        h = (b - r) / delta + 2.0;
      } else {
        h = (r - g) / delta + 4.0;
      }
      h /= 6.0;
    }
    return [h, s, l];
  }

  private hue2rgb(p: number, q: number, t: number): number {
    let wrapped = t;
    if (wrapped < 0) wrapped += 1.0;
    if (wrapped > 1) wrapped -= 1.0;
    if (wrapped < 1.0 / 6.0) return p + (q - p) * 6.0 * wrapped;
    if (wrapped < 1.0 / 2.0) return q;
    if (wrapped < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - wrapped) * 6.0;
    return p;
  }

  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    if (s < 1e-5) return [l, l, l];
    const q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
    const p = 2.0 * l - q;
    return [
      this.hue2rgb(p, q, h + 1.0 / 3.0),
      this.hue2rgb(p, q, h),
      this.hue2rgb(p, q, h - 1.0 / 3.0)
    ];
  }

  private hueDistance(h1: number, h2: number): number {
    const d = Math.abs(h1 - h2);
    return d > 0.5 ? 1.0 - d : d;
  }

  /**
   * Move a channel toward the endpoint selected by a signed tone control.
   * Positive values lift toward white and negative values pull toward black.
   * Applying the signed amount to the selected endpoint is important for
   * whites/blacks: `(1 - channel) * negativeAmount` barely changes an already
   * bright pixel, which makes the negative control appear to do nothing.
   */
  private applyToneEndpoint(value: number, amount: number, weight: number, strength = 0.48): number {
    const adjustment = amount * strength * weight;
    return adjustment >= 0
      ? clamp(value + (1 - value) * adjustment)
      : clamp(value * (1 + adjustment));
  }

  private createCurveLut(points: Array<{ x: number; y: number }> | undefined): Uint8Array {
    const lut = new Uint8Array(256);
    if (!points || points.length === 0) {
      for (let i = 0; i < 256; i++) lut[i] = i;
      return lut;
    }

    const sorted = [...points].sort((a, b) => a.x - b.x);
    for (let x = 0; x < 256; x++) {
      if (x <= sorted[0].x) {
        lut[x] = clamp(Math.round(sorted[0].y), 0, 255);
        continue;
      }
      if (x >= sorted[sorted.length - 1].x) {
        lut[x] = clamp(Math.round(sorted[sorted.length - 1].y), 0, 255);
        continue;
      }

      let right = 1;
      while (right < sorted.length && x > sorted[right].x) right++;
      const leftPoint = sorted[right - 1];
      const rightPoint = sorted[right];
      const span = Math.max(1e-6, rightPoint.x - leftPoint.x);
      const t = (x - leftPoint.x) / span;
      lut[x] = clamp(Math.round(leftPoint.y + (rightPoint.y - leftPoint.y) * t), 0, 255);
    }
    return lut;
  }

  private buildGlobalSettings(doc: EditDocument): GlobalSettings {
    const b = doc.basic;
    const grading = doc.colorGrading;
    const curves = doc.curves || {} as EditDocument['curves'];
    const shadows = grading?.shadows || IDENTITY_HSL_CHANNEL;
    const midtones = grading?.midtones || IDENTITY_HSL_CHANNEL;
    const highlights = grading?.highlights || IDENTITY_HSL_CHANNEL;
    const global = grading?.global || IDENTITY_HSL_CHANNEL;

    const tempNorm = finiteOr(b.temperature, 0) / 100;
    const tintNorm = finiteOr(b.tint, 0) / 100;
    let wbR = 1;
    let wbG = 1;
    let wbB = 1;
    if (tempNorm > 0) {
      wbR += tempNorm * 0.42;
      wbG += tempNorm * 0.08;
      wbB -= tempNorm * 0.38;
    } else {
      wbR += tempNorm * 0.32;
      wbG += tempNorm * 0.04;
      wbB -= tempNorm * 0.45;
    }
    if (tintNorm > 0) {
      wbR += tintNorm * 0.16;
      wbG -= tintNorm * 0.32;
      wbB += tintNorm * 0.16;
    } else {
      wbR += tintNorm * 0.14;
      wbG -= tintNorm * 0.30;
      wbB += tintNorm * 0.08;
    }

    const makeTint = (tone: typeof IDENTITY_HSL_CHANNEL): [number, number, number] => {
      const rgb = this.hslToRgb(finiteOr(tone.hue, 0) / 360, 1, 0.5);
      const amount = finiteOr(tone.saturation, 0) / 100 * 0.6;
      return [
        (rgb[0] - 0.5) * amount,
        (rgb[1] - 0.5) * amount,
        (rgb[2] - 0.5) * amount
      ];
    };

    return {
      exposureScale: Math.pow(2, finiteOr(b.exposure, 0)),
      wbR,
      wbG,
      wbB,
      compositeCurve: this.createCurveLut(curves?.composite),
      redCurve: this.createCurveLut(curves?.red),
      greenCurve: this.createCurveLut(curves?.green),
      blueCurve: this.createCurveLut(curves?.blue),
      shadowsTint: makeTint(shadows),
      midtonesTint: makeTint(midtones),
      highlightsTint: makeTint(highlights),
      globalTint: makeTint(global),
      shadowsLuma: finiteOr(shadows.luminance, 0) / 100 * 0.3,
      midtonesLuma: finiteOr(midtones.luminance, 0) / 100 * 0.3,
      highlightsLuma: finiteOr(highlights.luminance, 0) / 100 * 0.3,
      globalLuma: finiteOr(global.luminance, 0) / 100 * 0.3,
      midThreshold: clamp(0.5 + finiteOr(grading?.balance, 0) / 100 * 0.25, 0.1, 0.9),
      blendWidth: 0.2 + finiteOr(grading?.blending, 50) / 100 * 0.5
    };
  }

  private samplePixel(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    x: number,
    y: number
  ): [number, number, number, number] {
    const px = clamp(Math.round(x), 0, width - 1);
    const py = clamp(Math.round(y), 0, height - 1);
    const offset = (py * width + px) * 4;
    return [pixels[offset], pixels[offset + 1], pixels[offset + 2], pixels[offset + 3]];
  }

  private sampleNormalized(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    x: number,
    y: number
  ): [number, number, number, number] {
    const fx = clamp(x) * width - 0.5;
    const fy = clamp(y) * height - 0.5;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const p00 = this.samplePixel(pixels, width, height, x0, y0);
    const p10 = this.samplePixel(pixels, width, height, x0 + 1, y0);
    const p01 = this.samplePixel(pixels, width, height, x0, y0 + 1);
    const p11 = this.samplePixel(pixels, width, height, x0 + 1, y0 + 1);
    return [0, 1, 2, 3].map(channel =>
      p00[channel] * (1 - tx) * (1 - ty) +
      p10[channel] * tx * (1 - ty) +
      p01[channel] * (1 - tx) * ty +
      p11[channel] * tx * ty
    ) as [number, number, number, number];
  }

  private applyHealing(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    spots: HealingSpotWithFeather[] | undefined
  ): Uint8ClampedArray {
    const result = new Uint8ClampedArray(pixels);
    if (!spots || spots.length === 0 || width <= 0 || height <= 0) return result;
    const original = new Uint8ClampedArray(pixels);
    const aspect = height / Math.max(1, width);

    for (const spot of spots) {
      const center = { x: finiteOr(spot.x, 0.5), y: finiteOr(spot.y, 0.5) };
      const sourceCenter = { x: finiteOr(spot.sourceX, center.x), y: finiteOr(spot.sourceY, center.y) };
      const radius = Math.max(1e-6, finiteOr(spot.radius, 0.03));
      const feather = clamp(finiteOr(spot.feather, 50), 0, 100) / 100;
      const fullRadius = radius * (1 - feather);
      const opacity = clampPercent(spot.opacity, 100);
      if (opacity <= 0) continue;

      let correction: [number, number, number] = [0, 0, 0];
      if (spot.mode === 'heal') {
        // Match the donor patch's average color to the destination boundary.
        // This preserves donor texture while preventing a visible hard-edged
        // color seam, which is the useful local behavior of healing here.
        const boundarySamples = 32;
        const destinationAverage = [0, 0, 0];
        const donorAverage = [0, 0, 0];
        for (let sample = 0; sample < boundarySamples; sample++) {
          const angle = sample / boundarySamples * Math.PI * 2;
          const dx = Math.cos(angle) * radius;
          const dy = Math.sin(angle) * radius / aspect;
          const destination = this.sampleNormalized(result, width, height, center.x + dx, center.y + dy);
          const donor = this.sampleNormalized(original, width, height, sourceCenter.x + dx, sourceCenter.y + dy);
          for (let channel = 0; channel < 3; channel++) {
            destinationAverage[channel] += destination[channel] / boundarySamples;
            donorAverage[channel] += donor[channel] / boundarySamples;
          }
        }
        correction = [
          destinationAverage[0] - donorAverage[0],
          destinationAverage[1] - donorAverage[1],
          destinationAverage[2] - donorAverage[2]
        ];
      }

      const minX = Math.max(0, Math.floor((center.x - radius) * width) - 1);
      const maxX = Math.min(width - 1, Math.ceil((center.x + radius) * width) + 1);
      const minY = Math.max(0, Math.floor((center.y - radius / aspect) * height) - 1);
      const maxY = Math.min(height - 1, Math.ceil((center.y + radius / aspect) * height) + 1);
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const normalized = { x: (x + 0.5) / width, y: (y + 0.5) / height };
          const distance = Math.sqrt(distanceSquared(normalized, center, aspect));
          let spatialWeight = 0;
          if (distance <= fullRadius) spatialWeight = 1;
          else if (feather > 0 && distance < radius) {
            spatialWeight = 1 - smoothstep(fullRadius, radius, distance);
          }
          const weight = spatialWeight * opacity;
          if (weight <= 0) continue;

          const donor = this.sampleNormalized(
            original,
            width,
            height,
            sourceCenter.x + (normalized.x - center.x),
            sourceCenter.y + (normalized.y - center.y)
          );
          const offset = (y * width + x) * 4;
          for (let channel = 0; channel < 3; channel++) {
            const replacement = clamp(donor[channel] + correction[channel], 0, 255);
            result[offset + channel] = Math.round(result[offset + channel] * (1 - weight) + replacement * weight);
          }
        }
      }
    }
    return result;
  }

  private applyGlobalPixel(
    sourceR: number,
    sourceG: number,
    sourceB: number,
    doc: EditDocument,
    settings: GlobalSettings
  ): [number, number, number] {
    const b = doc.basic;
    const grading = doc.colorGrading;
    const mixer = doc.hslMixer || [] as unknown as HslMixerAdjustments;
    let r = this.linearToSrgb(this.srgbToLinear(sourceR) * settings.wbR * settings.exposureScale);
    let g = this.linearToSrgb(this.srgbToLinear(sourceG) * settings.wbG * settings.exposureScale);
    let blue = this.linearToSrgb(this.srgbToLinear(sourceB) * settings.wbB * settings.exposureScale);

    let luma = 0.2126 * r + 0.7152 * g + 0.0722 * blue;
    const contrast = finiteOr(b.contrast, 0);
    if (Math.abs(contrast) > 0.001) {
      const factor = 1 + contrast / 100 * 0.8;
      r = clamp((r - 0.5) * factor + 0.5);
      g = clamp((g - 0.5) * factor + 0.5);
      blue = clamp((blue - 0.5) * factor + 0.5);
      luma = 0.2126 * r + 0.7152 * g + 0.0722 * blue;
    }

    const highlights = finiteOr(b.highlights, 0);
    if (Math.abs(highlights) > 0.001) {
      const weight = smoothstep(0.4, 1, luma);
      const adjustment = highlights / 100 * 0.35 * weight;
      r += r * adjustment;
      g += g * adjustment;
      blue += blue * adjustment;
    }
    const shadows = finiteOr(b.shadows, 0);
    if (Math.abs(shadows) > 0.001) {
      const weight = 1 - smoothstep(0, 0.6, luma);
      const amount = shadows / 100;
      r = this.applyToneEndpoint(r, amount, weight);
      g = this.applyToneEndpoint(g, amount, weight);
      blue = this.applyToneEndpoint(blue, amount, weight);
    }

    // Whites affect the upper tonal shoulder, while blacks affect only the
    // lower shoulder. They are intentionally separate from highlights/shadows.
    luma = 0.2126 * r + 0.7152 * g + 0.0722 * blue;
    const whiteWeight = smoothstep(0.45, 1, luma);
    const whiteAmount = finiteOr(b.whites, 0) / 100;
    r = this.applyToneEndpoint(r, whiteAmount, whiteWeight);
    g = this.applyToneEndpoint(g, whiteAmount, whiteWeight);
    blue = this.applyToneEndpoint(blue, whiteAmount, whiteWeight);

    const blackWeight = 1 - smoothstep(0, 0.5, luma);
    const blackAmount = finiteOr(b.blacks, 0) / 100;
    r = this.applyToneEndpoint(r, blackAmount, blackWeight);
    g = this.applyToneEndpoint(g, blackAmount, blackWeight);
    blue = this.applyToneEndpoint(blue, blackAmount, blackWeight);

    luma = 0.2126 * r + 0.7152 * g + 0.0722 * blue;
    const shadowWeight = 1 - smoothstep(0, settings.midThreshold + settings.blendWidth * 0.5, luma);
    const highlightWeight = smoothstep(settings.midThreshold - settings.blendWidth * 0.5, 1, luma);
    const midtoneWeight = clamp(1 - shadowWeight - highlightWeight);
    const tint = (channel: 0 | 1 | 2): number =>
      settings.shadowsTint[channel] * shadowWeight +
      settings.midtonesTint[channel] * midtoneWeight +
      settings.highlightsTint[channel] * highlightWeight +
      settings.globalTint[channel] +
      settings.shadowsLuma * shadowWeight +
      settings.midtonesLuma * midtoneWeight +
      settings.highlightsLuma * highlightWeight +
      settings.globalLuma;
    r = clamp(r + tint(0));
    g = clamp(g + tint(1));
    blue = clamp(blue + tint(2));

    const [h, s, l] = this.rgbToHsl(r, g, blue);
    const hueCenters = [0, 0.0833, 0.1667, 0.3333, 0.5, 0.6667, 0.7778, 0.8889];
    const hueWidths = [0.08, 0.08, 0.09, 0.14, 0.14, 0.13, 0.10, 0.10];
    let hueShift = 0;
    let saturationScale = 0;
    let luminanceShift = 0;
    // HSL hue is undefined for achromatic pixels. `rgbToHsl` returns zero for
    // that case, but treating zero as the red hue would make a red-channel
    // luminance edit change every neutral gray pixel. Only chromatic pixels
    // participate in selective hue-band adjustments; their saturation and
    // lightness are still edited in HSL space below.
    if (s > 1e-5) {
      for (let channel = 0; channel < 8; channel++) {
        const adjustment = mixer[channel] || IDENTITY_HSL_CHANNEL;
        const hueDistance = this.hueDistance(h, hueCenters[channel]);
        if (hueDistance < hueWidths[channel]) {
          const channelWeight = Math.pow(1 - hueDistance / hueWidths[channel], 1.5);
          hueShift += channelWeight * finiteOr(adjustment.hue, 0) / 100 * 0.16;
          saturationScale += channelWeight * finiteOr(adjustment.saturation, 0) / 100;
          luminanceShift += channelWeight * finiteOr(adjustment.luminance, 0) / 100 * 0.35;
        }
      }
    }
    const newH = (h + hueShift + 1) % 1;
    let newS = clamp(s * (1 + saturationScale));
    const newL = clamp(l + luminanceShift);
    const vibrance = finiteOr(b.vibrance, 0);
    if (Math.abs(vibrance) > 0.001) {
      const skinDistance = this.hueDistance(newH, 0.08);
      const skinProtection = smoothstep(0, 0.12, skinDistance);
      const vibranceFactor = (1 - newS) * vibrance / 100 * (0.4 + 0.6 * skinProtection);
      newS = clamp(newS * (1 + vibranceFactor));
    }

    [r, g, blue] = this.hslToRgb(newH, newS, newL);
    const saturation = finiteOr(b.saturation, 0);
    if (Math.abs(saturation) > 0.001) {
      const finalLuma = 0.2126 * r + 0.7152 * g + 0.0722 * blue;
      const multiplier = 1 + saturation / 100;
      r = finalLuma + (r - finalLuma) * multiplier;
      g = finalLuma + (g - finalLuma) * multiplier;
      blue = finalLuma + (blue - finalLuma) * multiplier;
    }

    // Composite first, then channel curves. Piecewise-linear interpolation
    // keeps a default identity curve exactly neutral.
    const compositeR = settings.compositeCurve[Math.round(clamp(r) * 255)] / 255;
    const compositeG = settings.compositeCurve[Math.round(clamp(g) * 255)] / 255;
    const compositeB = settings.compositeCurve[Math.round(clamp(blue) * 255)] / 255;
    r = settings.redCurve[Math.round(compositeR * 255)] / 255;
    g = settings.greenCurve[Math.round(compositeG * 255)] / 255;
    blue = settings.blueCurve[Math.round(compositeB * 255)] / 255;
    return [clamp(r), clamp(g), clamp(blue)];
  }

  private applyLocalAdjustment(
    rgb: [number, number, number],
    mask: MaskAdjustment,
    weight: number
  ): [number, number, number] {
    if (weight <= 0) return rgb;
    const exposure = finiteOr(mask.exposure, 0) * weight;
    let r = rgb[0];
    let g = rgb[1];
    let b = rgb[2];
    if (Math.abs(exposure) > 1e-6) {
      const scale = Math.pow(2, exposure);
      r = this.linearToSrgb(this.srgbToLinear(r) * scale);
      g = this.linearToSrgb(this.srgbToLinear(g) * scale);
      b = this.linearToSrgb(this.srgbToLinear(b) * scale);
    }

    const temperature = finiteOr(mask.temperature, 0) * weight / 100;
    const wbR = temperature > 0 ? 1 + temperature * 0.42 : 1 + temperature * 0.32;
    const wbG = temperature > 0 ? 1 + temperature * 0.08 : 1 + temperature * 0.04;
    const wbB = temperature > 0 ? 1 - temperature * 0.38 : 1 - temperature * 0.45;
    r = this.linearToSrgb(this.srgbToLinear(r) * wbR);
    g = this.linearToSrgb(this.srgbToLinear(g) * wbG);
    b = this.linearToSrgb(this.srgbToLinear(b) * wbB);

    const contrast = finiteOr(mask.contrast, 0) * weight;
    if (Math.abs(contrast) > 1e-6) {
      const factor = 1 + contrast / 100 * 0.8;
      r = clamp((r - 0.5) * factor + 0.5);
      g = clamp((g - 0.5) * factor + 0.5);
      b = clamp((b - 0.5) * factor + 0.5);
    }
    let luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const highlights = finiteOr(mask.highlights, 0) * weight / 100 * 0.35 * smoothstep(0.4, 1, luma);
    r += r * highlights;
    g += g * highlights;
    b += b * highlights;
    luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const shadows = finiteOr(mask.shadows, 0) * weight / 100 * 0.35 * (1 - smoothstep(0, 0.6, luma));
    r += (1 - r) * shadows;
    g += (1 - g) * shadows;
    b += (1 - b) * shadows;

    const saturation = finiteOr(mask.saturation, 0) * weight;
    if (Math.abs(saturation) > 1e-6) {
      const [h, s, lightness] = this.rgbToHsl(clamp(r), clamp(g), clamp(b));
      const local = this.hslToRgb(h, clamp(s * (1 + saturation / 100)), lightness);
      r = local[0];
      g = local[1];
      b = local[2];
    }
    return [clamp(r), clamp(g), clamp(b)];
  }

  private deterministicNoise(x: number, y: number): number {
    let value = (x * 374761393 + y * 668265263) | 0;
    value = (value ^ (value >>> 13)) * 1274126177;
    value ^= value >>> 16;
    return ((value >>> 0) / 4294967295) * 2 - 1;
  }

  processPixelBuffer(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    doc: EditDocument
  ): Uint8ClampedArray {
    const healed = this.applyHealing(pixels, width, height, doc.healingSpots as HealingSpotWithFeather[]);
    const base = new Uint8ClampedArray(healed);
    const settings = this.buildGlobalSettings(doc);
    const pixelCount = Math.min(width * height, Math.floor(pixels.length / 4));

    for (let pixel = 0; pixel < pixelCount; pixel++) {
      const offset = pixel * 4;
      const transformed = this.applyGlobalPixel(
        healed[offset] / 255,
        healed[offset + 1] / 255,
        healed[offset + 2] / 255,
        doc,
        settings
      );
      base[offset] = Math.round(transformed[0] * 255);
      base[offset + 1] = Math.round(transformed[1] * 255);
      base[offset + 2] = Math.round(transformed[2] * 255);
      base[offset + 3] = healed[offset + 3];
    }

    const output = new Uint8ClampedArray(base);
    const masks = doc.masks || [];
    const aspect = height / Math.max(1, width);
    const basic = doc.basic;
    for (let pixel = 0; pixel < pixelCount; pixel++) {
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      const offset = pixel * 4;
      let r = base[offset] / 255;
      let g = base[offset + 1] / 255;
      let b = base[offset + 2] / 255;

      const clarity = finiteOr(basic.clarity, 0);
      const sharpening = finiteOr(basic.sharpening, 0);
      if (Math.abs(clarity) > 0.001 || Math.abs(sharpening) > 0.001) {
        let blurLuma = 0;
        let sampleWeight = 0;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const sampleX = clamp(x + ox, 0, width - 1);
            const sampleY = clamp(y + oy, 0, height - 1);
            const sampleOffset = (sampleY * width + sampleX) * 4;
            // A small Gaussian-like kernel gives clarity a local-contrast
            // response and sharpening a stable unsharp-mask response without
            // making either control dependent on a full-screen texture.
            const kernelWeight = ox === 0 && oy === 0
              ? 4
              : ox === 0 || oy === 0
                ? 2
                : 1;
            blurLuma += (
              0.2126 * base[sampleOffset] +
              0.7152 * base[sampleOffset + 1] +
              0.0722 * base[sampleOffset + 2]
            ) / 255 * kernelWeight;
            sampleWeight += kernelWeight;
          }
        }
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const detail = luma - blurLuma / sampleWeight;
        const detailAmount = clarity / 100 * 0.75 + sharpening / 100 * 1.1;
        r = clamp(r + detail * detailAmount);
        g = clamp(g + detail * detailAmount);
        b = clamp(b + detail * detailAmount);
      }

      const grain = finiteOr(basic.grain, 0) / 100 * 0.08;
      if (grain !== 0) {
        const noise = this.deterministicNoise(x, y) * grain;
        r = clamp(r + noise);
        g = clamp(g + noise);
        b = clamp(b + noise);
      }

      const vignette = finiteOr(basic.vignette, 0) / 100;
      if (vignette !== 0) {
        const nx = ((x + 0.5) / width - 0.5) * 2;
        const ny = ((y + 0.5) / height - 0.5) * 2;
        const edge = smoothstep(0.25, 1, Math.sqrt(nx * nx + ny * ny) / Math.SQRT2);
        const multiplier = 1 - vignette * 0.55 * edge;
        r = clamp(r * multiplier);
        g = clamp(g * multiplier);
        b = clamp(b * multiplier);
      }

      let local: [number, number, number] = [r, g, b];
      const normalizedX = (x + 0.5) / width;
      const normalizedY = (y + 0.5) / height;
      for (const mask of masks) {
        const weight = maskWeight(mask, normalizedX, normalizedY, aspect);
        if (weight > 0) local = this.applyLocalAdjustment(local, mask, weight);
      }
      output[offset] = Math.round(local[0] * 255);
      output[offset + 1] = Math.round(local[1] * 255);
      output[offset + 2] = Math.round(local[2] * 255);
      output[offset + 3] = base[offset + 3];
    }

    return output;
  }

  async exportFullResolution(
    sourceUri: string,
    document: EditDocument,
    options: ExportOptions
  ): Promise<string> {
    return `file://exported_${Date.now()}.${options.format}`;
  }

  dispose(): void {
    // cleanup
  }
}
