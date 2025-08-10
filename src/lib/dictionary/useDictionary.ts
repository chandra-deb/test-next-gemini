import { useState, useCallback } from 'react';
import { dictionaryDB } from './indexeddb';
import { DictionaryEntry, LoadingState } from './types';

interface UseDictionaryReturn {
  dictionary: DictionaryEntry[] | null;
  loadingState: LoadingState;
  loadDictionary: () => Promise<DictionaryEntry[] | null>;
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
    console.log('📚 loadDictionary called', { loadingState, dictionaryExists: !!dictionary });
    
    if (loadingState === 'loading' || dictionary) {
      console.log('📚 Skipping load - already loading or loaded');
      return dictionary; // Return existing dictionary if already loaded
    }

    console.log('📚 Starting dictionary load...');
    setLoadingState('loading');

    try {
      // First try to load from IndexedDB
      console.log('📚 Checking IndexedDB cache...');
      const cached = await dictionaryDB.getDictionary();
      
      if (cached && cached.entries.length > 0) {
        console.log('📚 Found cached dictionary with', cached.entries.length, 'entries');
        setDictionary(cached.entries);
        setLoadingState('loaded');
        return cached.entries; // Return the loaded entries
      }

      console.log('📚 No cache found, loading from network...');
      // If not in cache, load from network
      const entries = await loadFromNetwork();
      console.log('📚 Loaded', entries.length, 'entries from network');
      
      // Save to IndexedDB for next time
      try {
        console.log('📚 Saving to IndexedDB...');
        await dictionaryDB.saveDictionary(entries);
        console.log('📚 Successfully saved to IndexedDB');
      } catch (dbError) {
        console.warn('📚 Failed to save dictionary to IndexedDB:', dbError);
        // Continue anyway, we have the dictionary data
      }

      setDictionary(entries);
      setLoadingState('loaded');
      console.log('📚 Dictionary loaded successfully');
      return entries; // Return the loaded entries
    } catch (error) {
      console.error('📚 Failed to load dictionary:', error);
      setLoadingState('error');
      throw error; // Re-throw to handle in calling code
    }
  }, [loadingState, dictionary]);

  const lookupWord = useCallback((word: string): DictionaryEntry[] => {
    console.log('🔍 Looking up word:', word, { dictionaryLoaded: !!dictionary, dictionarySize: dictionary?.length });
    
    if (!dictionary) {
      console.log('🔍 No dictionary loaded');
      return [];
    }

    const results = dictionary.filter(entry => 
      entry.simplified === word || entry.traditional === word
    );
    
    console.log('🔍 Found', results.length, 'entries for word:', word);
    if (results.length > 0) {
      console.log('🔍 First result:', results[0]);
    }
    
    return results;
  }, [dictionary]);

  return {
    dictionary,
    loadingState,
    loadDictionary,
    lookupWord
  };
}
