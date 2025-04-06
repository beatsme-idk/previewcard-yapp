import { createRoot } from 'react-dom/client'
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import { QueryClientProvider } from '@tanstack/react-query'
import { config, queryClient } from './lib/rainbowkit'
import App from './App.tsx'
import './index.css'

// Prevent ethereum provider conflicts
// This prevents "Cannot set property ethereum of #<Window> which has only a getter" errors
if (typeof window !== 'undefined') {
  // If ethereum is already defined with a getter but no setter
  const descriptor = Object.getOwnPropertyDescriptor(window, 'ethereum');
  if (descriptor && descriptor.get && !descriptor.set) {
    // Create a new property with the current value but make it writable
    const ethereumValue = window.ethereum;
    Object.defineProperty(window, 'ethereum', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: ethereumValue
    });
    console.log('Fixed ethereum provider for compatibility');
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
