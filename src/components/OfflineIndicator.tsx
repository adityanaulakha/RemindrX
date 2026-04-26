import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-bottom-2">
      <div className="bg-danger text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-bold">
        <WifiOff className="h-4 w-4" />
        Offline Mode - Using Cached Data
      </div>
    </div>
  );
}
