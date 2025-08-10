import { DictionaryEntry, DictionaryCache } from './types';

const DB_NAME = 'ChineseDictionary';
const DB_VERSION = 1;
const STORE_NAME = 'dictionary';
const DICTIONARY_VERSION = '1.0.0';

class DictionaryDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'version' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
    });
  }

  async getDictionary(): Promise<DictionaryCache | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(DICTIONARY_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to read from IndexedDB'));
      };

      request.onsuccess = () => {
        resolve(request.result || null);
      };
    });
  }

  async saveDictionary(entries: DictionaryEntry[]): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const cache: DictionaryCache = {
      entries,
      version: DICTIONARY_VERSION,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(cache);

      request.onerror = () => {
        reject(new Error('Failed to save to IndexedDB'));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  async clearDictionary(): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => {
        reject(new Error('Failed to clear IndexedDB'));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }
}

export const dictionaryDB = new DictionaryDB();
