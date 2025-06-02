import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { BehaviorSubject, Observable } from 'rxjs';

interface StorageConfig {
  encrypt?: boolean;
  maxAge?: number;
  maxSize?: number;
}

interface StorageItem<T> {
  value: T;
  timestamp: number;
  size: number;
  encrypted: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private _storage: Storage | null = null;
  private ready = new BehaviorSubject<boolean>(false);
  private readonly DEFAULT_CONFIG: StorageConfig = {
    encrypt: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    maxSize: 5 * 1024 * 1024
  };

  constructor(private storage: Storage) {
    this.init();
  }

  private async init() {
    this._storage = await this.storage.create();
    this.ready.next(true);
  }

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
      encrypted: mergedConfig.encrypt || false
    };

    try {
      await this._storage.set(key, item);
    } catch (error) {
      console.error(`Failed to store data for key ${key}:`, error);
      throw new Error('Storage operation failed');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this._storage) {
      throw new Error('Storage is not initialized');
    }

    try {
      const item: StorageItem<T> | null = await this._storage.get(key);
      
      if (!item) {
        return null;
      }

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

  async remove(key: string): Promise<void> {
    if (!this._storage) {
      throw new Error('Storage is not initialized');
    }

    await this._storage.remove(key);
  }

  async clear(): Promise<void> {
    if (!this._storage) {
      throw new Error('Storage is not initialized');
    }

    await this._storage.clear();
  }

  async keys(): Promise<string[]> {
    if (!this._storage) {
      throw new Error('Storage is not initialized');
    }

    return this._storage.keys();
  }

  isReady(): Observable<boolean> {
    return this.ready.asObservable();
  }

  private encrypt(data: any): any {
    return btoa(JSON.stringify(data));
  }

  private decrypt(data: any): any {
    try {
      return JSON.parse(atob(data));
    } catch {
      return data;
    }
  }
} 