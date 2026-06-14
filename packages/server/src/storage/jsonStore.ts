import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * A tiny JSON-file collection store. Loads once into memory, then serialises
 * writes so concurrent saves can't corrupt the file. Family-scale simple —
 * the RouteRepository/HuntRepository seams let us swap in a real DB later.
 */
export class JsonStore<T> {
  private cache: T[] | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private async load(): Promise<T[]> {
    if (this.cache) return this.cache;
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      this.cache = JSON.parse(raw) as T[];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        this.cache = [];
      } else {
        throw err;
      }
    }
    return this.cache;
  }

  /** Return a defensive copy of all rows. */
  async all(): Promise<T[]> {
    return [...(await this.load())];
  }

  /**
   * Read-modify-write under a serialised lock. The mutator works on the live
   * array and returns whatever the caller needs back.
   */
  async mutate<R>(mutator: (rows: T[]) => R): Promise<R> {
    const rows = await this.load();
    const result = mutator(rows);
    await this.persist(rows);
    return result;
  }

  private persist(rows: T[]): Promise<void> {
    this.writeChain = this.writeChain.then(async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(rows, null, 2), 'utf8');
    });
    return this.writeChain;
  }
}
