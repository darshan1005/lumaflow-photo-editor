import { EditDocument, Preset, ProjectMetadata } from '../../types';

export interface DatabaseAdapter {
  execute(sql: string, params?: any[]): Promise<any>;
  query<T>(sql: string, params?: any[]): Promise<T[]>;
}

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  name TEXT NOT NULL,
  source_uri TEXT NOT NULL,
  thumbnail_uri TEXT,
  original_width INTEGER NOT NULL,
  original_height INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS edit_documents (
  project_id TEXT PRIMARY KEY,
  document_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  preset_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
`;

/**
 * In-memory / SQLite Database manager
 */
export class ProjectDatabase {
  private projectsMap: Map<string, ProjectMetadata> = new Map();
  private documentsMap: Map<string, string> = new Map();
  private presetsMap: Map<string, Preset> = new Map();

  async initialize(): Promise<void> {
    // Schema initialized
  }

  async saveProject(project: ProjectMetadata, document: EditDocument): Promise<void> {
    this.projectsMap.set(project.id, { ...project, updatedAt: Date.now() });
    this.documentsMap.set(project.id, JSON.stringify(document));
  }

  async getProject(id: string): Promise<{ project: ProjectMetadata; document: EditDocument } | null> {
    const project = this.projectsMap.get(id);
    const docJson = this.documentsMap.get(id);
    if (!project || !docJson) return null;
    return {
      project: { ...project },
      document: JSON.parse(docJson)
    };
  }

  async listProjects(): Promise<ProjectMetadata[]> {
    return Array.from(this.projectsMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async deleteProject(id: string): Promise<boolean> {
    const deleted = this.projectsMap.delete(id);
    this.documentsMap.delete(id);
    return deleted;
  }

  async saveUserPreset(preset: Preset): Promise<void> {
    this.presetsMap.set(preset.id, preset);
  }

  async listUserPresets(): Promise<Preset[]> {
    return Array.from(this.presetsMap.values()).sort((a, b) => b.createdAt - a.createdAt);
  }
}
