import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'PrivateGrid Vault',
  projectId: '5b56c4174cf2a9b8b6d6b4e9a7f55d6d',
  chains: [sepolia],
  ssr: false,
});
