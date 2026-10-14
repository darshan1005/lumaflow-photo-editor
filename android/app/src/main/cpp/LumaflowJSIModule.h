#pragma once

#include <jsi/jsi.h>

namespace lumaflow {

/**
 * Installs the __lumaflow global object on the React Native JavaScript runtime.
 * Provides zero-copy pointer access to the Rust image processing engine.
 */
void installLumaflowJSI(facebook::jsi::Runtime& runtime);

} // namespace lumaflow
