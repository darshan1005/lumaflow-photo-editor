/**
 * Lumaflow Image Binary Extractor Engine
 * Extracts deep binary metadata, pixel luminance distributions, RGB histograms,
 * and calculates photographic lighting adjustments based on Rec. 709 radiometric algorithms.
 */

export interface ImageBinaryHeader {
  format: 'jpeg' | 'png' | 'webp' | 'gif' | 'bmp' | 'unknown';
  mimeType: string;
  byteSize: number;
  byteSizeFormatted: string;
  width: number;
  height: number;
  aspectRatio: number;
  megapixels: number;
  colorDepthBits: number;
  hasAlphaChannel: boolean;
}

export interface ImageHistogramData {
  luminance: Uint32Array; // 256 bins
  red: Uint32Array;       // 256 bins
  green: Uint32Array;     // 256 bins
  blue: Uint32Array;      // 256 bins
  totalSampledPixels: number;
}

export interface ImageTonalMetrics {
  meanLuminance: number;       // 0.0 to 1.0 (average scene brightness)
  medianLuminance: number;     // 0.0 to 1.0 (50th percentile middle luminance)
  blackPoint: number;          // 0 to 255 (0.5% deepest shadow threshold)
  whitePoint: number;          // 0 to 255 (99.5% brightest highlight threshold)
  dynamicRangeEV: number;      // photographic stops EV (log2(whitePoint / blackPoint))
  shadowZoneRatio: number;     // ratio of pixels in shadow range (L < 0.25)
  midtonesZoneRatio: number;   // ratio of pixels in midtones range (0.25 <= L <= 0.75)
  highlightsZoneRatio: number; // ratio of pixels in highlights range (L > 0.75)
  clippedBlacksRatio: number;  // ratio of pixels crushed to near 0 (L < 0.02)
  clippedWhitesRatio: number;  // ratio of pixels blown out near 1 (L > 0.98)
  microContrastEnergy: number; // 0.0 to 1.0 (Laplacian texture energy for Clarity)
}

export interface AlgorithmicLightAdjustments {
  exposure: number;    // -2.0 to +2.0 EV
  contrast: number;    // -100 to +100
  highlights: number;  // -100 to +100
  shadows: number;     // -100 to +100
  whites: number;      // -100 to +100
  blacks: number;      // -100 to +100
  clarity: number;     // 0 to 100
  sharpening: number;  // 0 to 100
  analysisSummary: string;
}

export interface CompleteImageAnalysis {
  header: ImageBinaryHeader;
  histograms: ImageHistogramData;
  tonalMetrics: ImageTonalMetrics;
  recommendedLightAdjustments: AlgorithmicLightAdjustments;
  extractedAt: number;
}

// Rec. 709 radiometric luminance coefficients
const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;

export class ImageBinaryExtractor {
  /**
   * Sniff binary magic numbers to determine image container format and properties
   */
  public static inspectBinaryHeader(
    binary: Uint8Array | ArrayBuffer,
    fallbackWidth = 1920,
    fallbackHeight = 1080
  ): ImageBinaryHeader {
    const bytes = binary instanceof Uint8Array ? binary : new Uint8Array(binary);
    const byteSize = bytes.length;

    let format: ImageBinaryHeader['format'] = 'unknown';
    let mimeType = 'application/octet-stream';
    let width = fallbackWidth;
    let height = fallbackHeight;
    let hasAlpha = false;
    let colorDepthBits = 8;

    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      format = 'jpeg';
      mimeType = 'image/jpeg';
      hasAlpha = false;

      // Scan SOF markers for exact JPEG dimensions
      let offset = 2;
      while (offset + 9 < bytes.length) {
        if (bytes[offset] === 0xff) {
          const marker = bytes[offset + 1];
          // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2)
          if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb)) {
            height = (bytes[offset + 5] << 8) | bytes[offset + 6];
            width = (bytes[offset + 7] << 8) | bytes[offset + 8];
            colorDepthBits = bytes[offset + 4];
            break;
          }
          const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
          offset += 2 + length;
        } else {
          offset++;
        }
      }
    } else if (
      bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
    ) {
      format = 'png';
      mimeType = 'image/png';
      if (bytes.length >= 24) {
        width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
        height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
        colorDepthBits = bytes[24];
        const colorType = bytes[25];
        hasAlpha = colorType === 4 || colorType === 6; // Grayscale+Alpha or RGBA
      }
    } else if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) {
      format = 'webp';
      mimeType = 'image/webp';
      hasAlpha = true;
    } else if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
      format = 'bmp';
      mimeType = 'image/bmp';
      if (bytes.length >= 26) {
        width = bytes[18] | (bytes[19] << 8) | (bytes[20] << 16) | (bytes[21] << 24);
        height = Math.abs(bytes[22] | (bytes[23] << 8) | (bytes[24] << 16) | (bytes[25] << 24));
      }
    }

    width = Math.max(1, width);
    height = Math.max(1, height);
    const megapixels = parseFloat(((width * height) / 1000000).toFixed(2));
    const aspectRatio = parseFloat((width / height).toFixed(4));

    return {
      format,
      mimeType,
      byteSize,
      byteSizeFormatted: this.formatBytes(byteSize),
      width,
      height,
      aspectRatio,
      megapixels,
      colorDepthBits,
      hasAlphaChannel: hasAlpha
    };
  }

  /**
   * Extract comprehensive 256-bin histograms and tonal metrics from an RGBA pixel buffer
   */
  public static extractFromPixelBuffer(
    pixels: Uint8ClampedArray | Uint8Array,
    width: number,
    height: number,
    byteSize = 0,
    format: ImageBinaryHeader['format'] = 'jpeg'
  ): CompleteImageAnalysis {
    const lumaHist = new Uint32Array(256);
    const redHist = new Uint32Array(256);
    const greenHist = new Uint32Array(256);
    const blueHist = new Uint32Array(256);

    const pixelCount = width * height;
    // For performance on large images, sample every step pixels if > 500k pixels
    const step = pixelCount > 500000 ? Math.ceil(pixelCount / 250000) : 1;
    let sampledPixels = 0;
    let totalLuma = 0;

    let clippedBlacks = 0;
    let clippedWhites = 0;
    let shadowCount = 0;
    let midtoneCount = 0;
    let highlightCount = 0;

    // Laplacian micro-contrast energy accumulator (samples neighbor horizontal diff)
    let laplacianDiffSum = 0;
    let laplacianSamples = 0;

    for (let i = 0; i < pixels.length; i += 4 * step) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      const lumaFloat = LUMA_R * r + LUMA_G * g + LUMA_B * b;
      const lumaInt = Math.max(0, Math.min(255, Math.round(lumaFloat)));
      const normLuma = lumaFloat / 255.0;

      lumaHist[lumaInt]++;
      redHist[r]++;
      greenHist[g]++;
      blueHist[b]++;

      totalLuma += normLuma;
      sampledPixels++;

      // Tonal Zone Classification
      if (normLuma < 0.02) clippedBlacks++;
      if (normLuma > 0.98) clippedWhites++;

      if (normLuma < 0.25) {
        shadowCount++;
      } else if (normLuma <= 0.75) {
        midtoneCount++;
      } else {
        highlightCount++;
      }

      // Horizontal micro-gradient for texture energy
      if (i + 4 < pixels.length) {
        const nextR = pixels[i + 4];
        const nextG = pixels[i + 5];
        const nextB = pixels[i + 6];
        const nextLuma = LUMA_R * nextR + LUMA_G * nextG + LUMA_B * nextB;
        laplacianDiffSum += Math.abs(lumaFloat - nextLuma);
        laplacianSamples++;
      }
    }

    const safeSampled = Math.max(1, sampledPixels);
    const meanLuminance = parseFloat((totalLuma / safeSampled).toFixed(4));
    const shadowZoneRatio = parseFloat((shadowCount / safeSampled).toFixed(4));
    const midtonesZoneRatio = parseFloat((midtoneCount / safeSampled).toFixed(4));
    const highlightsZoneRatio = parseFloat((highlightCount / safeSampled).toFixed(4));
    const clippedBlacksRatio = parseFloat((clippedBlacks / safeSampled).toFixed(4));
    const clippedWhitesRatio = parseFloat((clippedWhites / safeSampled).toFixed(4));

    // Cumulative distribution function (CDF) for percentiles
    let cumulative = 0;
    let blackPoint = 0;
    let medianLuminance = 0.5;
    let whitePoint = 255;

    const p05Count = safeSampled * 0.005; // 0.5th percentile
    const p50Count = safeSampled * 0.500; // 50th percentile (median)
    const p995Count = safeSampled * 0.995; // 99.5th percentile

    let foundBlack = false;
    let foundMedian = false;
    let foundWhite = false;

    for (let bin = 0; bin < 256; bin++) {
      cumulative += lumaHist[bin];
      if (!foundBlack && cumulative >= p05Count) {
        blackPoint = bin;
        foundBlack = true;
      }
      if (!foundMedian && cumulative >= p50Count) {
        medianLuminance = parseFloat((bin / 255.0).toFixed(4));
        foundMedian = true;
      }
      if (!foundWhite && cumulative >= p995Count) {
        whitePoint = bin;
        foundWhite = true;
      }
    }

    const dynamicRangeEV = parseFloat(
      (Math.log2(Math.max(1, whitePoint) / Math.max(1, blackPoint))).toFixed(2)
    );

    const avgGradient = laplacianSamples > 0 ? laplacianDiffSum / laplacianSamples : 12;
    // Normalized micro-contrast energy (typically 0.05 to 0.40)
    const microContrastEnergy = parseFloat(Math.min(1.0, avgGradient / 64.0).toFixed(4));

    const tonalMetrics: ImageTonalMetrics = {
      meanLuminance,
      medianLuminance,
      blackPoint,
      whitePoint,
      dynamicRangeEV,
      shadowZoneRatio,
      midtonesZoneRatio,
      highlightsZoneRatio,
      clippedBlacksRatio,
      clippedWhitesRatio,
      microContrastEnergy
    };

    const header: ImageBinaryHeader = {
      format,
      mimeType: format === 'png' ? 'image/png' : 'image/jpeg',
      byteSize: byteSize || (width * height * 4),
      byteSizeFormatted: this.formatBytes(byteSize || (width * height * 4)),
      width,
      height,
      aspectRatio: parseFloat((width / height).toFixed(4)),
      megapixels: parseFloat(((width * height) / 1000000).toFixed(2)),
      colorDepthBits: 8,
      hasAlphaChannel: format === 'png'
    };

    const recommendedAdjustments = this.calculateOptimalLightAdjustments(tonalMetrics, header);

    return {
      header,
      histograms: {
        luminance: lumaHist,
        red: redHist,
        green: greenHist,
        blue: blueHist,
        totalSampledPixels: safeSampled
      },
      tonalMetrics,
      recommendedLightAdjustments: recommendedAdjustments,
      extractedAt: Date.now()
    };
  }

  /**
   * Algorithmic light optimization:
   * Translates extracted tonal statistics into optimal photographic slider values
   * for Whites, Blacks, Clarity, Sharpening, Highlights, Shadows, Exposure, and Contrast.
   */
  public static calculateOptimalLightAdjustments(
    m: ImageTonalMetrics,
    header: ImageBinaryHeader
  ): AlgorithmicLightAdjustments {
    // 1. Exposure: Calibrate median scene brightness towards 18% middle gray standard
    const targetMiddleGray = 0.18;
    const exposureDelta = Math.log2(targetMiddleGray / Math.max(0.04, m.medianLuminance));
    // Soften exposure correction to avoid drastic over-correction
    const exposureEV = parseFloat(Math.max(-2.0, Math.min(2.0, exposureDelta * 0.70)).toFixed(2));

    // 2. Whites Adjustment:
    // Stretches whites into the highlight headroom (up to 255) without clipping.
    // If whitePoint is low (e.g. 190), image looks muddy -> boost Whites (+15 to +50).
    // If whites are already blown out (clippedWhitesRatio > 0.02) -> compress Whites (-10 to -35).
    let whites = 0;
    const whiteHeadroom = 255 - m.whitePoint;
    if (m.clippedWhitesRatio > 0.02) {
      whites = Math.round(-Math.min(50, m.clippedWhitesRatio * 400));
    } else if (whiteHeadroom > 20) {
      whites = Math.round(Math.min(50, (whiteHeadroom / 55) * 35));
    }

    // 3. Blacks Adjustment:
    // Pulls blacks down if lifted/milky (blackPoint > 30) for punchy contrast.
    // Lifts blacks if shadows are heavily crushed (clippedBlacksRatio > 0.04).
    let blacks = 0;
    if (m.clippedBlacksRatio > 0.03) {
      blacks = Math.round(Math.min(45, m.clippedBlacksRatio * 350));
    } else if (m.blackPoint > 25) {
      blacks = Math.round(-Math.min(45, (m.blackPoint / 50) * 30));
    }

    // 4. Highlights Recovery:
    // Rescues overexposed skies and shiny skin highlights
    let highlights = 0;
    if (m.highlightsZoneRatio > 0.28 || m.clippedWhitesRatio > 0.01) {
      highlights = Math.round(-Math.min(70, (m.highlightsZoneRatio * 80 + m.clippedWhitesRatio * 300)));
    }

    // 5. Shadows Lift:
    // Opens underexposed shadows in backlit or high-contrast scenes
    let shadows = 0;
    if (m.shadowZoneRatio > 0.35) {
      shadows = Math.round(Math.min(65, (m.shadowZoneRatio - 0.20) * 110));
    }

    // 6. Contrast S-Curve:
    // If dynamic range is narrow (DR < 5.5 stops), image is flat -> add contrast (+15 to +35).
    // If scene is harsh/extreme contrast (DR > 7.5 stops), soften contrast (-10 to -20).
    let contrast = 0;
    if (m.dynamicRangeEV < 5.8) {
      contrast = Math.round(Math.min(35, (6.0 - m.dynamicRangeEV) * 15 + 10));
    } else if (m.dynamicRangeEV > 7.6) {
      contrast = Math.round(-Math.min(25, (m.dynamicRangeEV - 7.5) * 15));
    }

    // 7. Clarity (Micro-contrast texture enhancement):
    // If texture energy is low (soft image, portraits, smooth scenery), add gentle clarity (+15 to +35).
    // If image already has intense high-frequency noise/texture, keep clarity low (+5 to +10).
    let clarity = 20;
    if (m.microContrastEnergy < 0.15) {
      clarity = 30; // Boost soft fine details
    } else if (m.microContrastEnergy > 0.35) {
      clarity = 8;  // Restrain to prevent harsh halo artifacts
    }

    // 8. Sharpening (Edge acutance):
    // Resolution-dependent Nyquist scaling: higher megapixels benefit from refined sharpening
    let sharpening = 25;
    if (header.megapixels > 8) {
      sharpening = 35;
    } else if (header.megapixels < 2) {
      sharpening = 18;
    }

    // Compose human-readable diagnostic analysis summary
    const summaryParts: string[] = [];
    if (Math.abs(exposureEV) > 0.15) {
      summaryParts.push(exposureEV > 0 ? `Lifting underexposed scene (+${exposureEV} EV)` : `Taming bright scene (${exposureEV} EV)`);
    }
    if (whites !== 0) {
      summaryParts.push(whites > 0 ? `Stretching whites (+${whites})` : `Recovering clipped whites (${whites})`);
    }
    if (blacks !== 0) {
      summaryParts.push(blacks < 0 ? `Deepening rich blacks (${blacks})` : `Lifting crushed shadows (+${blacks})`);
    }
    if (highlights < -10) summaryParts.push(`Highlight recovery (${highlights})`);
    if (shadows > 10) summaryParts.push(`Shadow fill (+${shadows})`);
    summaryParts.push(`Texture clarity (+${clarity}), Edge sharpening (+${sharpening})`);

    return {
      exposure: exposureEV,
      contrast,
      highlights,
      shadows,
      whites,
      blacks,
      clarity,
      sharpening,
      analysisSummary: summaryParts.join(' • ')
    };
  }

  /**
   * Generates a synthetic balanced preview bitmap for testing or offline calculation
   */
  public static createSyntheticTestBuffer(width = 256, height = 256): Uint8ClampedArray {
    const buffer = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const normX = x / width;
        const normY = y / height;

        // Gradient with highlight specular and shadow corner
        const luma = Math.pow(normX, 1.2) * 200 + Math.sin(normY * Math.PI) * 40;
        buffer[idx] = Math.max(0, Math.min(255, Math.round(luma * 1.05)));     // R
        buffer[idx + 1] = Math.max(0, Math.min(255, Math.round(luma * 0.98))); // G
        buffer[idx + 2] = Math.max(0, Math.min(255, Math.round(luma * 0.90))); // B
        buffer[idx + 3] = 255;
      }
    }
    return buffer;
  }

  private static formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}
