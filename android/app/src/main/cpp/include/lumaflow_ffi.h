#ifndef LUMAFLOW_FFI_H
#define LUMAFLOW_FFI_H

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    float exposure;
    float contrast;
    float highlights;
    float shadows;
    float whites;
    float blacks;
    float temperature;
    float tint;
    float vibrance;
    float saturation;
    float clarity;
    float vignette;
    float grain;
    float sharpening;
} CBasicAdjustments;

typedef struct {
    float hue;
    float saturation;
    float luminance;
} CColorWheelTone;

typedef struct {
    CColorWheelTone shadows;
    CColorWheelTone midtones;
    CColorWheelTone highlights;
    CColorWheelTone global;
    float blending;
    float balance;
} CColorGradingAdjustments;

typedef struct {
    float hue;
    float saturation;
    float luminance;
} CHslChannel;

typedef struct {
    CBasicAdjustments basic;
    CColorGradingAdjustments color_grading;
    CHslChannel hsl_mixer[8];
} CNativeEditDocument;

typedef struct {
    uint32_t x;
    uint32_t y;
    uint32_t width;
    uint32_t height;
} CTileBounds;

int32_t lumaflow_process_rgba(
    const uint8_t* input_ptr,
    uint8_t* output_ptr,
    uint32_t width,
    uint32_t height,
    const CNativeEditDocument* doc_ptr
);

int32_t lumaflow_compute_histogram(
    const uint8_t* rgba_ptr,
    size_t length,
    uint32_t* out_hist_ptr
);

int32_t lumaflow_calculate_tiles(
    uint32_t full_width,
    uint32_t full_height,
    uint32_t tile_size,
    CTileBounds* out_tiles_ptr,
    uint32_t max_tiles
);

int32_t lumaflow_process_tile(
    uint8_t* tile_ptr,
    uint32_t tile_width,
    uint32_t tile_height,
    const CNativeEditDocument* doc_ptr
);

const char* lumaflow_version(void);

#ifdef __cplusplus
}
#endif

#endif // LUMAFLOW_FFI_H
