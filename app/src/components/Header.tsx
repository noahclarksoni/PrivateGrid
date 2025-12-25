import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-left">
            <p className="eyebrow">Encrypted document relayer</p>
            <h1 className="header-title">PrivateGrid Vault</h1>
            <p className="header-description">
              Generate a private access key, encrypt it with Zama FHE, and keep your documents editable on-chain without
              exposing any cleartext.
            </p>
          </div>
          <div className="header-right">
            <ConnectButton />
            <div className="network-pill">Sepolia only · viem reads · ethers writes</div>
          </div>
        </div>
      </div>
    </header>
  );
}
