export interface CachedItem<T> {
  key: string;
  data: T;
  sizeBytes: number;
  lastAccessed: number;
}

export class PreviewCache<T = any> {
  private cache = new Map<string, CachedItem<T>>();
  private currentSizeBytes = 0;

  constructor(private maxSizeBytes: number = 64 * 1024 * 1024) {} // 64 MB default cap

  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    item.lastAccessed = Date.now();
    return item.data;
  }

  set(key: string, data: T, sizeBytes: number): void {
    // If single item exceeds max budget, reject to avoid memory spike
    if (sizeBytes > this.maxSizeBytes) return;

    // Evict LRU items until we have enough space
    while (this.currentSizeBytes + sizeBytes > this.maxSizeBytes && this.cache.size > 0) {
      this.evictOldest();
    }

    const existing = this.cache.get(key);
    if (existing) {
      this.currentSizeBytes -= existing.sizeBytes;
    }

    this.cache.set(key, {
      key,
      data,
      sizeBytes,
      lastAccessed: Date.now()
    });
    this.currentSizeBytes += sizeBytes;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
    this.currentSizeBytes = 0;
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, item] of this.cache.entries()) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const item = this.cache.get(oldestKey);
      if (item) {
        this.currentSizeBytes -= item.sizeBytes;
        this.cache.delete(oldestKey);
      }
    }
  }

  getMemoryUsageMb(): number {
    return Math.round((this.currentSizeBytes / (1024 * 1024)) * 100) / 100;
  }

  getItemCount(): number {
    return this.cache.size;
  }
}
