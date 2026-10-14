import { EditDocument } from '../../../types';
import { CancellationToken, createCancellationToken, FrameMetrics } from '../interfaces/ModularImageEngine';

interface RenderTask {
  id: number;
  document: EditDocument;
  token: CancellationToken;
  resolve: (metrics: FrameMetrics) => void;
  reject: (err: any) => void;
  timestamp: number;
}

export class RenderQueue {
  private taskIdCounter = 0;
  private currentTask: RenderTask | null = null;
  private pendingTask: RenderTask | null = null;
  private isProcessing = false;
  private maxDroppedTasks = 0;
  private totalEnqueuedTasks = 0;

  constructor(
    private renderExecutor: (doc: EditDocument, token: CancellationToken) => Promise<FrameMetrics>
  ) {}

  enqueue(document: EditDocument): Promise<FrameMetrics> {
    this.totalEnqueuedTasks++;
    const taskId = ++this.taskIdCounter;
    const token = createCancellationToken();

    // If there is already a pending task waiting, cancel it immediately as it is now obsolete!
    if (this.pendingTask) {
      this.pendingTask.token.cancel();
      this.maxDroppedTasks++;
      this.pendingTask.resolve({
        frameId: this.pendingTask.id,
        renderTimeMs: 0,
        gpuTimeMs: 0,
        memoryUsageMb: 0,
        wasCancelled: true,
        timestamp: Date.now()
      });
      this.pendingTask = null;
    }

    return new Promise<FrameMetrics>((resolve, reject) => {
      this.pendingTask = {
        id: taskId,
        document,
        token,
        resolve,
        reject,
        timestamp: performance.now()
      };

      this.processNext();
    });
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || !this.pendingTask) {
      return;
    }

    this.isProcessing = true;
    this.currentTask = this.pendingTask;
    this.pendingTask = null;

    try {
      const task = this.currentTask;
      if (task.token.isCancelled) {
        task.resolve({
          frameId: task.id,
          renderTimeMs: 0,
          gpuTimeMs: 0,
          memoryUsageMb: 0,
          wasCancelled: true,
          timestamp: Date.now()
        });
      } else {
        const metrics = await this.renderExecutor(task.document, task.token);
        task.resolve(metrics);
      }
    } catch (err) {
      this.currentTask.reject(err);
    } finally {
      this.isProcessing = false;
      this.currentTask = null;

      // If a new task arrived while we were rendering, process it immediately!
      if (this.pendingTask) {
        this.processNext();
      }
    }
  }

  cancelAll(): void {
    if (this.currentTask) {
      this.currentTask.token.cancel();
    }
    if (this.pendingTask) {
      this.pendingTask.token.cancel();
      this.pendingTask.resolve({
        frameId: this.pendingTask.id,
        renderTimeMs: 0,
        gpuTimeMs: 0,
        memoryUsageMb: 0,
        wasCancelled: true,
        timestamp: Date.now()
      });
      this.pendingTask = null;
    }
  }

  getEfficiency(): { total: number; dropped: number; efficiencyPercent: number } {
    const total = this.totalEnqueuedTasks;
    const dropped = this.maxDroppedTasks;
    const efficiency = total > 0 ? (dropped / total) * 100 : 0;
    return {
      total,
      dropped,
      efficiencyPercent: Math.round(efficiency * 10) / 10
    };
  }
}
