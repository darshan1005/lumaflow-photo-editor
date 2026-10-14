/**
 * Lumaflow Mobile — Lightroom-Style Feature Specification Registry
 * 
 * Machine-readable feature matrix tracking functional specifications,
 * priorities, implementation states, acceptance criteria, and test coverage.
 */

export type FeaturePriority = 'P0' | 'P1' | 'P2';
export type FeatureStatus = 'Not started' | 'In progress' | 'Blocked' | 'Implemented' | 'Tested and accepted';

export interface FeatureSpecification {
  id: string;
  name: string;
  category: 
    | 'Library & Assets'
    | 'Editing Workspace'
    | 'Light Adjustments'
    | 'Color Adjustments'
    | 'Effects & Detail'
    | 'Geometry & Crop'
    | 'Presets & Looks'
    | 'Masking & Selective'
    | 'Healing & Retouching'
    | 'Camera & Capture'
    | 'RAW & Color Management'
    | 'Export & Delivery'
    | 'Settings & Onboarding'
    | 'Engine & Infrastructure'
    | 'QA & Validation';
  priority: FeaturePriority;
  status: FeatureStatus;
  functionalBehavior: string;
  interactionFlow: string;
  uiComponents: string[];
  nativeCapabilities: string[];
  dependencies: string[];
  dataModelRequirements: string;
  acceptanceCriteria: string[];
  testCases: string[];
  risksAndLimitations: string;
}

export const FEATURE_CATALOGUE: Record<string, FeatureSpecification> = {
  // ----------------------------------------------------
  // MODULE 1: Photo Library & Asset Management
  // ----------------------------------------------------
  'LIB-01': {
    id: 'LIB-01',
    name: 'Home / Library Screen',
    category: 'Library & Assets',
    priority: 'P0',
    status: 'Tested and accepted',
    functionalBehavior: 'Displays imported photo library, sample shoots, metadata chips, and entry points for import and editing with empty/loading states.',
    interactionFlow: 'User launches app -> views grid -> taps item to edit or taps "+ Import Photo" to add images.',
    uiComponents: ['LibraryScreen', 'PhotoCard', 'ImportFloatingActionButton'],
    nativeCapabilities: ['expo-media-library', 'expo-file-system'],
    dependencies: ['ProjectDatabase', 'useEditorStore'],
    dataModelRequirements: 'ProjectMetadata table in SQLite with id, assetId, sourceUri, thumbnailUri, timestamps.',
    acceptanceCriteria: [
      'Renders responsive grid without UI stutters.',
      'Displays empty state when 0 assets exist.',
      'Tapping an asset navigates into EditorScreen with session initialized.'
    ],
    testCases: ['LibraryScreen.render.test.ts', 'EditDocument.test.ts'],
    risksAndLimitations: 'Large library memory pressure mitigated via virtualized list downsampling.'
  },
  'LIB-02': {
    id: 'LIB-02',
    name: 'Import Photos',
    category: 'Library & Assets',
    priority: 'P0',
    status: 'Implemented',
    functionalBehavior: 'Allows picking images from device gallery via system picker, validates formats, preserves original path, and creates database record.',
    interactionFlow: 'Tap "+ Import Photo" -> opens picker -> user selects image -> thumbnail generated -> asset registered in library.',
    uiComponents: ['LibraryScreen', 'ImagePickerLauncher'],
    nativeCapabilities: ['expo-image-picker', 'expo-file-system'],
    dependencies: ['LIB-01', 'ProjectDatabase'],
    dataModelRequirements: 'New ProjectMetadata row inserted into SQLite.',
    acceptanceCriteria: [
      'Preserves original source URI as read-only.',
      'Validates JPEG/PNG/WebP formats.',
      'Generates thumbnail without memory leak.'
    ],
    testCases: ['ImportPhotos.test.ts'],
    risksAndLimitations: 'File access revoked by OS handled by fallback placeholder.'
  },
  'LIB-03': {
    id: 'LIB-03',
    name: 'Device Gallery Access & Permissions',
    category: 'Library & Assets',
    priority: 'P0',
    status: 'Implemented',
    functionalBehavior: 'Requests read permissions gracefully; handles denied or limited access without crashes.',
    interactionFlow: 'App launch -> prompt permission -> if denied, show explanatory banner with Settings link.',
    uiComponents: ['PermissionBanner', 'LibraryEmptyState'],
    nativeCapabilities: ['expo-media-library', 'PermissionsAndroid'],
    dependencies: ['LIB-02'],
    dataModelRequirements: 'Local preference for permission prompt state.',
    acceptanceCriteria: [
      'Never crashes if user denies gallery permission.',
      'Recovers when user re-enables permission in Settings.'
    ],
    testCases: ['Permissions.test.ts'],
    risksAndLimitations: 'Android 13+ granular READ_MEDIA_IMAGES permission differences.'
  },
  'LIB-04': {
    id: 'LIB-04',
    name: 'Photo Grid & Virtualization',
    category: 'Library & Assets',
    priority: 'P0',
    status: 'Tested and accepted',
    functionalBehavior: 'Scrollable multi-column grid of thumbnail previews. Never decodes full-res images simultaneously.',
    interactionFlow: 'Scroll vertically with smooth 60fps framerate.',
    uiComponents: ['LibraryGrid', 'FlatList', 'ThumbnailImage'],
    nativeCapabilities: ['Image rendering'],
    dependencies: ['LIB-01', 'ENG-05'],
    dataModelRequirements: 'Thumbnail URIs cached in memory and disk.',
    acceptanceCriteria: [
      'Maintains 60fps scrolling performance.',
      'Reuses cell components without unbounded texture allocation.'
    ],
    testCases: ['EngineBenchmark.test.ts'],
    risksAndLimitations: 'Heap spike if thumbnails exceed 512px; capped to 300px max.'
  },
  'LIB-05': {
    id: 'LIB-05',
    name: 'Photo Detail View & Metadata',
    category: 'Library & Assets',
    priority: 'P1',
    status: 'Implemented',
    functionalBehavior: 'Displays dimensions, capture date, asset ID, and EXIF parameters in photo detail overlay.',
    interactionFlow: 'Long press or tap info badge on photo -> shows slide-up sheet with ISO, lens, shutter, and dimensions.',
    uiComponents: ['MetadataSheet', 'ExifBadge'],
    nativeCapabilities: ['expo-media-library EXIF extraction'],
    dependencies: ['LIB-01'],
    dataModelRequirements: 'ProjectMetadata fields originalWidth, originalHeight, captureDate.',
    acceptanceCriteria: [
      'Accurately displays aspect ratio and pixel dimensions.',
      'Handles missing EXIF fields gracefully.'
    ],
    testCases: ['MetadataParsing.test.ts'],
    risksAndLimitations: 'Stripped EXIF on web uploads.'
  },

  // ----------------------------------------------------
  // MODULE 2: Main Editing Workspace & Workflow
  // ----------------------------------------------------
  'EDIT-01': {
    id: 'EDIT-01',
    name: 'Dark Editing Workspace',
    category: 'Editing Workspace',
    priority: 'P0',
    status: 'Tested and accepted',
    functionalBehavior: 'Distraction-free dark neutral gray UI (#0a0b0d) optimized for critical color evaluation.',
    interactionFlow: 'Tap photo -> enters EditorScreen with top header, central preview, and bottom drawer.',
    uiComponents: ['EditorScreen', 'TopBar', 'BottomDrawer'],
    nativeCapabilities: ['react-native-safe-area-context', 'StatusBar'],
    dependencies: ['useEditorStore', 'colors.ts'],
    dataModelRequirements: 'Active EditDocument in Zustand store.',
    acceptanceCriteria: [
      'Zero UI glare around photo canvas.',
      'Safe area insets handled across notches and gesture bars.'
    ],
    testCases: ['EditorScreen.test.ts'],
    risksAndLimitations: 'OLED pure black vs 18% gray color perception bias.'
  },
  'EDIT-02': {
    id: 'EDIT-02',
    name: 'Editing Toolbar Navigation',
    category: 'Editing Workspace',
    priority: 'P0',
    status: 'Tested and accepted',
    functionalBehavior: 'Horizontal categorized drawer: Light, Color, Grading, Mixer, Masking, Erase, Crop, Presets.',
    interactionFlow: 'Tap toolbar category tab -> bottom drawer switches adjustment controls immediately.',
    uiComponents: ['EditingToolbar', 'TabItem'],
    nativeCapabilities: ['ScrollView'],
    dependencies: ['EDIT-01'],
    dataModelRequirements: 'activeTab in EditorState.',
    acceptanceCriteria: [
      'Active tab highlighted with cyan indicator bar.',
      'Seamless switching without recreating preview viewport.'
    ],
    testCases: ['ToolbarNavigation.test.ts'],
    risksAndLimitations: 'Toolbar overflow on small screens handled by horizontal scroll.'
  },
  'EDIT-03': {
    id: 'EDIT-03',
    name: 'Interactive Preview Canvas',
    category: 'Editing Workspace',
    priority: 'P0',
    status: 'Tested and accepted',
    functionalBehavior: 'Renders photo with full radiometric transformation stack applied in real-time.',
    interactionFlow: 'Adjust slider -> preview updates with zero perceptible lag (<16.6ms).',
    uiComponents: ['EditorScreen viewport', 'ImagePreview', 'FilterOverlay'],
    nativeCapabilities: ['CSS/GL filters', 'SkiaShaderEffect'],
    dependencies: ['ENG-01', 'ENG-04'],
    dataModelRequirements: 'currentDocument.basic, crop, grading, mixer.',
    acceptanceCriteria: [
      'Updates dynamically without full-res re-decoding.',
      'Zero pixel buffer transfers over React Native bridge during dragging.'
    ],
    testCases: ['ExposureAdjustmentPoc.test.ts', 'EngineBenchmark.test.ts'],
    risksAndLimitations: 'CSS filter approximation on Web vs SkSL native parity.'
  },
  'EDIT-04': {
    id: 'EDIT-04',
    name: 'Before / After Comparison & Split View',
    category: 'Editing Workspace',
    priority: 'P0',
    status: 'Tested and accepted',
    functionalBehavior: 'Provides split-view divider dragging (BEFORE on left, AFTER on right) and press-and-hold original comparison.',
    interactionFlow: 'Tap "Split" -> drag center divider horizontally. Or hold "Hold Original" / long press on photo.',
    uiComponents: ['BeforeAfterViewer', 'SplitDivider', 'OriginalBadge'],
    nativeCapabilities: ['PanResponder'],
    dependencies: ['EDIT-03'],
    dataModelRequirements: 'isSplitViewActive, splitPosition, isHoldingOriginal in store.',
    acceptanceCriteria: [
      'Split divider smoothly tracks touch/mouse drag horizontally across canvas.',
      'Hold original instantly toggles original without altering saved document values.'
    ],
    testCases: ['BeforeAfter.test.ts'],
    risksAndLimitations: 'Clipping container synchronization during pinch-zoom.'
  },
  'EDIT-05': {
    id: 'EDIT-05',
    name: 'Undo / Redo History Stack',
    category: 'Editing Workspace',
    priority: 'P0',
    status: 'Tested and accepted',
    functionalBehavior: 'Maintains 50-state snapshot ring-buffer for instant undo and redo of adjustments, crops, and presets.',
    interactionFlow: 'Make edits -> tap "↶ Undo" -> reverts to previous state -> tap "↷ Redo" -> restores.',
    uiComponents: ['TopBar historyGroup', 'UndoButton', 'RedoButton'],
    nativeCapabilities: ['None (pure JS memory stack)'],
    dependencies: ['HistoryManager', 'EditDocument'],
    dataModelRequirements: 'HistoryManager with capacity: 50 in useEditorStore.',
    acceptanceCriteria: [
      'Undo restores all sliders, crops, and presets accurately.',
      'Buttons visually disable when undo/redo stack is empty.'
    ],
    testCases: ['ExposureAdjustmentPoc.test.ts (Test 5)'],
    risksAndLimitations: 'Memory bounded by deep-cloning JSON snapshots (avg <4KB each).'
  },
  'EDIT-06': {
    id: 'EDIT-06',
    name: 'Reset Adjustments',
    category: 'Editing Workspace',
    priority: 'P0',
    status: 'Tested and accepted',
    functionalBehavior: 'Resets the active module (e.g. Light or Color) or all edits back to neutral defaults with undo preservation.',
    interactionFlow: 'Tap "Reset" in top bar -> confirms and reverts sliders to 0.',
    uiComponents: ['ResetButton', 'AdjustmentSlider resetHint'],
    nativeCapabilities: ['Alert/Modal'],
    dependencies: ['EDIT-05', 'EditDocument'],
    dataModelRequirements: 'resetActiveModule action in useEditorStore.',
    acceptanceCriteria: [
      'Reverts all values to neutral 0.',
      'Allows undoing the reset operation.'
    ],
    testCases: ['EditDocument.test.ts'],
    risksAndLimitations: 'Accidental taps prevented by undo capability.'
  },
  'EDIT-07': {
    id: 'EDIT-07',
    name: 'Non-Destructive Original Preservation',
    category: 'Editing Workspace',
    priority: 'P0',
    status: 'Tested and accepted',
    functionalBehavior: 'Source photos are marked strictly read-only on disk. Edits exist only as delta math documents.',
    interactionFlow: 'Transparent background operation.',
    uiComponents: ['None (architectural guarantee)'],
    nativeCapabilities: ['expo-file-system'],
    dependencies: ['EditDocument', 'ProjectDatabase'],
    dataModelRequirements: 'sourceUri is immutable in EditDocument.',
    acceptanceCriteria: [
      'Source photo file hash never changes.',
      'Exports write to new unique file URIs.'
    ],
    testCases: ['EngineBenchmark.test.ts (Benchmark 4)'],
    risksAndLimitations: 'Device storage space for export outputs.'
  },

  // ----------------------------------------------------
  // MODULE 3: Light Adjustments
  // ----------------------------------------------------
  'LIGHT-01': {
    id: 'LIGHT-01',
    name: 'Exposure Adjustment',
    category: 'Light Adjustments',
    priority: 'P0',
    status: 'Tested and accepted',
    functionalBehavior: 'Scales radiometric pixel energy in linear space (pow(2.0, exposure)) across -2.0 to +2.0 EV.',
    interactionFlow: 'Drag Exposure slider -> image brightens or darkens with photographic fidelity.',
    uiComponents: ['AdjustmentSlider', 'AdjustmentPanel'],
    nativeCapabilities: ['GPU Shader / CpuEngine'],
    dependencies: ['ENG-01', 'EDIT-03'],
    dataModelRequirements: 'currentDocument.basic.exposure (-2.0 to +2.0).',
    acceptanceCriteria: [
      '+1 EV doubles radiometric energy; -1 EV halves energy.',
      'Tested to alter middle gray 128 to >170 at +1EV and <95 at -1EV.'
    ],
    testCases: ['ExposureAdjustmentPoc.test.ts (Test 2)'],
    risksAndLimitations: 'Extreme positive exposure clipping mitigated by smooth shoulder curve.'
  },
  'LIGHT-02': {
    id: 'LIGHT-02',
    name: 'Contrast',
    category: 'Light Adjustments',
    priority: 'P0',
    status: 'Tested and accepted',
    functionalBehavior: 'Expands or compresses tonal separation around a 0.18 mid-gray linear pivot across -100 to +100.',
    interactionFlow: 'Drag Contrast slider -> deepens blacks and lifts whites simultaneously.',
    uiComponents: ['AdjustmentSlider', 'AdjustmentPanel'],
    nativeCapabilities: ['GPU Shader / CpuEngine'],
    dependencies: ['ENG-01', 'LIGHT-01'],
    dataModelRequirements: 'currentDocument.basic.contrast (-100 to +100).',
    acceptanceCriteria: [
      'Maintains midtone stability without harsh clipping.',
      'Smooth transition through 0 neutral mark.'
    ],
    testCases: ['ExposureAdjustmentPoc.test.ts'],
    risksAndLimitations: 'High contrast edge posterization avoided by 16-bit intermediate calculation.'
  },
  'LIGHT-03': {
    id: 'LIGHT-03',
    name: 'Highlights & Shadows',
    category: 'Light Adjustments',
    priority: 'P0',
    status: 'Tested and accepted',
    functionalBehavior: 'Selective tonal range recovery using smoothstep luminance isolation masks.',
    interactionFlow: 'Drag Highlights to recover blown skies; drag Shadows to lift dark details.',
    uiComponents: ['AdjustmentSlider', 'AdjustmentPanel'],
    nativeCapabilities: ['GPU Shader / CpuEngine'],
    dependencies: ['ENG-01'],
    dataModelRequirements: 'currentDocument.basic.highlights, shadows (-100 to +100).',
    acceptanceCriteria: [
      'Highlights adjustment isolates tones >0.6 luminance.',
      'Shadows adjustment isolates tones <0.4 luminance without lifting blacks to gray.'
    ],
    testCases: ['ExposureAdjustmentPoc.test.ts'],
    risksAndLimitations: 'Halo artifacts near high-contrast edges eliminated by smoothstep falloff.'
  },
  'LIGHT-04': {
    id: 'LIGHT-04',
    name: 'Whites & Blacks',
    category: 'Light Adjustments',
    priority: 'P1',
    status: 'Tested and accepted',
    functionalBehavior: 'Fine-tunes the absolute white point clipping limit and deep black anchor point.',
    interactionFlow: 'Drag Whites to brighten specular highlights; drag Blacks to set true black punch.',
    uiComponents: ['AdjustmentSlider', 'AdjustmentPanel'],
    nativeCapabilities: ['GPU Shader / CpuEngine'],
    dependencies: ['ENG-01', 'LIGHT-03'],
    dataModelRequirements: 'currentDocument.basic.whites, blacks (-100 to +100).',
    acceptanceCriteria: [
      'Interacts predictably with Highlights and Shadows controls.',
      'Zero distortion of middle grays.'
    ],
    testCases: ['EditDocument.test.ts'],
    risksAndLimitations: 'Clipping to pure 0 or 255 if overdriven.'
  },

  // ----------------------------------------------------
  // MODULE 4: Color Adjustments
  // ----------------------------------------------------
  'COLOR-01': {
    id: 'COLOR-01',
    name: 'White Balance (Temperature & Tint)',
    category: 'Color Adjustments',
    priority: 'P0',
    status: 'Tested and accepted',
    functionalBehavior: 'Shifts chromaticity along the Planckian blackbody locus (amber/cool) and green/magenta tint axis.',
    interactionFlow: 'Drag Temp slider right for sunset warmth; left for cool blue morning light.',
    uiComponents: ['AdjustmentSlider', 'AdjustmentPanel'],
    nativeCapabilities: ['GPU Shader / CpuEngine'],
    dependencies: ['ENG-01'],
    dataModelRequirements: 'currentDocument.basic.temperature, tint (-100 to +100).',
    acceptanceCriteria: [
      'Warmer temperature increases Red channel and decreases Blue channel.',
      'Tint cleanly shifts green/magenta balance without luminance shift.'
    ],
    testCases: ['ExposureAdjustmentPoc.test.ts (Test 3)'],
    risksAndLimitations: 'Color cast on specular whites prevented by chromatic adaptation matrix.'
  },
  'COLOR-02': {
    id: 'COLOR-02',
    name: 'Vibrance & Saturation',
    category: 'Color Adjustments',
    priority: 'P0',
    status: 'Tested and accepted',
    functionalBehavior: 'Vibrance selectively boosts muted colors while protecting human skin tones; Saturation boosts all channels.',
    interactionFlow: 'Drag Vibrance to make background colors pop safely; drag Saturation for overall richness.',
    uiComponents: ['AdjustmentSlider', 'AdjustmentPanel'],
    nativeCapabilities: ['GPU Shader / CpuEngine'],
    dependencies: ['ENG-01'],
    dataModelRequirements: 'currentDocument.basic.vibrance, saturation (-100 to +100).',
    acceptanceCriteria: [
      'Vibrance dampens saturation boost on pixels with high saturation.',
      'Saturation at -100 produces pure monochrome grayscale.'
    ],
    testCases: ['ExposureAdjustmentPoc.test.ts'],
    risksAndLimitations: 'Color banding during oversaturation avoided by float precision.'
  },
  'COLOR-03': {
    id: 'COLOR-03',
    name: 'Color Mixer (8-Channel HSL)',
    category: 'Color Adjustments',
    priority: 'P1',
    status: 'Tested and accepted',
    functionalBehavior: 'Independent Hue (-100..+100), Saturation (-100..+100), and Luminance (-100..+100) controls for 8 color channels.',
    interactionFlow: 'Tap color dot (Red, Orange, Yellow, Green, Aqua, Blue, Purple, Magenta) -> adjust H/S/L sliders.',
    uiComponents: ['HslMixer', 'ColorDotRow', 'AdjustmentSlider'],
    nativeCapabilities: ['GPU Shader / CpuEngine'],
    dependencies: ['ENG-01'],
    dataModelRequirements: 'currentDocument.hslMixer array of 8 HslChannels.',
    acceptanceCriteria: [
      'Circular hue-distance weighting prevents sharp boundaries between color bands.',
      'Changing Orange luminance adjusts skin brightness without altering blue skies.'
    ],
    testCases: ['EditDocument.test.ts'],
    risksAndLimitations: 'Hue wraparound at 360/0 degrees handled smoothly.'
  },
  'COLOR-04': {
    id: 'COLOR-04',
    name: '3-Way Color Grading',
    category: 'Color Adjustments',
    priority: 'P1',
    status: 'Tested and accepted',
    functionalBehavior: 'Cinematic color tinting wheels for Shadows, Midtones, Highlights, and Global + Blending and Balance.',
    interactionFlow: 'Tap Shadows/Midtones/Highlights pill -> adjust Hue (0-360), Saturation (0-100), and Luminance (-100..+100).',
    uiComponents: ['ColorWheel', 'PillSelector', 'AdjustmentSlider'],
    nativeCapabilities: ['GPU Shader / CpuEngine'],
    dependencies: ['ENG-01'],
    dataModelRequirements: 'currentDocument.colorGrading in EditDocument.',
    acceptanceCriteria: [
      'Shadows tint applies predominantly to low luminance pixels.',
      'Balance slider shifts the boundary between shadow and highlight grading.'
    ],
    testCases: ['EditDocument.test.ts'],
    risksAndLimitations: 'Muddy midtones prevented by smooth tonal weight curves.'
  },

  // ----------------------------------------------------
  // MODULE 5: Geometry, Crop & Rotation
  // ----------------------------------------------------
  'GEOM-01': {
    id: 'GEOM-01',
    name: 'Crop & Aspect Ratios',
    category: 'Geometry & Crop',
    priority: 'P0',
    status: 'Tested and accepted',
    functionalBehavior: 'Interactive crop with aspect ratio presets (Original, Free, 1:1, 4:5, 16:9, 3:2) and rule-of-thirds grid.',
    interactionFlow: 'Tap Crop tab -> tap aspect ratio button -> crop box updates on image preview.',
    uiComponents: ['CropEditor', 'CropOverlay', 'RuleOfThirdsGrid'],
    nativeCapabilities: ['View transform'],
    dependencies: ['EDIT-03'],
    dataModelRequirements: 'currentDocument.crop (x, y, width, height normalized 0..1).',
    acceptanceCriteria: [
      'Aspect ratio lock preserves exact proportions during crop resizing.',
      'Coordinates normalized [0..1] so crop scales identically to export.'
    ],
    testCases: ['EditDocument.test.ts'],
    risksAndLimitations: 'Crop box out-of-bounds rejected by validateEditDocument.'
  },
  'GEOM-02': {
    id: 'GEOM-02',
    name: 'Rotate, Flip & Straighten',
    category: 'Geometry & Crop',
    priority: 'P0',
    status: 'Tested and accepted',
    functionalBehavior: '90-degree increment rotation, horizontal/vertical mirroring, and -45 to +45 degree fine straightening slider.',
    interactionFlow: 'Tap Rotate -> image rotates 90°; tap Flip H -> mirrors horizontally; drag Straighten -> tilts angle.',
    uiComponents: ['CropEditor', 'AdjustmentSlider'],
    nativeCapabilities: ['Transform matrix'],
    dependencies: ['GEOM-01'],
    dataModelRequirements: 'currentDocument.crop.rotation, flipHorizontal, flipVertical, straightenAngle.',
    acceptanceCriteria: [
      'Rotates and mirrors without modifying the source file on disk.',
      'Straightening angle updates live in preview.'
    ],
    testCases: ['EditDocument.test.ts'],
    risksAndLimitations: 'Corner clipping during tilt handled by preview bounding.'
  },

  // ----------------------------------------------------
  // MODULE 6: Presets & Looks
  // ----------------------------------------------------
  'PRESET-01': {
    id: 'PRESET-01',
    name: 'Built-in Preset Looks',
    category: 'Presets & Looks',
    priority: 'P0',
    status: 'Tested and accepted',
    functionalBehavior: 'Curated professional looks: Vivid Nature, Warm Golden Hour, Moody Film, Deep Dramatic B&W, Clean Portrait, Cool Urban Cinema.',
    interactionFlow: 'Tap Presets tab -> tap preset card -> preset values merged into document and image transforms instantly.',
    uiComponents: ['PresetScroll', 'PresetCard', 'ActiveCheckmark'],
    nativeCapabilities: ['None (pure JS state)'],
    dependencies: ['useEditorStore', 'PresetManager'],
    dataModelRequirements: 'Preset objects in builtInPresets.ts; appliedPresetId in EditDocument.',
    acceptanceCriteria: [
      'Applying preset updates basic, colorGrading, and hslMixer deterministically.',
      'Undo restores state prior to preset application.'
    ],
    testCases: ['ExposureAdjustmentPoc.test.ts (Test 6)'],
    risksAndLimitations: 'Preset overwriting intentional edits mitigated by undo stack.'
  },

  // ----------------------------------------------------
  // MODULE 7: Masking & Selective Editing
  // ----------------------------------------------------
  'MASK-01': {
    id: 'MASK-01',
    name: 'Selective Masking (Brush, Linear & Radial)',
    category: 'Masking & Selective',
    priority: 'P1',
    status: 'Tested and accepted',
    functionalBehavior: 'Supports Brush, Linear Gradient (graduated sky filter), and Radial Gradient masks with local Exposure, Contrast, Saturation, Temp.',
    interactionFlow: 'Tap Masking -> tap "+ Linear Grad" -> adjust mask exposure -> sky darkens selectively -> toggle Invert.',
    uiComponents: ['MaskingPanel', 'MaskRubylithOverlay', 'AdjustmentSlider'],
    nativeCapabilities: ['Shader mask sampling'],
    dependencies: ['ENG-01', 'EDIT-03'],
    dataModelRequirements: 'currentDocument.masks array of MaskAdjustment objects.',
    acceptanceCriteria: [
      'Local adjustments affect only pixels inside the mask region.',
      'Invert toggle reverses mask selection instantly.',
      'Rubylith overlay shows mask boundaries during editing.'
    ],
    testCases: ['EditDocument.test.ts'],
    risksAndLimitations: 'Complex gradient evaluation on low-end GPUs; uses efficient analytic distance equations.'
  },

  // ----------------------------------------------------
  // MODULE 8: Healing, Cloning & Object Removal
  // ----------------------------------------------------
  'HEAL-01': {
    id: 'HEAL-01',
    name: 'Smart Erase & Blemish Healing',
    category: 'Healing & Retouching',
    priority: 'P1',
    status: 'Tested and accepted',
    functionalBehavior: 'Interactive healing tool for removing blemishes, wires, or unwanted spots with adjustable Brush Size and Feather.',
    interactionFlow: 'Tap Erase tab -> tap or paint on unwanted object in photo -> healing spot placed with glowing indicator -> blemish blended.',
    uiComponents: ['SmartErasePanel', 'HealingSpotOverlay', 'AdjustmentSlider'],
    nativeCapabilities: ['Canvas / Inpainting'],
    dependencies: ['ENG-01', 'EDIT-03'],
    dataModelRequirements: 'currentDocument.healingSpots array of HealingSpot objects.',
    acceptanceCriteria: [
      'Places healing spots at tapped coordinates with defined radius.',
      'Allows deleting individual spots or clearing all spots at once.',
      'Spots persist non-destructively in EditDocument.'
    ],
    testCases: ['EditDocument.test.ts'],
    risksAndLimitations: 'Complex texture synthesis in high-frequency regions.'
  },

  // ----------------------------------------------------
  // MODULE 9: Export, Sharing & Delivery
  // ----------------------------------------------------
  'EXP-01': {
    id: 'EXP-01',
    name: 'Export Single Photo',
    category: 'Export & Delivery',
    priority: 'P0',
    status: 'Tested and accepted',
    functionalBehavior: 'Renders full-resolution image applying complete versioned EditDocument stack to JPEG, PNG, or WebP with configurable quality.',
    interactionFlow: 'Tap "Export" -> select format (JPEG/PNG/WebP), Quality (10-100%), and Scale (100%/50%) -> tap "Save to Gallery".',
    uiComponents: ['ExportDialog', 'ProgressBar'],
    nativeCapabilities: ['expo-file-system', 'expo-media-library'],
    dependencies: ['ModularImageEngine', 'EditDocument'],
    dataModelRequirements: 'ExportOptions interface (format, quality, scale).',
    acceptanceCriteria: [
      'Generates valid output file containing all adjustments.',
      'Preserves image aspect ratio and crop orientation.',
      'Throughput measured at >100 MP/sec.'
    ],
    testCases: ['ExposureAdjustmentPoc.test.ts (Test 4)', 'EngineBenchmark.test.ts'],
    risksAndLimitations: 'High-res memory spike prevented by tiled native pipeline.'
  },

  // ----------------------------------------------------
  // MODULE 10: Image Engine & Performance Infrastructure
  // ----------------------------------------------------
  'ENG-01': {
    id: 'ENG-01',
    name: 'Modular Processing Engine & Shaders',
    category: 'Engine & Infrastructure',
    priority: 'P0',
    status: 'Tested and accepted',
    functionalBehavior: 'GPU-accelerated SkSL/GLSL shader pipeline executing linear radiometric color, Planckian white balance, and tone curves.',
    interactionFlow: 'Transparent core execution engine.',
    uiComponents: ['None (core engine)'],
    nativeCapabilities: ['React Native Skia / WebGL', 'GLES 3.0 / Metal'],
    dependencies: ['ModularImageEngine.ts', 'SkiaShaderEffect.ts'],
    dataModelRequirements: 'Float uniform vector.',
    acceptanceCriteria: [
      'Sub-16.6ms latency (>60 FPS) on 1080p preview.',
      'Zero pixel buffer transfers across React Native JavaScript bridge during slider scrubbing.'
    ],
    testCases: ['EngineBenchmark.test.ts (Benchmark 1)'],
    risksAndLimitations: 'C++ engine deferred until shader/Skia limitations demonstrated.'
  },
  'ENG-02': {
    id: 'ENG-02',
    name: 'Render Queue & Task Cancellation',
    category: 'Engine & Infrastructure',
    priority: 'P0',
    status: 'Tested and accepted',
    functionalBehavior: 'Bounded concurrency queue with CancellationToken that automatically drops obsolete in-flight renders during rapid scrubbing.',
    interactionFlow: 'User scrubs slider rapidly at 120Hz -> queue cancels superseded frames -> renders only latest frame.',
    uiComponents: ['None (core queue)'],
    nativeCapabilities: ['Promise / CancellationToken'],
    dependencies: ['RenderQueue.ts'],
    dataModelRequirements: 'FrameMetrics and CancellationToken.',
    acceptanceCriteria: [
      'Achieves >70% cancellation efficiency during rapid slider bursts.',
      'Guarantees bounded heap memory overhead.'
    ],
    testCases: ['EngineBenchmark.test.ts (Benchmark 2)'],
    risksAndLimitations: 'Thread starvation avoided by single active worker bound.'
  },
  'ENG-03': {
    id: 'ENG-03',
    name: 'Bounded Preview Cache (64MB LRU)',
    category: 'Engine & Infrastructure',
    priority: 'P0',
    status: 'Tested and accepted',
    functionalBehavior: 'LRU memory cache with strict byte budget (default 64MB) and timestamp-based eviction.',
    interactionFlow: 'Transparent memory management.',
    uiComponents: ['None (cache infrastructure)'],
    nativeCapabilities: ['Memory management'],
    dependencies: ['PreviewCache.ts'],
    dataModelRequirements: 'CachedItem<T> map in PreviewCache.',
    acceptanceCriteria: [
      'Never exceeds maximum memory budget.',
      'Evicts oldest items automatically under memory pressure.'
    ],
    testCases: ['EngineBenchmark.test.ts (Benchmark 3)'],
    risksAndLimitations: 'Memory leak prevention.'
  },
  'ENG-04': {
    id: 'ENG-04',
    name: 'Rust Core Engine & Zero-Copy JSI Bridge',
    category: 'Engine & Infrastructure',
    priority: 'P0',
    status: 'Tested and accepted',
    functionalBehavior: 'High-performance compiled Rust core engine (Rayon multi-core SIMD pipeline) with zero-copy JSI C++ host bindings, 256-bin real-time histogram generator, and memory-bounded tiled export.',
    interactionFlow: 'User adjusts controls -> JSI dispatches float parameters synchronously to Rust -> pixels processed in native memory without React Native bridge serialization.',
    uiComponents: ['None (core engine & JSI bridge)'],
    nativeCapabilities: ['Rust 1.99', 'C-ABI FFI', 'React Native JSI / TurboModules', 'Rayon Parallelism'],
    dependencies: ['RustNativeEngine.ts', 'LumaflowNativeBridge.ts', 'lumaflow_ffi.h', 'lumaflow-core'],
    dataModelRequirements: 'CNativeEditDocument, NativeHistogramResult, EditDocument.',
    acceptanceCriteria: [
      'Executes 1080p frame processing in <3.0ms across multi-core Rayon threads.',
      'Computes 256-bin RGB and Luma real-time histograms in <2.0ms.',
      'Zero pixel buffer serialization across the JavaScript bridge.',
      'Graceful fallback to CpuEngine on platforms without compiled native binary.'
    ],
    testCases: [
      'tests/unit/NativeBridge.test.ts',
      'tests/unit/RustNativeEngine.test.ts',
      'rust-core/crates/lumaflow-core/tests/poc_tests.rs'
    ],
    risksAndLimitations: 'Requires platform NDK/MSVC toolchain for native cross-compilation.'
  },

  // ----------------------------------------------------
  // MODULE 11: QA & Automated Testing
  // ----------------------------------------------------
  'QA-01': {
    id: 'QA-01',
    name: 'Automated Unit & Benchmark Test Suite',
    category: 'QA & Validation',
    priority: 'P0',
    status: 'Tested and accepted',
    functionalBehavior: 'Full Jest test suite validating radiometric accuracy, document validation, history undo/redo, presets, and performance benchmarks.',
    interactionFlow: 'CI/CD and local test runner (`npm test`).',
    uiComponents: ['None (Jest test runner)'],
    nativeCapabilities: ['Node.js V8 test runtime'],
    dependencies: ['jest', 'ts-jest'],
    dataModelRequirements: 'All model types.',
    acceptanceCriteria: [
      '100% test pass rate across all test suites.',
      'Validates all P0 requirements and performance bounds.'
    ],
    testCases: [
      'tests/unit/EditDocument.test.ts',
      'tests/rendering/ExposureAdjustmentPoc.test.ts',
      'tests/rendering/EngineBenchmark.test.ts'
    ],
    risksAndLimitations: 'Mocking native platform APIs in Node environment.'
  }
};

/**
 * Registry Summary Statistics
 */
export function getFeatureCatalogueStats() {
  const all = Object.values(FEATURE_CATALOGUE);
  const byPriority = {
    P0: all.filter(f => f.priority === 'P0').length,
    P1: all.filter(f => f.priority === 'P1').length,
    P2: all.filter(f => f.priority === 'P2').length
  };
  const byStatus = {
    'Tested and accepted': all.filter(f => f.status === 'Tested and accepted').length,
    'Implemented': all.filter(f => f.status === 'Implemented').length,
    'In progress': all.filter(f => f.status === 'In progress').length,
    'Not started': all.filter(f => f.status === 'Not started').length,
    'Blocked': all.filter(f => f.status === 'Blocked').length
  };
  return {
    totalFeatures: all.length,
    byPriority,
    byStatus,
    percentComplete: Math.round(((byStatus['Tested and accepted'] + byStatus['Implemented']) / all.length) * 100)
  };
}
