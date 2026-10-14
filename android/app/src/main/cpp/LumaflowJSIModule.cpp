#include "LumaflowJSIModule.h"
#include "include/lumaflow_ffi.h"
#include <vector>

namespace lumaflow {

using namespace facebook;

void installLumaflowJSI(jsi::Runtime& runtime) {
    auto lumaflowObj = jsi::Object(runtime);

    // 1. getVersion() -> string
    lumaflowObj.setProperty(
        runtime,
        "getVersion",
        jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "getVersion"),
            0,
            [](jsi::Runtime& rt, const jsi::Value& thisVal, const jsi::Value* args, size_t count) -> jsi::Value {
                return jsi::String::createFromUtf8(rt, lumaflow_version());
            }
        )
    );

    // 2. processBuffer(inputArrayBuffer, outputArrayBuffer, width, height, doc) -> boolean
    lumaflowObj.setProperty(
        runtime,
        "processBuffer",
        jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "processBuffer"),
            5,
            [](jsi::Runtime& rt, const jsi::Value& thisVal, const jsi::Value* args, size_t count) -> jsi::Value {
                if (count < 5) {
                    throw jsi::JSError(rt, "processBuffer requires 5 arguments: input, output, width, height, doc");
                }

                auto inputObj = args[0].asObject(rt);
                auto outputObj = args[1].asObject(rt);

                if (!inputObj.isArrayBuffer(rt) || !outputObj.isArrayBuffer(rt)) {
                    throw jsi::JSError(rt, "input and output buffers must be ArrayBuffer instances");
                }

                auto inputBuffer = inputObj.getArrayBuffer(rt);
                auto outputBuffer = outputObj.getArrayBuffer(rt);

                uint32_t width = static_cast<uint32_t>(args[2].asNumber());
                uint32_t height = static_cast<uint32_t>(args[3].asNumber());
                auto docObj = args[4].asObject(rt);

                uint8_t* inPtr = inputBuffer.data(rt);
                uint8_t* outPtr = outputBuffer.data(rt);

                CNativeEditDocument nativeDoc = {};

                // Parse basic adjustments
                if (docObj.hasProperty(rt, "basic")) {
                    auto basic = docObj.getProperty(rt, "basic").asObject(rt);
                    nativeDoc.basic.exposure = basic.hasProperty(rt, "exposure") ? static_cast<float>(basic.getProperty(rt, "exposure").asNumber()) : 0.0f;
                    nativeDoc.basic.contrast = basic.hasProperty(rt, "contrast") ? static_cast<float>(basic.getProperty(rt, "contrast").asNumber()) : 0.0f;
                    nativeDoc.basic.highlights = basic.hasProperty(rt, "highlights") ? static_cast<float>(basic.getProperty(rt, "highlights").asNumber()) : 0.0f;
                    nativeDoc.basic.shadows = basic.hasProperty(rt, "shadows") ? static_cast<float>(basic.getProperty(rt, "shadows").asNumber()) : 0.0f;
                    nativeDoc.basic.whites = basic.hasProperty(rt, "whites") ? static_cast<float>(basic.getProperty(rt, "whites").asNumber()) : 0.0f;
                    nativeDoc.basic.blacks = basic.hasProperty(rt, "blacks") ? static_cast<float>(basic.getProperty(rt, "blacks").asNumber()) : 0.0f;
                    nativeDoc.basic.temperature = basic.hasProperty(rt, "temperature") ? static_cast<float>(basic.getProperty(rt, "temperature").asNumber()) : 0.0f;
                    nativeDoc.basic.tint = basic.hasProperty(rt, "tint") ? static_cast<float>(basic.getProperty(rt, "tint").asNumber()) : 0.0f;
                    nativeDoc.basic.vibrance = basic.hasProperty(rt, "vibrance") ? static_cast<float>(basic.getProperty(rt, "vibrance").asNumber()) : 0.0f;
                    nativeDoc.basic.saturation = basic.hasProperty(rt, "saturation") ? static_cast<float>(basic.getProperty(rt, "saturation").asNumber()) : 0.0f;
                    nativeDoc.basic.clarity = basic.hasProperty(rt, "clarity") ? static_cast<float>(basic.getProperty(rt, "clarity").asNumber()) : 0.0f;
                    nativeDoc.basic.vignette = basic.hasProperty(rt, "vignette") ? static_cast<float>(basic.getProperty(rt, "vignette").asNumber()) : 0.0f;
                    nativeDoc.basic.grain = basic.hasProperty(rt, "grain") ? static_cast<float>(basic.getProperty(rt, "grain").asNumber()) : 0.0f;
                    nativeDoc.basic.sharpening = basic.hasProperty(rt, "sharpening") ? static_cast<float>(basic.getProperty(rt, "sharpening").asNumber()) : 0.0f;
                }

                // Parse color grading
                if (docObj.hasProperty(rt, "colorGrading")) {
                    auto cg = docObj.getProperty(rt, "colorGrading").asObject(rt);
                    auto parseTone = [&](const char* propName, CColorWheelTone& tone) {
                        if (cg.hasProperty(rt, propName)) {
                            auto tObj = cg.getProperty(rt, propName).asObject(rt);
                            tone.hue = static_cast<float>(tObj.getProperty(rt, "hue").asNumber());
                            tone.saturation = static_cast<float>(tObj.getProperty(rt, "saturation").asNumber());
                            tone.luminance = static_cast<float>(tObj.getProperty(rt, "luminance").asNumber());
                        }
                    };
                    parseTone("shadows", nativeDoc.color_grading.shadows);
                    parseTone("midtones", nativeDoc.color_grading.midtones);
                    parseTone("highlights", nativeDoc.color_grading.highlights);
                    parseTone("global", nativeDoc.color_grading.global);
                    nativeDoc.color_grading.blending = cg.hasProperty(rt, "blending") ? static_cast<float>(cg.getProperty(rt, "blending").asNumber()) : 50.0f;
                    nativeDoc.color_grading.balance = cg.hasProperty(rt, "balance") ? static_cast<float>(cg.getProperty(rt, "balance").asNumber()) : 0.0f;
                }

                // Parse HSL mixer (8 channels)
                if (docObj.hasProperty(rt, "hslMixer")) {
                    auto mixer = docObj.getProperty(rt, "hslMixer").asObject(rt);
                    if (mixer.isArray(rt)) {
                        auto arr = mixer.getArray(rt);
                        size_t len = arr.length(rt);
                        for (size_t i = 0; i < len && i < 8; ++i) {
                            auto chObj = arr.getValueAtIndex(rt, i).asObject(rt);
                            nativeDoc.hsl_mixer[i].hue = static_cast<float>(chObj.getProperty(rt, "hue").asNumber());
                            nativeDoc.hsl_mixer[i].saturation = static_cast<float>(chObj.getProperty(rt, "saturation").asNumber());
                            nativeDoc.hsl_mixer[i].luminance = static_cast<float>(chObj.getProperty(rt, "luminance").asNumber());
                        }
                    }
                }

                int32_t result = lumaflow_process_rgba(inPtr, outPtr, width, height, &nativeDoc);
                return jsi::Value(result == 0);
            }
        )
    );

    // 3. computeHistogram(rgbaArrayBuffer) -> ArrayBuffer (1024 uint32 entries = 4096 bytes)
    lumaflowObj.setProperty(
        runtime,
        "computeHistogram",
        jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "computeHistogram"),
            1,
            [](jsi::Runtime& rt, const jsi::Value& thisVal, const jsi::Value* args, size_t count) -> jsi::Value {
                if (count < 1 || !args[0].asObject(rt).isArrayBuffer(rt)) {
                    throw jsi::JSError(rt, "computeHistogram requires 1 ArrayBuffer argument");
                }

                auto rgbaBuf = args[0].asObject(rt).getArrayBuffer(rt);
                size_t length = rgbaBuf.size(rt);
                const uint8_t* rgbaPtr = rgbaBuf.data(rt);

                // Allocate output ArrayBuffer (1024 * 4 = 4096 bytes)
                auto outArrayBuffer = rt.global().getPropertyAsFunction(rt, "ArrayBuffer").callAsConstructor(rt, 4096).asObject(rt).getArrayBuffer(rt);
                uint32_t* histPtr = reinterpret_cast<uint32_t*>(outArrayBuffer.data(rt));

                int32_t res = lumaflow_compute_histogram(rgbaPtr, length, histPtr);
                if (res != 0) {
                    throw jsi::JSError(rt, "Failed to compute histogram in native engine");
                }

                return outArrayBuffer;
            }
        )
    );

    // 4. calculateTiles(width, height, tileSize) -> Array of {x, y, width, height}
    lumaflowObj.setProperty(
        runtime,
        "calculateTiles",
        jsi::Function::createFromHostFunction(
            runtime,
            jsi::PropNameID::forAscii(runtime, "calculateTiles"),
            3,
            [](jsi::Runtime& rt, const jsi::Value& thisVal, const jsi::Value* args, size_t count) -> jsi::Value {
                if (count < 2) {
                    throw jsi::JSError(rt, "calculateTiles requires at least width and height");
                }
                uint32_t width = static_cast<uint32_t>(args[0].asNumber());
                uint32_t height = static_cast<uint32_t>(args[1].asNumber());
                uint32_t tileSize = count > 2 ? static_cast<uint32_t>(args[2].asNumber()) : 2048;

                std::vector<CTileBounds> tiles(128);
                int32_t totalTiles = lumaflow_calculate_tiles(width, height, tileSize, tiles.data(), 128);

                auto outArray = jsi::Array(rt, static_cast<size_t>(totalTiles));
                for (int32_t i = 0; i < totalTiles; ++i) {
                    auto tObj = jsi::Object(rt);
                    tObj.setProperty(rt, "x", static_cast<double>(tiles[i].x));
                    tObj.setProperty(rt, "y", static_cast<double>(tiles[i].y));
                    tObj.setProperty(rt, "width", static_cast<double>(tiles[i].width));
                    tObj.setProperty(rt, "height", static_cast<double>(tiles[i].height));
                    outArray.setValueAtIndex(rt, i, tObj);
                }
                return outArray;
            }
        )
    );

    // Register globally as __lumaflow
    runtime.global().setProperty(runtime, "__lumaflow", lumaflowObj);
}

} // namespace lumaflow
