import { DictionaryEntry } from '@/lib/dictionary/types';
import { createPortal } from 'react-dom';

interface DictionaryTooltipProps {
  entries: DictionaryEntry[];
  isLoading: boolean;
  onClose: () => void;
  position: { x: number; y: number };
}

export function DictionaryTooltip({ entries, isLoading, onClose, position }: DictionaryTooltipProps) {
  console.log('💬 DictionaryTooltip render:', { isLoading, entriesCount: entries.length, position });
  
  const tooltipContent = (() => {
    if (isLoading) {
      console.log('💬 Rendering loading tooltip');
      return (
        <div 
          className="fixed z-[9999] bg-white border border-gray-300 rounded-lg shadow-xl p-3 max-w-xs"
          style={{ 
            left: position.x - 100, 
            top: position.y - 50,
            pointerEvents: 'none'
          }}
        >
          <div className="flex items-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span className="text-sm text-gray-600">Loading...</span>
          </div>
        </div>
      );
    }

    if (!entries.length) {
      console.log('💬 No entries, returning null');
      return null;
    }

    console.log('💬 Rendering tooltip with entries:', entries);
    
    // Use simpler, more reliable positioning  
    const tooltipWidth = 300;
    
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
    
    if (top + 200 > window.innerHeight) {
      top = window.innerHeight - 220;
    }

    console.log('💬 Final tooltip position:', { 
      originalX: position.x, 
      originalY: position.y,
      finalLeft: left, 
      finalTop: top,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight
    });

    return (
      <div 
        className="fixed z-[9999] bg-white border-2 border-red-500 rounded-lg shadow-2xl"
        style={{ 
          left: left,
          top: top,
          width: tooltipWidth,
          maxHeight: '200px',
          pointerEvents: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
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
        <div className="max-h-40 overflow-y-auto p-3">
          {entries.slice(0, 2).map((entry, index) => (
            <div key={index} className="mb-3 last:mb-0">
              {/* Character and Pinyin */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl font-bold text-gray-900">
                  {entry.simplified}
                </span>
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                  {entry.pinyin}
                </span>
              </div>
              
              {/* First meaning */}
              <div className="text-sm text-gray-700">
                {entry.meanings[0]}
              </div>
              
              {/* Frequency if available */}
              {entry.frequency && (
                <div className="mt-1">
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                    Freq: {entry.frequency}
                  </span>
                </div>
              )}
            </div>
          ))}
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
