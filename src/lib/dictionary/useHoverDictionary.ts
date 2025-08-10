import { useState, useCallback, useRef } from 'react';
import { useDictionary } from '@/lib/dictionary/useDictionary';
import { jiebaService } from '@/lib/dictionary/jieba';
import { DictionaryEntry, LoadingState } from '@/lib/dictionary/types';

interface HoverPosition {
  x: number;
  y: number;
}

interface UseHoverDictionaryReturn {
  tooltipEntries: DictionaryEntry[];
  tooltipPosition: HoverPosition | null;
  tooltipLoadingState: LoadingState;
  showTooltip: boolean;
  handleMouseEnter: (event: React.MouseEvent, word: string) => Promise<void>;
  handleMouseLeave: () => void;
  closeTooltip: () => void;
}

export function useHoverDictionary(): UseHoverDictionaryReturn {
  const { dictionary, loadingState, loadDictionary, lookupWord } = useDictionary();
  const [tooltipEntries, setTooltipEntries] = useState<DictionaryEntry[]>([]);
  const [tooltipPosition, setTooltipPosition] = useState<HoverPosition | null>(null);
  const [tooltipLoadingState, setTooltipLoadingState] = useState<LoadingState>('idle');
  const [showTooltip, setShowTooltip] = useState(false);
  const [lastHoveredWord, setLastHoveredWord] = useState<string>('');
  
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const closeTooltip = useCallback(() => {
    setShowTooltip(false);
    setTooltipEntries([]);
    setTooltipPosition(null);
    setTooltipLoadingState('idle');
    setLastHoveredWord('');
    
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(async (event: React.MouseEvent, word: string) => {
    console.log('🖱️ Mouse enter on word:', word);
    
    // Clear any existing timeouts
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    // Don't show tooltip for the same word if already shown
    if (showTooltip && lastHoveredWord === word) {
      console.log('🖱️ Same word already showing tooltip, skipping');
      return;
    }

    console.log('🖱️ Setting tooltip position...');
    // Get precise position relative to the character
    const rect = event.currentTarget.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    setTooltipPosition({
      x: rect.left + scrollX + rect.width / 2,
      y: rect.top + scrollY
    });

    setLastHoveredWord(word);

    let currentDictionary = dictionary;

    // Show loading state if dictionary needs to be loaded
    if (!currentDictionary) {
      console.log('🖱️ Dictionary not loaded, showing loading state and loading dictionary...');
      setTooltipLoadingState('loading');
      setShowTooltip(true);
      
      try {
        const loadedDictionary = await loadDictionary();
        console.log('🖱️ Dictionary loaded successfully, got', loadedDictionary?.length, 'entries');
        currentDictionary = loadedDictionary;
      } catch (error) {
        console.error('🖱️ Error loading dictionary:', error);
        setTooltipLoadingState('error');
        return;
      }
    }

    console.log('🖱️ Looking up word in dictionary...');
    // Look up the word with the current dictionary
    if (currentDictionary) {
      const entries = currentDictionary.filter(entry => 
        entry.simplified === word || entry.traditional === word
      );
      console.log('🖱️ Found', entries.length, 'entries for word:', word);
      
      if (entries.length > 0) {
        console.log('🖱️ Found entries, showing tooltip');
        setTooltipEntries(entries);
        setTooltipLoadingState('loaded');
        setShowTooltip(true);
      } else {
        console.log('🖱️ No entries found, hiding tooltip');
        setTooltipLoadingState('idle');
        setShowTooltip(false);
      }
    } else {
      console.log('🖱️ No dictionary available, hiding tooltip');
      setTooltipLoadingState('idle');
      setShowTooltip(false);
    }
  }, [dictionary, loadDictionary, showTooltip, lastHoveredWord]);

  const handleMouseLeave = useCallback(() => {
    // Clear hover timeout if still pending
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    // Hide tooltip after a longer delay to allow moving to tooltip
    hideTimeoutRef.current = setTimeout(() => {
      closeTooltip();
    }, 500); // Increased delay to make it less sensitive
  }, [closeTooltip]);

  return {
    tooltipEntries,
    tooltipPosition,
    tooltipLoadingState,
    showTooltip,
    handleMouseEnter,
    handleMouseLeave,
    closeTooltip
  };
}
