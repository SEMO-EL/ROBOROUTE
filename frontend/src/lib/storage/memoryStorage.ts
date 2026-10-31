/** An in-memory `Storage` for tests and for browsers where localStorage is unavailable. */
export class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  failWrites = false;

  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    if (this.failWrites)
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    this.data.set(key, value);
  }
}
