import { DictionaryEntry } from '@/lib/dictionary/types';

interface DictionaryTooltipProps {
  entries: DictionaryEntry[];
  isLoading: boolean;
  onClose: () => void;
  position: { x: number; y: number };
}

export function DictionaryTooltip({ entries, isLoading, onClose, position }: DictionaryTooltipProps) {
  if (isLoading) {
    return (
      <div 
        className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-3 max-w-sm"
        style={{ 
          left: position.x, 
          top: position.y,
          transform: 'translate(-50%, -100%)',
          marginTop: '-8px'
        }}
      >
        <div className="text-sm text-gray-600">Loading dictionary...</div>
      </div>
    );
  }

  if (!entries.length) {
    return null;
  }

  return (
    <div 
      className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-3 max-w-sm"
      style={{ 
        left: position.x, 
        top: position.y,
        transform: 'translate(-50%, -100%)',
        marginTop: '-8px'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onClose}
        className="absolute top-1 right-1 text-gray-400 hover:text-gray-600 text-lg leading-none"
        title="Close"
      >
        ×
      </button>

      <div className="space-y-2">
        {entries.slice(0, 3).map((entry, index) => (
          <div key={index} className="border-b border-gray-100 last:border-b-0 pb-2 last:pb-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg font-medium text-gray-900">
                {entry.simplified}
                {entry.traditional !== entry.simplified && (
                  <span className="text-gray-600 ml-1">({entry.traditional})</span>
                )}
              </span>
              <span className="text-sm text-blue-600 font-medium">
                {entry.pinyin}
              </span>
            </div>
            
            <div className="text-sm text-gray-700">
              {entry.meanings.slice(0, 3).map((meaning, idx) => (
                <div key={idx} className="mb-1">
                  {idx + 1}. {meaning}
                </div>
              ))}
              {entry.meanings.length > 3 && (
                <div className="text-gray-500 text-xs">
                  +{entry.meanings.length - 3} more meanings
                </div>
              )}
            </div>

            {entry.frequency && (
              <div className="text-xs text-gray-500 mt-1">
                Frequency: {entry.frequency}
              </div>
            )}
          </div>
        ))}
        
        {entries.length > 3 && (
          <div className="text-xs text-gray-500 text-center pt-1">
            +{entries.length - 3} more entries
          </div>
        )}
      </div>
    </div>
  );
}
