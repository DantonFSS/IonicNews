import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { BehaviorSubject, from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface StorageConfig {
  encrypt?: boolean;
  maxAge?: number; // milliseconds
  maxSize?: number; // bytes
}

interface StorageItem<T> {
  value: T;
  timestamp: number;
  size: number;
  encrypted?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private _storage: Storage | null = null;
  private ready = new BehaviorSubject<boolean>(false);
  private readonly DEFAULT_CONFIG: StorageConfig = {
    encrypt: false,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxSize: 5 * 1024 * 1024 // 5MB
  };

  constructor(private storage: Storage) {
    this.init();
  }

  async init() {
    try {
      const storage = await this.storage.create();
      this._storage = storage;
      this.ready.next(true);
      await this.cleanupExpiredItems();
    } catch (error) {
      console.error('Storage initialization failed:', error);
      this.ready.next(false);
    }
  }

  /**
   * Store data with optional configuration
   */
  async set(key: string, value: any, config?: StorageConfig): Promise<void> {
    if (!this._storage) {
      throw new Error('Storage is not initialized');
    }

    const mergedConfig = { ...this.DEFAULT_CONFIG, ...config };
    const size = new TextEncoder().encode(JSON.stringify(value)).length;

    if (size > mergedConfig.maxSize!) {
      throw new Error(`Data size exceeds maximum allowed size of ${mergedConfig.maxSize} bytes`);
    }

    let processedValue = value;
    if (mergedConfig.encrypt) {
      processedValue = this.encrypt(value);
    }

    const item: StorageItem<typeof processedValue> = {
      value: processedValue,
      timestamp: Date.now(),
      size,
      encrypted: mergedConfig.encrypt
    };

    try {
      await this._storage.set(key, item);
    } catch (error) {
      console.error(`Failed to store data for key ${key}:`, error);
      throw new Error('Storage operation failed');
    }
  }

  /**
   * Retrieve data with type safety
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this._storage) {
      throw new Error('Storage is not initialized');
    }

    try {
      const item: StorageItem<T> | null = await this._storage.get(key);
      
      if (!item) {
        return null;
      }

      // Check if item has expired
      if (Date.now() - item.timestamp > this.DEFAULT_CONFIG.maxAge!) {
        await this.remove(key);
        return null;
      }

      let value = item.value;
      if (item.encrypted) {
        value = this.decrypt(value);
      }

      return value;
    } catch (error) {
      console.error(`Failed to retrieve data for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Remove data by key
   */
  async remove(key: string): Promise<void> {
    if (!this._storage) {
      throw new Error('Storage is not initialized');
    }

    try {
      await this._storage.remove(key);
    } catch (error) {
      console.error(`Failed to remove data for key ${key}:`, error);
      throw new Error('Storage operation failed');
    }
  }

  /**
   * Clear all stored data
   */
  async clear(): Promise<void> {
    if (!this._storage) {
      throw new Error('Storage is not initialized');
    }

    try {
      await this._storage.clear();
    } catch (error) {
      console.error('Failed to clear storage:', error);
      throw new Error('Storage operation failed');
    }
  }

  /**
   * Get all keys in storage
   */
  async keys(): Promise<string[]> {
    if (!this._storage) {
      throw new Error('Storage is not initialized');
    }

    try {
      return this._storage.keys();
    } catch (error) {
      console.error('Failed to retrieve storage keys:', error);
      return [];
    }
  }

  /**
   * Check if storage is ready
   */
  isReady(): Observable<boolean> {
    return this.ready.asObservable();
  }

  /**
   * Get total storage usage
   */
  async getStorageUsage(): Promise<{ used: number; total: number }> {
    const keys = await this.keys();
    let used = 0;

    for (const key of keys) {
      const item = await this._storage?.get(key);
      if (item?.size) {
        used += item.size;
      }
    }

    return {
      used,
      total: this.DEFAULT_CONFIG.maxSize!
    };
  }

  private async cleanupExpiredItems(): Promise<void> {
    const keys = await this.keys();
    const now = Date.now();

    for (const key of keys) {
      const item = await this._storage?.get(key);
      if (item && (now - item.timestamp > this.DEFAULT_CONFIG.maxAge!)) {
        await this.remove(key);
      }
    }
  }

  // Simple encryption/decryption methods
  // Note: In a production app, use a proper encryption library
  private encrypt(data: any): any {
    // This is a placeholder. In a real app, use proper encryption
    return btoa(JSON.stringify(data));
  }

  private decrypt(data: any): any {
    // This is a placeholder. In a real app, use proper decryption
    try {
      return JSON.parse(atob(data));
    } catch {
      return data;
    }
  }
} 