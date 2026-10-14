@echo off
REM =============================================================================
REM Lumaflow Mobile - Cross-Compile Rust Core Engine for Android ABIs
REM Targets: arm64-v8a, armeabi-v7a, x86_64
REM =============================================================================

setlocal enabledelayedexpansion

echo ========================================================
echo  Lumaflow Mobile - Compiling Rust Native Engine (.so)
echo ========================================================

REM Set environment if not already set
if "%ANDROID_HOME%"=="" (
    set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
)

if "%CARGO_TARGET_DIR%"=="" (
    set "CARGO_TARGET_DIR=%LOCALAPPDATA%\lumaflow-target"
)

set "JNILIBS_DIR=%~dp0..\android\app\src\main\jniLibs"
set "RUST_CORE_DIR=%~dp0..\rust-core"

echo [1/3] Building for arm64-v8a (64-bit ARM modern mobile)...
call cargo ndk -t arm64-v8a -o "%JNILIBS_DIR%" build --release --package lumaflow-ffi
if errorlevel 1 goto error

echo [2/3] Building for armeabi-v7a (32-bit ARM legacy mobile)...
call cargo ndk -t armeabi-v7a -o "%JNILIBS_DIR%" build --release --package lumaflow-ffi
if errorlevel 1 goto error

echo [3/3] Building for x86_64 (Android Studio Emulator on PC)...
call cargo ndk -t x86_64 -o "%JNILIBS_DIR%" build --release --package lumaflow-ffi
if errorlevel 1 goto error

echo ========================================================
echo  Build Succeeded!
echo  Binaries generated in: %JNILIBS_DIR%
echo ========================================================
exit /b 0

:error
echo [ERROR] Android NDK compilation failed. Please check NDK installation and tools.
exit /b 1
