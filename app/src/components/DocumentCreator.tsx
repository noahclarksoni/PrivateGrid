import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Contract, Wallet } from 'ethers';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { encryptContent } from '../utils/crypto';

type Props = {
  onCreated?: (documentId?: string) => void;
};

export function DocumentCreator({ onCreated }: Props) {
  const { address, isConnected } = useAccount();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();
  const signerPromise = useEthersSigner();
  const contractUnset = CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000';

  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState('');
  const [createdDocId, setCreatedDocId] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreatedDocId(null);
    setTxHash(null);
    setStatus('');

    if (!instance || !address || !signerPromise) {
      alert('Connect your wallet and wait for the encryption service to be ready.');
      return;
    }

    setCreating(true);
    try {
      setStatus('Generating a fresh access key');
      const accessKey = Wallet.createRandom().address;
      setGeneratedKey(accessKey);

      const buffer = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
      buffer.addAddress(accessKey);
      const encryptedKey = await buffer.encrypt();

      setStatus('Encrypting initial empty body with the access key');
      const encryptedBody = await encryptContent('', accessKey);

      setStatus('Submitting document to the chain');
      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Wallet is not ready');
      }
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.createDocument(name.trim(), encryptedBody, encryptedKey.handles[0], encryptedKey.inputProof);
      const receipt = await tx.wait();

      const createdEvent = receipt?.logs?.find((log: any) => log.fragment?.name === 'DocumentCreated');
      const docId = createdEvent?.args?.documentId?.toString?.();
      setCreatedDocId(docId || null);
      setTxHash(receipt?.hash ?? tx.hash);
      setStatus('Document stored successfully');
      setName('');
      onCreated?.(docId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create document';
      console.error(err);
      setStatus(message);
    } finally {
      setCreating(false);
    }
  };

  if (contractUnset) {
    return (
      <div className="panel">
        <h2 className="panel-title">Deploy the DocumentVault first</h2>
        <p className="muted">
          Set `CONTRACT_ADDRESS` in `app/src/config/contracts.ts` to the Sepolia deployment address from
          `deployments/sepolia/DocumentVault.json`.
        </p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="panel">
        <h2 className="panel-title">Connect a wallet to start</h2>
        <p className="muted">Use Sepolia and keep the tab open while the FHE relayer initializes.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow inline">Step 1</p>
          <h2 className="panel-title">Create a protected document</h2>
          <p className="muted">
            We generate a random EVM address as the access key, encrypt it with Zama, and persist an empty encrypted body
            on-chain so you can edit it later.
          </p>
        </div>
      </div>

      <form className="form-grid" onSubmit={handleCreate}>
        <label className="field">
          <span className="field-label">Document name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Team playbook, roadmap, research notes..."
            className="text-input"
            required
          />
        </label>

        <div className="form-actions">
          <div>
            <p className="muted">A new access key is generated on every creation. Keep your wallet online for the ACL.</p>
            {zamaLoading && <p className="hint">Initializing Zama relayer...</p>}
            {zamaError && <p className="error-text">{zamaError}</p>}
          </div>
          <button type="submit" className="primary-button" disabled={creating || zamaLoading || !name.trim()}>
            {creating ? 'Creating...' : 'Create document'}
          </button>
        </div>
      </form>

      {(generatedKey || createdDocId || status || txHash) && (
        <div className="status-box">
          {status && <p className="status-line">{status}</p>}
          {createdDocId && <p className="status-line">Document ID: {createdDocId}</p>}
          {generatedKey && <p className="status-line">Access key (address): {generatedKey}</p>}
          {txHash && (
            <p className="status-line">
              Tx hash: <span className="mono">{txHash}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
