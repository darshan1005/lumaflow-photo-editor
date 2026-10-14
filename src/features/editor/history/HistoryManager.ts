import { EditDocument } from '../../../types';
import { cloneEditDocument } from '../models/EditDocument';

export class HistoryManager {
  private undoStack: EditDocument[] = [];
  private redoStack: EditDocument[] = [];
  private maxDepth: number;

  constructor(maxDepth: number = 50) {
    this.maxDepth = maxDepth;
  }

  push(document: EditDocument): void {
    const clone = cloneEditDocument(document);
    this.undoStack.push(clone);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    // Any new edit clears the redo stack
    this.redoStack = [];
  }

  undo(currentDocument: EditDocument): EditDocument | null {
    if (!this.canUndo()) return null;

    // Save current state to redo stack
    this.redoStack.push(cloneEditDocument(currentDocument));

    // Pop and return previous state
    const previous = this.undoStack.pop();
    return previous ? cloneEditDocument(previous) : null;
  }

  redo(currentDocument: EditDocument): EditDocument | null {
    if (!this.canRedo()) return null;

    // Save current state to undo stack
    this.undoStack.push(cloneEditDocument(currentDocument));

    // Pop and return next state
    const next = this.redoStack.pop();
    return next ? cloneEditDocument(next) : null;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  getDepth(): { undo: number; redo: number } {
    return {
      undo: this.undoStack.length,
      redo: this.redoStack.length
    };
  }
}
