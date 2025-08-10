export interface DictionaryEntry {
  simplified: string;
  traditional: string;
  pinyin: string;
  meanings: string[];
  radical?: string;
  frequency?: number;
  level?: string[];
  pos?: string[];
}

export interface DictionaryCache {
  entries: DictionaryEntry[];
  version: string;
  timestamp: number;
}

export type LoadingState = 'idle' | 'loading' | 'loaded' | 'error';
