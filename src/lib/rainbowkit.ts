import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet } from 'wagmi/chains';
import { http } from 'viem';
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient();

export const config = getDefaultConfig({
  appName: 'OG Card Crafter',
  projectId: '362b839f0569ebd7db49535549783fcd',
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
}); 