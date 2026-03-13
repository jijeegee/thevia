import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';

/**
 * Storage service interface.
 * Abstracts file storage to support local filesystem and future R2/S3 migration.
 */
export interface StorageService {
  /**
   * Store a JSON file and return a URL/path to retrieve it.
   * @param key - Unique file key (e.g., "definitions/{uuid}.json")
   * @param content - File content as Buffer or string
   * @returns The URL or path where the file can be retrieved
   */
  put(key: string, content: Buffer | string): Promise<string>;

  /**
   * Retrieve a file's content.
   * @param key - File key used during storage
   * @returns File content as Buffer, or null if not found
   */
  get(key: string): Promise<Buffer | null>;

  /**
   * Delete a stored file.
   * @param key - File key to delete
   */
  delete(key: string): Promise<void>;

  /**
   * Check if a file exists.
   * @param key - File key to check
   */
  exists(key: string): Promise<boolean>;
}

/**
 * Local filesystem storage implementation.
 * Stores files under server/uploads/ directory.
 */
class LocalStorageService implements StorageService {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  private getFilePath(key: string): string {
    // Sanitize key to prevent path traversal
    const sanitized = key.replace(/\.\./g, '').replace(/^\//, '');
    return path.join(this.basePath, sanitized);
  }

  async put(key: string, content: Buffer | string): Promise<string> {
    const filePath = this.getFilePath(key);
    const dir = path.dirname(filePath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(filePath, content, 'utf-8');

    // Return a relative URL path for the API
    return `/api/v1/definitions/${path.basename(key, '.json')}/json`;
  }

  async get(key: string): Promise<Buffer | null> {
    const filePath = this.getFilePath(key);

    try {
      return await fs.readFile(filePath);
    } catch (error: any) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key);

    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * R2/S3 storage implementation placeholder.
 * To be implemented when switching to cloud storage.
 */
class R2StorageService implements StorageService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async put(key: string, content: Buffer | string): Promise<string> {
    // TODO: Implement R2 upload using @aws-sdk/client-s3
    // const client = new S3Client({ endpoint: config.R2_ENDPOINT, ... });
    // await client.send(new PutObjectCommand({ Bucket: config.R2_BUCKET, Key: key, Body: content }));
    throw new Error('R2 storage not yet implemented. Set STORAGE_TYPE=local in .env');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async get(key: string): Promise<Buffer | null> {
    throw new Error('R2 storage not yet implemented');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async delete(key: string): Promise<void> {
    throw new Error('R2 storage not yet implemented');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async exists(key: string): Promise<boolean> {
    throw new Error('R2 storage not yet implemented');
  }
}

/**
 * Create the appropriate storage service based on config.
 */
export function createStorageService(): StorageService {
  switch (config.STORAGE_TYPE) {
    case 'local':
      return new LocalStorageService(config.STORAGE_LOCAL_PATH);
    case 'r2':
      return new R2StorageService();
    default:
      throw new Error(`Unknown storage type: ${config.STORAGE_TYPE}`);
  }
}

// Singleton instance
let storageInstance: StorageService | null = null;

export function getStorageService(): StorageService {
  if (!storageInstance) {
    storageInstance = createStorageService();
  }
  return storageInstance;
}
