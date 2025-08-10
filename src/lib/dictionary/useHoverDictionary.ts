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
    // Clear any existing timeouts
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    // Don't show tooltip for the same word if already shown
    if (showTooltip && lastHoveredWord === word) {
      return;
    }

    // Set position immediately
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });

    setLastHoveredWord(word);

    // Show loading state if dictionary needs to be loaded
    if (!dictionary) {
      setTooltipLoadingState('loading');
      setShowTooltip(true);
      
      try {
        await loadDictionary();
      } catch (error) {
        setTooltipLoadingState('error');
        return;
      }
    }

    // Look up the word
    const entries = lookupWord(word);
    
    if (entries.length > 0) {
      setTooltipEntries(entries);
      setTooltipLoadingState('loaded');
      setShowTooltip(true);
    } else {
      // Word not found in dictionary
      setTooltipLoadingState('idle');
      setShowTooltip(false);
    }
  }, [dictionary, loadDictionary, lookupWord, showTooltip, lastHoveredWord]);

  const handleMouseLeave = useCallback(() => {
    // Clear hover timeout if still pending
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    // Hide tooltip after a short delay to allow moving to tooltip
    hideTimeoutRef.current = setTimeout(() => {
      closeTooltip();
    }, 200);
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
