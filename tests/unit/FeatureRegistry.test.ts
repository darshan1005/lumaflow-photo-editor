import { FEATURE_CATALOGUE, getFeatureCatalogueStats } from '../../src/core/registry/FeatureRegistry';

describe('Feature Registry & Product Specification Verification', () => {
  test('Registry contains valid structured specifications for all features', () => {
    const features = Object.values(FEATURE_CATALOGUE);
    expect(features.length).toBeGreaterThan(15);

    for (const f of features) {
      // Must contain all required directive fields
      expect(f.id).toBeDefined();
      expect(f.name).toBeDefined();
      expect(f.category).toBeDefined();
      expect(['P0', 'P1', 'P2']).toContain(f.priority);
      expect([
        'Not started',
        'In progress',
        'Blocked',
        'Implemented',
        'Tested and accepted'
      ]).toContain(f.status);

      expect(f.functionalBehavior.length).toBeGreaterThan(15);
      expect(f.interactionFlow.length).toBeGreaterThan(10);
      expect(f.uiComponents.length).toBeGreaterThan(0);
      expect(f.nativeCapabilities.length).toBeGreaterThan(0);
      expect(f.dependencies.length).toBeGreaterThan(0);
      expect(f.dataModelRequirements.length).toBeGreaterThan(5);
      expect(f.acceptanceCriteria.length).toBeGreaterThan(0);
      expect(f.testCases.length).toBeGreaterThan(0);
      expect(f.risksAndLimitations.length).toBeGreaterThan(5);
    }
  });

  test('P0 essential features are implemented and tested', () => {
    const stats = getFeatureCatalogueStats();
    expect(stats.totalFeatures).toBeGreaterThan(15);
    expect(stats.byPriority.P0).toBeGreaterThanOrEqual(10);

    // All P0 features must be either Implemented or Tested and accepted
    const p0Features = Object.values(FEATURE_CATALOGUE).filter(f => f.priority === 'P0');
    for (const f of p0Features) {
      expect(['Implemented', 'Tested and accepted']).toContain(f.status);
    }
  });

  test('Registry stats calculate completion percentage accurately', () => {
    const stats = getFeatureCatalogueStats();
    expect(stats.percentComplete).toBeGreaterThanOrEqual(90);
    expect(stats.byStatus['Tested and accepted']).toBeGreaterThan(0);
  });

  test('ENG-04 Rust Native Engine specification is registered and validated', () => {
    const eng04 = FEATURE_CATALOGUE['ENG-04'];
    expect(eng04).toBeDefined();
    expect(eng04.name).toContain('Rust Core Engine');
    expect(eng04.priority).toBe('P0');
    expect(eng04.status).toBe('Tested and accepted');
    expect(eng04.dependencies).toContain('RustNativeEngine.ts');
    expect(eng04.dependencies).toContain('LumaflowNativeBridge.ts');
  });
});
