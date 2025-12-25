import { useEffect, useMemo, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { Contract } from 'ethers';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { decryptContent, encryptContent } from '../utils/crypto';

type Props = {
  refreshKey?: number;
};

export function DocumentWorkspace({ refreshKey }: Props) {
  const { address, isConnected } = useAccount();
  const { instance, isLoading: zamaLoading } = useZamaInstance();
  const signerPromise = useEthersSigner();
  const contractUnset = CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000';

  const [activeId, setActiveId] = useState<bigint | null>(null);
  const [manualId, setManualId] = useState('');
  const [decryptedKey, setDecryptedKey] = useState('');
  const [decryptedBody, setDecryptedBody] = useState('');
  const [editBody, setEditBody] = useState('');
  const [decrypting, setDecrypting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [granting, setGranting] = useState(false);
  const [grantAddress, setGrantAddress] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (contractUnset) {
      setActiveId(null);
    }
  }, [contractUnset]);

  const {
    data: documentIds,
    refetch: refetchDocumentIds,
    isFetching: idsLoading,
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getDocumentsFor',
    args: address && !contractUnset ? [address] : undefined,
    query: {
      enabled: !!address && !contractUnset,
    },
  });

  useEffect(() => {
    if (refreshKey) {
      refetchDocumentIds();
    }
  }, [refreshKey, refetchDocumentIds]);

  const normalizedIds = useMemo(() => {
    if (!documentIds) return [];
    return (documentIds as bigint[]).map((id) => Number(id));
  }, [documentIds]);

  useEffect(() => {
    if (normalizedIds.length > 0 && !activeId) {
      setActiveId(BigInt(normalizedIds[0]));
    }
  }, [normalizedIds, activeId]);

  useEffect(() => {
    setDecryptedKey('');
    setDecryptedBody('');
    setEditBody('');
    setStatusMessage('');
  }, [activeId]);

  const {
    data: documentData,
    refetch: refetchDocument,
    isFetching: docLoading,
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getDocument',
    args: activeId && !contractUnset ? [activeId] : undefined,
    query: {
      enabled: !!activeId && !contractUnset,
    },
  });

  const document = useMemo(() => {
    if (!documentData) return null;
    const typed = documentData as unknown as readonly [string, string, string, `0x${string}`, bigint];
    return {
      name: typed[0],
      encryptedBody: typed[1],
      encryptedAccessKey: typed[2],
      owner: typed[3],
      lastUpdated: typed[4],
    };
  }, [documentData]);

  const {
    data: canEditData,
    refetch: refetchCanEdit,
    isFetching: accessLoading,
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'canEdit',
    args: activeId && address && !contractUnset ? [activeId, address] : undefined,
    query: {
      enabled: !!activeId && !!address && !contractUnset,
    },
  });

  const canEdit = Boolean(canEditData);
  const isOwner = document && address ? document.owner.toLowerCase() === address.toLowerCase() : false;

  const handleManualLoad = () => {
    if (!manualId) return;
    try {
      const parsed = BigInt(manualId);
      setActiveId(parsed);
      setManualId('');
    } catch {
      alert('Document id must be a valid number');
    }
  };

  const decryptKey = async () => {
    if (!instance || !document || !activeId || !address || !signerPromise) {
      alert('Missing inputs to decrypt');
      return;
    }

    setDecrypting(true);
    setStatusMessage('');
    try {
      const keypair = instance.generateKeypair();
      const handleContractPairs = [
        {
          handle: document.encryptedAccessKey,
          contractAddress: CONTRACT_ADDRESS,
        },
      ];
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [CONTRACT_ADDRESS];

      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Wallet is not ready');
      }

      const signature = await signer.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        eip712.message
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays
      );

      const clearKey = result[document.encryptedAccessKey];
      if (!clearKey) {
        throw new Error('Could not decrypt access key');
      }

      setDecryptedKey(clearKey);
      const plainBody = document.encryptedBody ? await decryptContent(document.encryptedBody, clearKey) : '';
      setDecryptedBody(plainBody);
      setEditBody(plainBody);
      setStatusMessage('Decryption complete. You can now edit and resubmit the encrypted body.');
    } catch (err) {
      console.error(err);
      setStatusMessage(err instanceof Error ? err.message : 'Failed to decrypt key');
    } finally {
      setDecrypting(false);
    }
  };

  const saveBody = async () => {
    if (!activeId || !document || !signerPromise || !decryptedKey) {
      alert('Decrypt the key before updating the document.');
      return;
    }

    setUpdating(true);
    setStatusMessage('');
    try {
      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Wallet not connected');
      }

      const encryptedBody = await encryptContent(editBody, decryptedKey);
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.updateDocument(activeId, encryptedBody);
      await tx.wait();

      await refetchDocument();
      setDecryptedBody(editBody);
      setStatusMessage('Document updated with the new encrypted body.');
    } catch (err) {
      console.error(err);
      setStatusMessage(err instanceof Error ? err.message : 'Failed to update document');
    } finally {
      setUpdating(false);
    }
  };

  const allowEditor = async () => {
    if (!activeId || !document || !signerPromise || !grantAddress) {
      return;
    }

    setGranting(true);
    setStatusMessage('');
    try {
      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Wallet not ready');
      }

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.allowAccess(activeId, grantAddress);
      await tx.wait();

      setGrantAddress('');
      await refetchCanEdit();
      setStatusMessage('Access granted and ACL updated.');
    } catch (err) {
      console.error(err);
      setStatusMessage(err instanceof Error ? err.message : 'Failed to grant access');
    } finally {
      setGranting(false);
    }
  };

  if (contractUnset) {
    return (
      <div className="panel">
        <h2 className="panel-title">Contract address missing</h2>
        <p className="muted">
          Update `CONTRACT_ADDRESS` with the Sepolia deployment from `deployments/sepolia/DocumentVault.json` before
          decrypting or editing.
        </p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="panel">
        <h2 className="panel-title">Connect your wallet</h2>
        <p className="muted">You need a Sepolia wallet to fetch, decrypt, and edit documents.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-heading space-between">
        <div>
          <p className="eyebrow inline">Step 2</p>
          <h2 className="panel-title">Decrypt, edit, and share</h2>
          <p className="muted">
            Fetch your documents, request ACL-based decryption for the access key, and resubmit encrypted bodies with the
            same key.
          </p>
        </div>
        <div className="id-pills">
          {idsLoading && <span className="pill muted">Loading your documents...</span>}
          {!idsLoading && normalizedIds.length === 0 && <span className="pill muted">No documents created yet</span>}
          {normalizedIds.map((id) => (
            <button
              key={id}
              className={`pill ${activeId === BigInt(id) ? 'pill-active' : ''}`}
              onClick={() => setActiveId(BigInt(id))}
            >
              #{id}
            </button>
          ))}
        </div>
      </div>

      <div className="loader-row">
        <input
          value={manualId}
          onChange={(e) => setManualId(e.target.value)}
          placeholder="Load a shared document by id"
          className="text-input"
        />
        <button className="ghost-button" onClick={handleManualLoad} disabled={!manualId}>
          Load
        </button>
      </div>

      {!activeId && <p className="muted">Select or load a document to continue.</p>}

      {activeId && (
        <div className="document-card">
          <div className="document-meta">
            <div>
              <p className="eyebrow inline">Document #{activeId.toString()}</p>
              <h3 className="document-title">{document?.name || 'Loading...'}</h3>
              <p className="muted">
                Owner: <span className="mono">{document?.owner || '...'}</span>
              </p>
              <p className="muted">
                Updated:{' '}
                {document?.lastUpdated
                  ? new Date(Number(document.lastUpdated) * 1000).toLocaleString()
                  : 'Waiting for data'}
              </p>
            </div>
            <div className="pill-row">
              {docLoading && <span className="pill muted">Fetching document...</span>}
              {accessLoading && <span className="pill muted">Checking permissions...</span>}
              {canEdit && <span className="pill success">You can edit</span>}
              {isOwner && <span className="pill">Owner</span>}
            </div>
          </div>

          <div className="document-body">
            <div className="subsection">
              <div className="subsection-heading">
                <div>
                  <p className="eyebrow inline">Access key</p>
                  <h4 className="mini-title">Decrypt the Zama-encrypted key</h4>
                </div>
                <button className="secondary-button" onClick={decryptKey} disabled={decrypting || zamaLoading || !document}>
                  {decrypting ? 'Decrypting...' : zamaLoading ? 'Initializing...' : 'Decrypt key'}
                </button>
              </div>
              <p className="muted">
                We never expose the on-chain ciphertext. The relayer re-encrypts the access key for you after an EIP-712
                signature.
              </p>
              {decryptedKey ? (
                <div className="status-box">
                  <p className="status-line">
                    Decrypted key (address): <span className="mono">{decryptedKey}</span>
                  </p>
                </div>
              ) : (
                <div className="status-box">
                  <p className="status-line mono small">
                    Ciphertext handle: {document?.encryptedAccessKey || '...'}
                  </p>
                </div>
              )}
            </div>

            <div className="subsection">
              <div className="subsection-heading">
                <div>
                  <p className="eyebrow inline">Encrypted body</p>
                  <h4 className="mini-title">Edit using the decrypted key</h4>
                </div>
                <button
                  className="primary-button"
                  onClick={saveBody}
                  disabled={!canEdit || !decryptedKey || updating}
                >
                  {updating ? 'Updating...' : 'Save encrypted body'}
                </button>
              </div>
              <p className="muted">The body is encrypted in-browser with AES-GCM keyed by the decrypted address.</p>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                placeholder={
                  decryptedKey
                    ? 'Update the content and resubmit'
                    : 'Decrypt the key to load and edit the cleartext body'
                }
                className="text-area"
                disabled={!decryptedKey}
                rows={6}
              />
              {document?.encryptedBody && (
                <p className="muted small">
                  Encrypted payload preview: <span className="mono">{document.encryptedBody.slice(0, 42)}...</span>
                </p>
              )}
              {decryptedBody && (
                <div className="status-box">
                  <p className="status-line">Decrypted body preview:</p>
                  <p className="status-line mono">{decryptedBody || '(empty)'}</p>
                </div>
              )}
            </div>

            {isOwner && (
              <div className="subsection">
                <div className="subsection-heading">
                  <div>
                    <p className="eyebrow inline">Share</p>
                    <h4 className="mini-title">Allow another wallet to decrypt</h4>
                  </div>
                  <button className="ghost-button" onClick={allowEditor} disabled={granting || !grantAddress}>
                    {granting ? 'Granting...' : 'Grant access'}
                  </button>
                </div>
                <p className="muted">
                  We update the FHE ACL for the stored key so collaborators can decrypt and resubmit encrypted bodies.
                </p>
                <div className="loader-row">
                  <input
                    value={grantAddress}
                    onChange={(e) => setGrantAddress(e.target.value)}
                    placeholder="0x collaborator address"
                    className="text-input"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {statusMessage && <div className="status-box info">{statusMessage}</div>}
    </div>
  );
}
