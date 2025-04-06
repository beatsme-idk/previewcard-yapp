import { useEffect, useState } from 'react';

/**
 * Custom hook to safely access wallet providers without conflicts
 * This helps avoid the "Cannot set property ethereum of #<Window> which has only a getter" error
 */
export function useWalletProvider() {
  const [provider, setProvider] = useState<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // First try to get from our custom container
    if (window.__walletProviders?.ethereum) {
      setProvider(window.__walletProviders.ethereum);
      return;
    }

    // If that fails, try to get from window directly
    try {
      const ethereum = window.ethereum;
      if (ethereum) {
        setProvider(ethereum);
        // Store in our container for future reference
        if (window.__walletProviders) {
          window.__walletProviders.ethereum = ethereum;
        }
      }
    } catch (e) {
      console.warn('Error accessing ethereum provider:', e);
    }
  }, []);

  return provider;
}

export default useWalletProvider; 