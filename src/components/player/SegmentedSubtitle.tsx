import { useState, useEffect, useMemo } from 'react';
import { jiebaService } from '@/lib/dictionary/jieba';
import { useHoverDictionary } from '@/lib/dictionary/useHoverDictionary';
import { DictionaryTooltip } from './DictionaryTooltip';

interface SegmentedSubtitleProps {
  text: string;
  className?: string;
}

// Check if a character is Chinese
function isChinese(char: string): boolean {
  const code = char.charCodeAt(0);
  return (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
         (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
         (code >= 0xf900 && code <= 0xfaff);   // CJK Compatibility Ideographs
}

export function SegmentedSubtitle({ text, className = "" }: SegmentedSubtitleProps) {
  const [segments, setSegments] = useState<string[]>([]);
  const [isSegmenting, setIsSegmenting] = useState(false);
  
  const {
    tooltipEntries,
    tooltipPosition,
    tooltipLoadingState,
    showTooltip,
    handleMouseEnter,
    handleMouseLeave,
    closeTooltip
  } = useHoverDictionary();

  // Segment the text using jieba
  useEffect(() => {
    let isCancelled = false;

    const segmentText = async () => {
      if (!text.trim()) {
        setSegments([]);
        return;
      }

      console.log('🔤 Starting segmentation for text:', text);
      setIsSegmenting(true);

      try {
        const segmented = await jiebaService.segmentText(text);
        console.log('🔤 Segmentation result:', segmented);
        if (!isCancelled) {
          setSegments(segmented);
        }
      } catch (error) {
        console.error('🔤 Failed to segment text:', error);
        // Fallback to character-by-character for Chinese text
        if (!isCancelled) {
          console.log('🔤 Using fallback character segmentation');
          setSegments(text.split(''));
        }
      } finally {
        if (!isCancelled) {
          setIsSegmenting(false);
        }
      }
    };

    segmentText();

    return () => {
      isCancelled = true;
    };
  }, [text]);

  // Render segments as interactive spans
  const renderedSegments = useMemo(() => {
    if (isSegmenting || !segments.length) {
      return <span>{text}</span>;
    }

    console.log('🔤 Rendering segments:', segments);

    return segments.map((segment, index) => {
      const hasChineseChars = segment.split('').some(isChinese);
      
      if (!hasChineseChars) {
        // Non-Chinese text, render as plain text
        return <span key={index}>{segment}</span>;
      }

      console.log('🔤 Creating hoverable segment:', segment);
      // Chinese text, make it hoverable
      return (
        <span
          key={index}
          className="hover:bg-blue-100 hover:bg-opacity-50 cursor-pointer rounded px-0.5 transition-colors duration-150"
          onMouseEnter={(e) => {
            console.log('🔤 Mouse enter on segment:', segment);
            handleMouseEnter(e, segment);
          }}
          onMouseLeave={handleMouseLeave}
        >
          {segment}
        </span>
      );
    });
  }, [segments, isSegmenting, text]);

  return (
    <>
      <span className={className}>
        {renderedSegments}
      </span>
      
      {showTooltip && tooltipPosition && (
        <DictionaryTooltip
          entries={tooltipEntries}
          isLoading={tooltipLoadingState === 'loading'}
          onClose={closeTooltip}
          position={tooltipPosition}
        />
      )}
    </>
  );
}
