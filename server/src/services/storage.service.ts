import fs from 'fs/promises';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
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
 * Cloudflare R2 storage implementation.
 * Uses S3-compatible API via @aws-sdk/client-s3.
 */
class R2StorageService implements StorageService {
  private client: S3Client;
  private bucket: string;

  constructor() {
    if (!config.R2_ENDPOINT || !config.R2_ACCESS_KEY_ID || !config.R2_SECRET_ACCESS_KEY) {
      throw new Error('R2 storage requires R2_ENDPOINT, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY');
    }

    this.client = new S3Client({
      region: 'auto',
      endpoint: config.R2_ENDPOINT,
      credentials: {
        accessKeyId: config.R2_ACCESS_KEY_ID,
        secretAccessKey: config.R2_SECRET_ACCESS_KEY,
      },
    });
    this.bucket = config.R2_BUCKET;
  }

  async put(key: string, content: Buffer | string): Promise<string> {
    const body = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;

    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: 'application/json',
    }));

    return `/api/v1/definitions/${path.basename(key, '.json')}/json`;
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const response = await this.client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));

      if (!response.Body) return null;
      const bytes = await response.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
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
