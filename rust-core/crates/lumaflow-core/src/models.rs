use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BasicAdjustments {
    // Light & Exposure
    pub exposure: f32,       // -2.0 to +2.0 EV
    pub contrast: f32,       // -100 to +100
    pub highlights: f32,     // -100 to +100
    pub shadows: f32,        // -100 to +100
    pub whites: f32,         // -100 to +100
    pub blacks: f32,         // -100 to +100

    // White Balance & Color
    pub temperature: f32,    // -100 (cool) to +100 (warm)
    pub tint: f32,           // -100 (green) to +100 (magenta)
    pub vibrance: f32,       // -100 to +100
    pub saturation: f32,     // -100 to +100

    // Optics & Detail
    pub clarity: f32,        // -100 to +100
    pub vignette: f32,       // -100 to +100
    pub grain: f32,          // 0 to 100
    pub sharpening: f32,     // 0 to 100
}

impl Default for BasicAdjustments {
    fn default() -> Self {
        Self {
            exposure: 0.0,
            contrast: 0.0,
            highlights: 0.0,
            shadows: 0.0,
            whites: 0.0,
            blacks: 0.0,
            temperature: 0.0,
            tint: 0.0,
            vibrance: 0.0,
            saturation: 0.0,
            clarity: 0.0,
            vignette: 0.0,
            grain: 0.0,
            sharpening: 0.0,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct ColorWheelTone {
    pub hue: f32,            // 0 to 360
    pub saturation: f32,     // 0 to 100
    pub luminance: f32,      // -100 to +100
}

impl Default for ColorWheelTone {
    fn default() -> Self {
        Self {
            hue: 0.0,
            saturation: 0.0,
            luminance: 0.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorGradingAdjustments {
    pub shadows: ColorWheelTone,
    pub midtones: ColorWheelTone,
    pub highlights: ColorWheelTone,
    pub global: ColorWheelTone,
    pub blending: f32,       // 0 to 100
    pub balance: f32,        // -100 to +100
}

impl Default for ColorGradingAdjustments {
    fn default() -> Self {
        Self {
            shadows: ColorWheelTone::default(),
            midtones: ColorWheelTone::default(),
            highlights: ColorWheelTone::default(),
            global: ColorWheelTone::default(),
            blending: 50.0,
            balance: 0.0,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct HslChannel {
    pub hue: f32,            // -100 to +100
    pub saturation: f32,     // -100 to +100
    pub luminance: f32,      // -100 to +100
}

impl Default for HslChannel {
    fn default() -> Self {
        Self {
            hue: 0.0,
            saturation: 0.0,
            luminance: 0.0,
        }
    }
}

pub type HslMixerAdjustments = [HslChannel; 8];

pub fn default_hsl_mixer() -> HslMixerAdjustments {
    [HslChannel::default(); 8]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CropTransform {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub rotation: i32,
    pub flip_horizontal: bool,
    pub flip_vertical: bool,
    pub straighten_angle: f32,
}

impl Default for CropTransform {
    fn default() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            width: 1.0,
            height: 1.0,
            rotation: 0,
            flip_horizontal: false,
            flip_vertical: false,
            straighten_angle: 0.0,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct CurvePoint {
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ToneCurvesAdjustments {
    #[serde(default = "default_curve_points")]
    pub composite: Vec<CurvePoint>,
    #[serde(default = "default_curve_points")]
    pub red: Vec<CurvePoint>,
    #[serde(default = "default_curve_points")]
    pub green: Vec<CurvePoint>,
    #[serde(default = "default_curve_points")]
    pub blue: Vec<CurvePoint>,
}

pub fn default_curve_points() -> Vec<CurvePoint> {
    vec![
        CurvePoint { x: 0.0, y: 0.0 },
        CurvePoint { x: 64.0, y: 64.0 },
        CurvePoint { x: 128.0, y: 128.0 },
        CurvePoint { x: 192.0, y: 192.0 },
        CurvePoint { x: 255.0, y: 255.0 },
    ]
}

impl Default for ToneCurvesAdjustments {
    fn default() -> Self {
        Self {
            composite: default_curve_points(),
            red: default_curve_points(),
            green: default_curve_points(),
            blue: default_curve_points(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditDocument {
    pub version: u32,
    pub asset_id: String,
    pub source_uri: String,
    pub basic: BasicAdjustments,
    pub color_grading: ColorGradingAdjustments,
    pub hsl_mixer: HslMixerAdjustments,
    #[serde(default)]
    pub curves: Option<ToneCurvesAdjustments>,
    pub crop: CropTransform,
}

impl Default for EditDocument {
    fn default() -> Self {
        Self {
            version: 1,
            asset_id: String::new(),
            source_uri: String::new(),
            basic: BasicAdjustments::default(),
            color_grading: ColorGradingAdjustments::default(),
            hsl_mixer: default_hsl_mixer(),
            curves: Some(ToneCurvesAdjustments::default()),
            crop: CropTransform::default(),
        }
    }
}

impl EditDocument {
    pub fn new(asset_id: impl Into<String>, source_uri: impl Into<String>) -> Self {
        Self {
            asset_id: asset_id.into(),
            source_uri: source_uri.into(),
            ..Default::default()
        }
    }
}
