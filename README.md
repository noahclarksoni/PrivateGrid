# PrivateGrid

PrivateGrid is a privacy-first document collaboration system built on Zama FHEVM. It stores only encrypted document
content and an encrypted access key on-chain, while still enabling fine-grained sharing and editing.

## Table of Contents

- Overview
- Problem Statement
- Solution Overview
- Core Advantages
- How It Works
- Data Model
- Architecture
- Tech Stack
- Repository Layout
- Getting Started
- Configuration
- Development Workflow
- Deployment
- Frontend Notes
- Security and Privacy Model
- Constraints and Assumptions
- Future Roadmap

## Overview

PrivateGrid lets users create, edit, and share documents without exposing plaintext to the blockchain. A user generates a
random access key locally, encrypts it using Zama FHE, and submits the encrypted key along with the document name and
encrypted body. Authorized users can decrypt the access key and continue editing, while unauthorized observers see only
ciphertext.

## Problem Statement

Traditional on-chain document workflows face multiple issues:

- Plaintext data on public chains is visible to everyone forever.
- Off-chain encryption often breaks on-chain access control and auditing.
- Sharing secrets between collaborators is difficult to manage securely.
- Centralized storage reintroduces trust assumptions and single points of failure.

## Solution Overview

PrivateGrid combines on-chain storage with Fully Homomorphic Encryption (FHE) access control:

- The document body is encrypted off-chain using a locally generated access key.
- The access key is encrypted with Zama FHE and stored on-chain.
- Only allowed addresses can decrypt the access key and edit the document.
- All edits are logged on-chain, providing a tamper-evident history.

## Core Advantages

- On-chain privacy: plaintext never leaves the client.
- Transparent access control: permissions are enforced by the smart contract.
- Collaborative editing: owners can grant access to other addresses without sharing secrets off-chain.
- Auditability: creation and update events are recorded on-chain.
- Minimal trust: no centralized server is required for encryption or access control.

## How It Works

1. Create
   - A user generates a random access key (an EVM-style address) locally.
   - The key is encrypted with Zama FHE and submitted with the document name and encrypted body.
2. Read and Edit
   - The user (or any allowed editor) decrypts the encrypted key.
   - The document body is decrypted locally, edited, then re-encrypted with the same key.
   - The updated ciphertext is stored on-chain.
3. Share
   - The owner grants access to another address.
   - The contract allows that address to decrypt the encrypted access key via FHE allow rules.

## Data Model

The on-chain `Document` structure includes:

- `name`: human-readable document name
- `encryptedBody`: ciphertext string produced off-chain
- `encryptedAccessKey`: FHE-encrypted access key (eaddress)
- `owner`: document creator
- `lastUpdated`: UNIX timestamp of the latest update

## Architecture

- Smart Contract: `DocumentVault` stores encrypted data and enforces access control.
- FHEVM: Zama FHE provides encrypted access key handling and permissioned decryption.
- Frontend: React + Vite UI handles encryption/decryption and user actions.
- Relayer: Zama relayer SDK used for encrypted inputs and proofs.

## Tech Stack

- Solidity 0.8.27 with Zama FHEVM libraries
- Hardhat + hardhat-deploy for compilation, testing, and deployment
- TypeScript for tasks and frontend
- React + Vite for UI
- viem for contract reads, ethers for contract writes
- RainbowKit and wagmi for wallet connectivity

## Repository Layout

- `contracts/` smart contracts
- `deploy/` deployment scripts
- `tasks/` Hardhat tasks
- `test/` tests
- `app/` frontend application
- `deployments/sepolia/` deployed contract artifacts and ABI

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- A wallet funded on Sepolia

### Install Dependencies

```bash
npm install
```

```bash
cd app
npm install
```

## Configuration

Create a `.env` file in the repository root and set:

```bash
INFURA_API_KEY=your_infura_key
PRIVATE_KEY=your_deployer_private_key
ETHERSCAN_API_KEY=optional_etherscan_key
```

Notes:

- Use `PRIVATE_KEY` only. Do not use mnemonics.
- The frontend does not use environment variables; configuration is stored in code.

## Development Workflow

Compile and test contracts:

```bash
npm run compile
npm run test
```

Useful Hardhat tasks:

```bash
npx hardhat accounts
npx hardhat document:create --name "My Doc" --body "<ciphertext>"
npx hardhat document:allow --document-id 1 --grantee 0x...
```

## Deployment

1. Run tests and ensure they pass.
2. Deploy to Sepolia:

```bash
npx hardhat deploy --network sepolia
```

Optional verification:

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

## Frontend Notes

- The UI is built in `app/` and connects to Sepolia.
- The frontend must use the ABI generated in `deployments/sepolia/`. Copy the ABI into a TypeScript file (avoid JSON
  imports) and update the contract address constants.
- Reads use viem; writes use ethers.
- The UI does not rely on local storage and should not connect to localhost networks.

Run the frontend:

```bash
cd app
npm run dev
```

## Security and Privacy Model

- Access keys are generated locally and never stored in plaintext on-chain.
- The encrypted access key is protected by Zama FHE and can only be decrypted by allowed addresses.
- Document bodies are encrypted off-chain; the chain only stores ciphertext.
- Access control is enforced by the contract and backed by on-chain audit trails.

## Constraints and Assumptions

- If a user loses the access key, the document cannot be decrypted.
- Large document bodies increase on-chain storage costs.
- The contract does not expose plaintext to any view or event.
- Permissions are explicit: only the owner can grant access.

## Future Roadmap

- Key rotation and access revocation flows
- Version history and diff metadata
- Multi-party approvals for sensitive documents
- Encrypted search indexes for document discovery
- Optional off-chain storage with on-chain integrity proofs
- Improved UX for key backup and recovery workflows
- Expanded audit tooling and analytics dashboards

## License

BSD-3-Clause-Clear. See `LICENSE`.
