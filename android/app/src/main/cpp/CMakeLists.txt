cmake_minimum_required(VERSION 3.22.1)
project(lumaflow_jsi)

set(CMAKE_CXX_STANDARD 17)

# Directory containing compiled Rust libraries
set(RUST_LIBS_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../jniLibs/${ANDROID_ABI}")

# Import prebuilt Rust static/shared library
add_library(lumaflow_ffi SHARED IMPORTED)
set_target_properties(lumaflow_ffi PROPERTIES
    IMPORTED_LOCATION "${RUST_LIBS_DIR}/liblumaflow_ffi.so"
)

# Source files for JSI bridge
add_library(lumaflow_jsi SHARED
    LumaflowJni.cpp
    LumaflowJSIModule.cpp
)

target_include_directories(lumaflow_jsi PRIVATE
    "${CMAKE_CURRENT_SOURCE_DIR}"
    "${CMAKE_CURRENT_SOURCE_DIR}/include"
)

find_package(ReactAndroid REQUIRED CONFIG)

target_link_libraries(lumaflow_jsi
    ReactAndroid::jsi
    lumaflow_ffi
    android
    log
)
