use crate::color::{hsl_to_rgb, hue_distance, linear_to_srgb, rgb_to_hsl, smoothstep, srgb_to_linear};
use crate::models::EditDocument;

pub const HUE_CENTERS: [f32; 8] = [0.0, 0.0833, 0.1667, 0.3333, 0.5, 0.6667, 0.7778, 0.8889];
pub const HUE_WIDTHS: [f32; 8] = [0.09, 0.07, 0.08, 0.12, 0.09, 0.11, 0.08, 0.09];

/// Precomputed context for an EditDocument to avoid recalculating invariants for every pixel
#[derive(Debug, Clone)]
pub struct PreparedPipelineContext {
    pub exposure_scale: f32,
    pub wb_r: f32,
    pub wb_g: f32,
    pub wb_b: f32,
    pub contrast_factor: f32,
    pub has_contrast: bool,
    pub highlights_adj: f32,
    pub has_highlights: bool,
    pub shadows_adj: f32,
    pub has_shadows: bool,
    // Grading
    pub s_tint: [f32; 3],
    pub m_tint: [f32; 3],
    pub h_tint: [f32; 3],
    pub g_tint: [f32; 3],
    pub s_luma: f32,
    pub m_luma: f32,
    pub h_luma: f32,
    pub g_luma: f32,
    pub mid_threshold: f32,
    pub blend_width: f32,
    // HSL Mixer channels (8)
    pub mixer_hue_factors: [f32; 8],
    pub mixer_sat_factors: [f32; 8],
    pub mixer_luma_factors: [f32; 8],
    // Vibrance & Sat
    pub vibrance: f32,
    pub has_vibrance: bool,
    pub saturation: f32,
    pub has_saturation: bool,
}

impl PreparedPipelineContext {
    pub fn from_document(doc: &EditDocument) -> Self {
        let b = &doc.basic;
        let g = &doc.color_grading;
        let m = &doc.hsl_mixer;

        // 1. Exposure
        let exposure_scale = 2.0f32.powf(b.exposure);

        // 2. White Balance
        let temp_norm = b.temperature / 100.0;
        let tint_norm = b.tint / 100.0;

        let mut wb_r = 1.0f32;
        let mut wb_g = 1.0f32;
        let mut wb_b = 1.0f32;

        if temp_norm > 0.0 {
            wb_r += temp_norm * 0.42;
            wb_g += temp_norm * 0.08;
            wb_b -= temp_norm * 0.38;
        } else {
            wb_r += temp_norm * 0.32;
            wb_g += temp_norm * 0.04;
            wb_b -= temp_norm * 0.45;
        }

        if tint_norm > 0.0 {
            wb_r += tint_norm * 0.16;
            wb_g -= tint_norm * 0.32;
            wb_b += tint_norm * 0.16;
        } else {
            wb_r += tint_norm * 0.14;
            wb_g -= tint_norm * 0.30;
            wb_b += tint_norm * 0.08;
        }

        // 3. Contrast factor
        let has_contrast = b.contrast.abs() > 0.001;
        let contrast_factor = 1.0 + (b.contrast / 100.0) * 0.8;

        // 4. Highlights / Shadows
        let has_highlights = b.highlights.abs() > 0.001;
        let highlights_adj = (b.highlights / 100.0) * 0.35;
        let has_shadows = b.shadows.abs() > 0.001;
        let shadows_adj = (b.shadows / 100.0) * 0.35;

        // 5. 3-Way Color Grading
        let s_rgb = hsl_to_rgb(g.shadows.hue / 360.0, 1.0, 0.5);
        let m_rgb = hsl_to_rgb(g.midtones.hue / 360.0, 1.0, 0.5);
        let h_rgb = hsl_to_rgb(g.highlights.hue / 360.0, 1.0, 0.5);
        let glob_rgb = hsl_to_rgb(g.global.hue / 360.0, 1.0, 0.5);

        let s_tint = [
            (s_rgb.0 - 0.5) * (g.shadows.saturation / 100.0) * 0.6,
            (s_rgb.1 - 0.5) * (g.shadows.saturation / 100.0) * 0.6,
            (s_rgb.2 - 0.5) * (g.shadows.saturation / 100.0) * 0.6,
        ];
        let m_tint = [
            (m_rgb.0 - 0.5) * (g.midtones.saturation / 100.0) * 0.6,
            (m_rgb.1 - 0.5) * (g.midtones.saturation / 100.0) * 0.6,
            (m_rgb.2 - 0.5) * (g.midtones.saturation / 100.0) * 0.6,
        ];
        let h_tint = [
            (h_rgb.0 - 0.5) * (g.highlights.saturation / 100.0) * 0.6,
            (h_rgb.1 - 0.5) * (g.highlights.saturation / 100.0) * 0.6,
            (h_rgb.2 - 0.5) * (g.highlights.saturation / 100.0) * 0.6,
        ];
        let g_tint = [
            (glob_rgb.0 - 0.5) * (g.global.saturation / 100.0) * 0.6,
            (glob_rgb.1 - 0.5) * (g.global.saturation / 100.0) * 0.6,
            (glob_rgb.2 - 0.5) * (g.global.saturation / 100.0) * 0.6,
        ];

        let s_luma = (g.shadows.luminance / 100.0) * 0.3;
        let m_luma = (g.midtones.luminance / 100.0) * 0.3;
        let h_luma = (g.highlights.luminance / 100.0) * 0.3;
        let g_luma = (g.global.luminance / 100.0) * 0.3;

        let mid_threshold = (0.5 + (g.balance / 100.0) * 0.25).clamp(0.1, 0.9);
        let blend_width = 0.2 + (g.blending / 100.0) * 0.5;

        // 6. HSL Mixer factors
        let mut mixer_hue_factors = [0.0f32; 8];
        let mut mixer_sat_factors = [0.0f32; 8];
        let mut mixer_luma_factors = [0.0f32; 8];
        for ch in 0..8 {
            mixer_hue_factors[ch] = (m[ch].hue / 100.0) * 0.12;
            mixer_sat_factors[ch] = m[ch].saturation / 100.0;
            mixer_luma_factors[ch] = (m[ch].luminance / 100.0) * 0.3;
        }

        Self {
            exposure_scale,
            wb_r,
            wb_g,
            wb_b,
            contrast_factor,
            has_contrast,
            highlights_adj,
            has_highlights,
            shadows_adj,
            has_shadows,
            s_tint,
            m_tint,
            h_tint,
            g_tint,
            s_luma,
            m_luma,
            h_luma,
            g_luma,
            mid_threshold,
            blend_width,
            mixer_hue_factors,
            mixer_sat_factors,
            mixer_luma_factors,
            vibrance: b.vibrance,
            has_vibrance: b.vibrance.abs() > 0.001,
            saturation: b.saturation,
            has_saturation: b.saturation.abs() > 0.001,
        }
    }

    /// Process a single pixel (r, g, b) in [0..255] byte format, returning processed [r, g, b]
    #[inline(always)]
    pub fn process_pixel(&self, r_byte: u8, g_byte: u8, b_byte: u8) -> (u8, u8, u8) {
        // Step 1: Normalize input to [0..1]
        let r_orig = (r_byte as f32) / 255.0;
        let g_orig = (g_byte as f32) / 255.0;
        let b_orig = (b_byte as f32) / 255.0;

        // Step 2: Linearize and apply radiometric WB + Exposure scaling
        let r_lin = srgb_to_linear(r_orig) * self.wb_r * self.exposure_scale;
        let g_lin = srgb_to_linear(g_orig) * self.wb_g * self.exposure_scale;
        let b_lin = srgb_to_linear(b_orig) * self.wb_b * self.exposure_scale;

        // Step 3: De-linearize to working perceptual space
        let mut r = linear_to_srgb(r_lin);
        let mut g = linear_to_srgb(g_lin);
        let mut b = linear_to_srgb(b_lin);

        let mut luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

        // Contrast S-curve
        if self.has_contrast {
            r = ((r - 0.5) * self.contrast_factor + 0.5).clamp(0.0, 1.0);
            g = ((g - 0.5) * self.contrast_factor + 0.5).clamp(0.0, 1.0);
            b = ((b - 0.5) * self.contrast_factor + 0.5).clamp(0.0, 1.0);
            luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        }

        // Highlights & Shadows
        if self.has_highlights {
            let hw = smoothstep(0.4, 1.0, luma);
            let adj = self.highlights_adj * hw;
            r += r * adj;
            g += g * adj;
            b += b * adj;
        }
        if self.has_shadows {
            let sw = 1.0 - smoothstep(0.0, 0.6, luma);
            let adj = self.shadows_adj * sw;
            r += (1.0 - r) * adj;
            g += (1.0 - g) * adj;
            b += (1.0 - b) * adj;
        }

        // Step 4: 3-Way Color Grading
        luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        let shadow_weight = 1.0 - smoothstep(0.0, self.mid_threshold + self.blend_width * 0.5, luma);
        let highlight_weight = smoothstep(self.mid_threshold - self.blend_width * 0.5, 1.0, luma);
        let midtone_weight = (1.0 - shadow_weight - highlight_weight).clamp(0.0, 1.0);

        r += (self.s_tint[0] + self.s_luma) * shadow_weight
            + (self.m_tint[0] + self.m_luma) * midtone_weight
            + (self.h_tint[0] + self.h_luma) * highlight_weight
            + (self.g_tint[0] + self.g_luma);

        g += (self.s_tint[1] + self.s_luma) * shadow_weight
            + (self.m_tint[1] + self.m_luma) * midtone_weight
            + (self.h_tint[1] + self.h_luma) * highlight_weight
            + (self.g_tint[1] + self.g_luma);

        b += (self.s_tint[2] + self.s_luma) * shadow_weight
            + (self.m_tint[2] + self.m_luma) * midtone_weight
            + (self.h_tint[2] + self.h_luma) * highlight_weight
            + (self.g_tint[2] + self.g_luma);

        r = r.clamp(0.0, 1.0);
        g = g.clamp(0.0, 1.0);
        b = b.clamp(0.0, 1.0);

        // Step 5: 8-Channel HSL Mixer
        let (h, s, l) = rgb_to_hsl(r, g, b);
        let mut hue_shift = 0.0f32;
        let mut sat_scale = 0.0f32;
        let mut luma_shift = 0.0f32;

        for ch in 0..8 {
            let d = hue_distance(h, HUE_CENTERS[ch]);
            let w = (1.0 - d / HUE_WIDTHS[ch]).max(0.0).powi(2);
            if w > 0.0 {
                hue_shift += w * self.mixer_hue_factors[ch];
                sat_scale += w * self.mixer_sat_factors[ch];
                luma_shift += w * self.mixer_luma_factors[ch];
            }
        }

        let new_h = (h + hue_shift + 1.0).fract();
        let mut new_s = (s * (1.0 + sat_scale)).clamp(0.0, 1.0);
        let new_l = (l + luma_shift).clamp(0.0, 1.0);

        // Step 6: Vibrance
        if self.has_vibrance {
            let skin_dist = hue_distance(new_h, 0.08);
            let skin_protect = smoothstep(0.0, 0.12, skin_dist);
            let vib_factor = (1.0 - new_s) * (self.vibrance / 100.0) * (0.4 + 0.6 * skin_protect);
            new_s = (new_s * (1.0 + vib_factor)).clamp(0.0, 1.0);
        }

        let (final_r, final_g, final_b) = hsl_to_rgb(new_h, new_s, new_l);
        let mut out_r = final_r;
        let mut out_g = final_g;
        let mut out_b = final_b;

        // Step 7: Global Saturation
        if self.has_saturation {
            let final_luma = 0.2126 * out_r + 0.7152 * out_g + 0.0722 * out_b;
            let sat_mult = 1.0 + self.saturation / 100.0;
            out_r = final_luma + (out_r - final_luma) * sat_mult;
            out_g = final_luma + (out_g - final_luma) * sat_mult;
            out_b = final_luma + (out_b - final_luma) * sat_mult;
        }

        (
            (out_r.clamp(0.0, 1.0) * 255.0).round() as u8,
            (out_g.clamp(0.0, 1.0) * 255.0).round() as u8,
            (out_b.clamp(0.0, 1.0) * 255.0).round() as u8,
        )
    }
}
