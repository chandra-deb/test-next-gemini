import { useState, useCallback } from 'react';
import { dictionaryDB } from './indexeddb';
import { DictionaryEntry, LoadingState } from './types';

interface UseDictionaryReturn {
  dictionary: DictionaryEntry[] | null;
  loadingState: LoadingState;
  loadDictionary: () => Promise<void>;
  lookupWord: (word: string) => DictionaryEntry[];
}

const DICTIONARY_URL = '/api/dictionary';

export function useDictionary(): UseDictionaryReturn {
  const [dictionary, setDictionary] = useState<DictionaryEntry[] | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');

  const loadFromNetwork = async (): Promise<DictionaryEntry[]> => {
    const response = await fetch(DICTIONARY_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch dictionary: ${response.status}`);
    }
    
    // Handle gzipped response
    const data = await response.json() as DictionaryEntry[];
    return data;
  };

  const loadDictionary = useCallback(async () => {
    if (loadingState === 'loading' || dictionary) return;

    setLoadingState('loading');

    try {
      // First try to load from IndexedDB
      const cached = await dictionaryDB.getDictionary();
      
      if (cached && cached.entries.length > 0) {
        setDictionary(cached.entries);
        setLoadingState('loaded');
        return;
      }

      // If not in cache, load from network
      const entries = await loadFromNetwork();
      
      // Save to IndexedDB for next time
      try {
        await dictionaryDB.saveDictionary(entries);
      } catch (dbError) {
        console.warn('Failed to save dictionary to IndexedDB:', dbError);
        // Continue anyway, we have the dictionary data
      }

      setDictionary(entries);
      setLoadingState('loaded');
    } catch (error) {
      console.error('Failed to load dictionary:', error);
      setLoadingState('error');
    }
  }, [loadingState, dictionary]);

  const lookupWord = useCallback((word: string): DictionaryEntry[] => {
    if (!dictionary) return [];

    return dictionary.filter(entry => 
      entry.simplified === word || entry.traditional === word
    );
  }, [dictionary]);

  return {
    dictionary,
    loadingState,
    loadDictionary,
    lookupWord
  };
}
