# =============================================================================
# Lumaflow Mobile - Cross-Compile Rust Core Engine for Android ABIs (PowerShell)
# =============================================================================

$ErrorActionPreference = "Stop"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " Lumaflow Mobile - Compiling Rust Native Engine (.so)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

if (-not $env:ANDROID_HOME) {
    $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
}

if (-not $env:CARGO_TARGET_DIR) {
    $env:CARGO_TARGET_DIR = "$env:LOCALAPPDATA\lumaflow-target"
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$JniLibsDir = Join-Path $ScriptDir "..\android\app\src\main\jniLibs"
$RustCoreDir = Join-Path $ScriptDir "..\rust-core"

Push-Location $RustCoreDir

try {
    Write-Host "[1/3] Building for arm64-v8a (64-bit ARM modern mobile)..." -ForegroundColor Yellow
    cargo ndk -t arm64-v8a -o "$JniLibsDir" build --release --package lumaflow-ffi

    Write-Host "[2/3] Building for armeabi-v7a (32-bit ARM legacy mobile)..." -ForegroundColor Yellow
    cargo ndk -t armeabi-v7a -o "$JniLibsDir" build --release --package lumaflow-ffi

    Write-Host "[3/3] Building for x86_64 (Android Studio Emulator on PC)..." -ForegroundColor Yellow
    cargo ndk -t x86_64 -o "$JniLibsDir" build --release --package lumaflow-ffi

    Write-Host "========================================================" -ForegroundColor Green
    Write-Host " Build Succeeded! Output placed in: $JniLibsDir" -ForegroundColor Green
    Write-Host "========================================================" -ForegroundColor Green
} finally {
    Pop-Location
}
