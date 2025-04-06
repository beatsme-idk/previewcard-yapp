import { createRoot } from 'react-dom/client'
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import { QueryClientProvider } from '@tanstack/react-query'
import { config, queryClient } from './lib/rainbowkit'
import App from './App.tsx'
import './index.css'

// Add type declarations for our custom window properties
declare global {
  interface Window {
    __walletProviders: {
      ethereum?: any;
      updateProvider?: (provider: any) => void;
    };
  }
}

// Handle wallet provider conflicts
if (typeof window !== 'undefined') {
  // Initialize the wallet providers object if it doesn't exist
  if (!window.__walletProviders) {
    window.__walletProviders = {};
  }
  
  try {
    // Add a compatibility layer for wallet providers
    // Instead of modifying window.ethereum directly (which can cause errors),
    // we'll track the provider in our reference object
    const ethereumDescriptor = Object.getOwnPropertyDescriptor(window, 'ethereum');
    if (ethereumDescriptor && ethereumDescriptor.get) {
      // Store current ethereum provider reference
      try {
        window.__walletProviders.ethereum = ethereumDescriptor.get();
      } catch (e) {
        console.warn('Could not access ethereum provider:', e);
      }
      
      // Setup provider update method
      Object.defineProperty(window.__walletProviders, 'updateProvider', {
        value: function(provider) {
          window.__walletProviders.ethereum = provider;
        },
        writable: false,
        configurable: false
      });
    }
  } catch (e) {
    console.warn('Error setting up wallet compatibility layer:', e);
  }
}

createRoot(document.getElementById("root")!).render(
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider theme={lightTheme()}>
        <App />
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
);
