/**
 * Lumaflow Mobile - Skia SkSL (Skia Shading Language) Runtime Effect
 * Hardware-accelerated GPU shader executing in React Native Skia
 */

export const SKSL_COLOR_BALANCING_SHADER = `
uniform shader image;
uniform float2 u_resolution;

// 1. Exposure & Radiometric Tone
uniform float u_exposure;       // -2.0 to +2.0 EV
uniform float u_contrast;       // -1.0 to +1.0
uniform float u_highlights;     // -1.0 to +1.0
uniform float u_shadows;        // -1.0 to +1.0

// 2. White Balance
uniform float u_temp;           // -1.0 to +1.0 (Planckian Warmth / Coolness)
uniform float u_tint;           // -1.0 to +1.0 (Orthogonal Magenta / Green)

// 3. Vibrance & Global Saturation
uniform float u_vibrance;       // -1.0 to +1.0
uniform float u_saturation;     // -1.0 to +1.0

// 4. 3-Way Color Grading: (Hue [0..1], Sat [0..1], Luma [-1..1])
uniform float3 u_shadows_grade;
uniform float3 u_midtones_grade;
uniform float3 u_highlights_grade;
uniform float3 u_global_grade;
uniform float u_blending;       // 0.0 to 1.0
uniform float u_balance;        // -1.0 to 1.0

// 5. 8-Channel HSL Mixer (Red, Orange, Yellow, Green, Aqua, Blue, Purple, Magenta)
uniform float u_m_hue_0; uniform float u_m_sat_0; uniform float u_m_luma_0;
uniform float u_m_hue_1; uniform float u_m_sat_1; uniform float u_m_luma_1;
uniform float u_m_hue_2; uniform float u_m_sat_2; uniform float u_m_luma_2;
uniform float u_m_hue_3; uniform float u_m_sat_3; uniform float u_m_luma_3;
uniform float u_m_hue_4; uniform float u_m_sat_4; uniform float u_m_luma_4;
uniform float u_m_hue_5; uniform float u_m_sat_5; uniform float u_m_luma_5;
uniform float u_m_hue_6; uniform float u_m_sat_6; uniform float u_m_luma_6;
uniform float u_m_hue_7; uniform float u_m_sat_7; uniform float u_m_luma_7;

const half3 LUMA_REC709 = half3(0.2126, 0.7152, 0.0722);

// --- COLOR CONVERSIONS IN SKSL ---

half3 srgbToLinear(half3 c) {
  half3 low = c / 12.92;
  half3 high = pow((c + 0.055) / 1.055, half3(2.4));
  return mix(low, high, step(half3(0.04045), c));
}

half3 linearToSrgb(half3 c) {
  half3 clamped = clamp(c, half3(0.0), half3(1.0));
  half3 low = clamped * 12.92;
  half3 high = 1.055 * pow(clamped, half3(1.0 / 2.4)) - 0.055;
  return mix(low, high, step(half3(0.0031308), clamped));
}

half3 rgbToHsl(half3 c) {
  half cMin = min(min(c.r, c.g), c.b);
  half cMax = max(max(c.r, c.g), c.b);
  half delta = cMax - cMin;
  half l = (cMax + cMin) * 0.5;
  half s = 0.0;
  half h = 0.0;
  if (delta > 1e-5) {
    s = l > 0.5 ? delta / (2.0 - cMax - cMin) : delta / (cMax + cMin);
    if (cMax == c.r) {
      h = (c.g - c.b) / delta + (c.g < c.b ? 6.0 : 0.0);
    } else if (cMax == c.g) {
      h = (c.b - c.r) / delta + 2.0;
    } else {
      h = (c.r - c.g) / delta + 4.0;
    }
    h /= 6.0;
  }
  return half3(h, s, l);
}

half hue2rgb(half p, half q, half t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
  if (t < 1.0 / 2.0) return q;
  if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
  return p;
}

half3 hslToRgb(half3 hsl) {
  half h = hsl.x;
  half s = hsl.y;
  half l = hsl.z;
  if (s < 1e-5) return half3(l);
  half q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  half p = 2.0 * l - q;
  return half3(
    hue2rgb(p, q, h + 1.0 / 3.0),
    hue2rgb(p, q, h),
    hue2rgb(p, q, h - 1.0 / 3.0)
  );
}

half hueDist(half h1, half h2) {
  half d = abs(h1 - h2);
  return d > 0.5 ? 1.0 - d : d;
}

half4 main(float2 xy) {
  half4 raw = image.eval(xy);
  half3 rgb = raw.rgb;

  // STEP 1: Linearize to radiometric space
  half3 lin = srgbToLinear(rgb);

  // STEP 2: White Balance Chromatic Adaptation
  half3 wbMult = half3(1.0);
  if (u_temp > 0.0) {
    wbMult.r += half(u_temp * 0.42);
    wbMult.g += half(u_temp * 0.08);
    wbMult.b -= half(u_temp * 0.38);
  } else {
    wbMult.r += half(u_temp * 0.32);
    wbMult.g += half(u_temp * 0.04);
    wbMult.b -= half(u_temp * 0.45);
  }

  if (u_tint > 0.0) {
    wbMult.r += half(u_tint * 0.16);
    wbMult.g -= half(u_tint * 0.32);
    wbMult.b += half(u_tint * 0.16);
  } else {
    wbMult.r += half(u_tint * 0.14);
    wbMult.g -= half(u_tint * 0.30);
    wbMult.b += half(u_tint * 0.08);
  }

  // Radiometric Exposure scaling (2^EV)
  lin = max(half3(0.0), lin * wbMult * exp2(half(u_exposure)));

  // STEP 3: Return to perceptual space for tone curve & color grading
  half3 color = linearToSrgb(lin);
  half luma = dot(color, LUMA_REC709);

  // Contrast S-Curve
  if (abs(u_contrast) > 0.001) {
    half cFactor = half(1.0 + u_contrast * 0.8);
    color = clamp((color - 0.5) * cFactor + 0.5, half3(0.0), half3(1.0));
    luma = dot(color, LUMA_REC709);
  }

  // Highlights & Shadows
  if (abs(u_highlights) > 0.001) {
    half hw = smoothstep(0.4, 1.0, luma);
    color += color * half(u_highlights * 0.35 * hw);
  }
  if (abs(u_shadows) > 0.001) {
    half sw = 1.0 - smoothstep(0.0, 0.6, luma);
    color += (half3(1.0) - color) * half(u_shadows * 0.35 * sw);
  }

  color = clamp(color, half3(0.0), half3(1.0));
  luma = dot(color, LUMA_REC709);

  // STEP 4: 3-Way Color Grading
  half midThreshold = clamp(half(0.5 + u_balance * 0.25), 0.1, 0.9);
  half blendWidth = half(0.2 + u_blending * 0.5);

  half shadowWeight = 1.0 - smoothstep(0.0, midThreshold + blendWidth * 0.5, luma);
  half highlightWeight = smoothstep(midThreshold - blendWidth * 0.5, 1.0, luma);
  half midtoneWeight = clamp(1.0 - shadowWeight - highlightWeight, 0.0, 1.0);

  half3 sTint = (hslToRgb(half3(half(u_shadows_grade.x), 1.0, 0.5)) - 0.5) * half(u_shadows_grade.y * 0.6);
  half3 mTint = (hslToRgb(half3(half(u_midtones_grade.x), 1.0, 0.5)) - 0.5) * half(u_midtones_grade.y * 0.6);
  half3 hTint = (hslToRgb(half3(half(u_highlights_grade.x), 1.0, 0.5)) - 0.5) * half(u_highlights_grade.y * 0.6);
  half3 gTint = (hslToRgb(half3(half(u_global_grade.x), 1.0, 0.5)) - 0.5) * half(u_global_grade.y * 0.6);

  half sLuma = half(u_shadows_grade.z * 0.3);
  half mLuma = half(u_midtones_grade.z * 0.3);
  half hLuma = half(u_highlights_grade.z * 0.3);
  half gLuma = half(u_global_grade.z * 0.3);

  color += (sTint + sLuma) * shadowWeight;
  color += (mTint + mLuma) * midtoneWeight;
  color += (hTint + hLuma) * highlightWeight;
  color += (gTint + gLuma);
  color = clamp(color, half3(0.0), half3(1.0));

  // STEP 5: 8-Channel Selective HSL Mixer
  half3 hsl = rgbToHsl(color);
  half h = hsl.x;

  half w0 = max(0.0, 1.0 - hueDist(h, 0.0) / 0.09);    w0 *= w0;
  half w1 = max(0.0, 1.0 - hueDist(h, 0.0833) / 0.07); w1 *= w1;
  half w2 = max(0.0, 1.0 - hueDist(h, 0.1667) / 0.08); w2 *= w2;
  half w3 = max(0.0, 1.0 - hueDist(h, 0.3333) / 0.12); w3 *= w3;
  half w4 = max(0.0, 1.0 - hueDist(h, 0.5000) / 0.09); w4 *= w4;
  half w5 = max(0.0, 1.0 - hueDist(h, 0.6667) / 0.11); w5 *= w5;
  half w6 = max(0.0, 1.0 - hueDist(h, 0.7778) / 0.08); w6 *= w6;
  half w7 = max(0.0, 1.0 - hueDist(h, 0.8889) / 0.09); w7 *= w7;

  half hueShift = half((w0 * u_m_hue_0 + w1 * u_m_hue_1 + w2 * u_m_hue_2 + w3 * u_m_hue_3 +
                        w4 * u_m_hue_4 + w5 * u_m_hue_5 + w6 * u_m_hue_6 + w7 * u_m_hue_7) * 0.12);

  half satScale = half(w0 * u_m_sat_0 + w1 * u_m_sat_1 + w2 * u_m_sat_2 + w3 * u_m_sat_3 +
                       w4 * u_m_sat_4 + w5 * u_m_sat_5 + w6 * u_m_sat_6 + w7 * u_m_sat_7);

  half lumaShift = half((w0 * u_m_luma_0 + w1 * u_m_luma_1 + w2 * u_m_luma_2 + w3 * u_m_luma_3 +
                         w4 * u_m_luma_4 + w5 * u_m_luma_5 + w6 * u_m_luma_6 + w7 * u_m_luma_7) * 0.3);

  hsl.x = fract(hsl.x + hueShift + 1.0);
  hsl.y = clamp(hsl.y * (1.0 + satScale), 0.0, 1.0);
  hsl.z = clamp(hsl.z + lumaShift, 0.0, 1.0);

  color = hslToRgb(hsl);

  // STEP 6: Vibrance (Skin Tone Barrier) & Saturation
  if (abs(u_vibrance) > 0.001) {
    half3 vHsl = rgbToHsl(color);
    half skinDist = hueDist(vHsl.x, 0.08);
    half skinProtect = smoothstep(0.0, 0.12, skinDist);
    half vibFactor = (1.0 - vHsl.y) * half(u_vibrance) * (0.4 + 0.6 * skinProtect);
    vHsl.y = clamp(vHsl.y * (1.0 + vibFactor), 0.0, 1.0);
    color = hslToRgb(vHsl);
  }

  if (abs(u_saturation) > 0.001) {
    half curLuma = dot(color, LUMA_REC709);
    color = clamp(mix(half3(curLuma), color, half(1.0 + u_saturation)), half3(0.0), half3(1.0));
  }

  return half4(color, raw.a);
}
`;
