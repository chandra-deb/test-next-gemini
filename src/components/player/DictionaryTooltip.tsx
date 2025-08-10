import { DictionaryEntry } from '@/lib/dictionary/types';
import { createPortal } from 'react-dom';

interface DictionaryTooltipProps {
  entries: DictionaryEntry[];
  isLoading: boolean;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  position: { x: number; y: number };
}

export function DictionaryTooltip({ entries, isLoading, onClose, onMouseEnter, onMouseLeave, position }: DictionaryTooltipProps) {
  console.log('💬 DictionaryTooltip render:', { isLoading, entriesCount: entries.length, position });
  
  const tooltipContent = (() => {
    // Don't show tooltip if no entries and not loading
    if (!isLoading && !entries.length) {
      console.log('💬 No entries and not loading, returning null');
      return null;
    }

    console.log('💬 Rendering main tooltip');
    
    // Use simpler, more reliable positioning  
    const tooltipWidth = 320;
    
    // Position tooltip to the left of the mouse position
    let left = position.x - tooltipWidth - 10;
    let top = position.y - 100;
    
    // If too far left, show on the right instead
    if (left < 20) {
      left = position.x + 20;
    }
    
    // Keep tooltip on screen vertically
    if (top < 20) {
      top = 20;
    }
    
    // Dynamic height adjustment based on window height
    const maxTooltipHeight = Math.min(400, window.innerHeight - top - 40);

    console.log('💬 Final tooltip position:', { 
      originalX: position.x, 
      originalY: position.y,
      finalLeft: left, 
      finalTop: top,
      maxHeight: maxTooltipHeight,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight
    });

    return (
      <div 
        className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-2xl"
        style={{ 
          left: left,
          top: top,
          width: tooltipWidth,
          maxHeight: maxTooltipHeight,
          pointerEvents: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={(e) => {
          console.log('💬 Mouse entered tooltip');
          e.stopPropagation();
          onMouseEnter?.();
        }}
        onMouseLeave={(e) => {
          console.log('💬 Mouse left tooltip');
          e.stopPropagation();
          onMouseLeave?.();
        }}
      >
        {/* Header */}
        <div className="bg-blue-50 px-3 py-2 border-b border-gray-200 flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-800">Dictionary</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-3">
          {isLoading ? (
            <div className="flex items-center gap-3 py-4">
              <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              <span className="text-sm text-gray-600">Loading dictionary...</span>
            </div>
          ) : (
            entries.slice(0, 3).map((entry, index) => (
              <div key={index} className="mb-4 last:mb-0">
                {/* Character and Pinyin */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl font-bold text-gray-900">
                    {entry.simplified}
                  </span>
                  {entry.traditional && entry.traditional !== entry.simplified && (
                    <span className="text-lg text-gray-600">
                      ({entry.traditional})
                    </span>
                  )}
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                    {entry.pinyin}
                  </span>
                </div>
                
                {/* Meanings */}
                <div className="space-y-1 mb-2">
                  {entry.meanings.slice(0, 3).map((meaning, mIndex) => (
                    <div key={mIndex} className="text-sm text-gray-700">
                      • {meaning}
                    </div>
                  ))}
                  {entry.meanings.length > 3 && (
                    <div className="text-xs text-gray-500 italic">
                      +{entry.meanings.length - 3} more meanings
                    </div>
                  )}
                </div>
                
                {/* Additional info */}
                <div className="flex gap-2 flex-wrap">
                  {entry.frequency && (
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                      Freq: {entry.frequency}
                    </span>
                  )}
                  {entry.level && (
                    <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                      {entry.level}
                    </span>
                  )}
                  {entry.pos && (
                    <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                      {entry.pos}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
          
          {!isLoading && entries.length > 3 && (
            <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-100">
              +{entries.length - 3} more entries
            </div>
          )}
        </div>
      </div>
    );
  })();

  // Render using Portal to avoid HTML nesting issues
  if (typeof document !== 'undefined') {
    return createPortal(tooltipContent, document.body);
  }
  
  return null;
}
