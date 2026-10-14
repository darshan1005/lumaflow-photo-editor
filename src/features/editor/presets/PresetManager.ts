import { EditDocument, Preset } from '../../../types';
import { cloneEditDocument } from '../models/EditDocument';
import { BUILT_IN_PRESETS } from './builtInPresets';

export class PresetManager {
  private userPresets: Preset[] = [];

  constructor(initialUserPresets: Preset[] = []) {
    this.userPresets = [...initialUserPresets];
  }

  getAllPresets(): Preset[] {
    return [...BUILT_IN_PRESETS, ...this.userPresets];
  }

  getPresetById(id: string): Preset | undefined {
    return this.getAllPresets().find(p => p.id === id);
  }

  applyPreset(document: EditDocument, preset: Preset): EditDocument {
    const updated = cloneEditDocument(document);
    updated.appliedPresetId = preset.id;
    updated.updatedAt = Date.now();

    if (preset.documentState.basic) {
      updated.basic = {
        ...updated.basic,
        ...preset.documentState.basic
      };
    }

    if (preset.documentState.colorGrading) {
      updated.colorGrading = {
        ...updated.colorGrading,
        ...preset.documentState.colorGrading
      };
    }

    if (preset.documentState.hslMixer) {
      updated.hslMixer = [...preset.documentState.hslMixer];
    }

    return updated;
  }

  createUserPreset(name: string, document: EditDocument): Preset {
    const newPreset: Preset = {
      id: `usr_preset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      category: 'user',
      createdAt: Date.now(),
      documentState: {
        basic: { ...document.basic },
        colorGrading: JSON.parse(JSON.stringify(document.colorGrading)),
        hslMixer: JSON.parse(JSON.stringify(document.hslMixer))
      }
    };
    this.userPresets.push(newPreset);
    return newPreset;
  }

  deleteUserPreset(id: string): boolean {
    const index = this.userPresets.findIndex(p => p.id === id);
    if (index !== -1) {
      this.userPresets.splice(index, 1);
      return true;
    }
    return false;
  }
}
