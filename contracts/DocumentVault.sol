// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, eaddress, externalEaddress} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title DocumentVault
/// @notice Stores encrypted documents and encrypted access keys while leveraging Zama FHE for access control.
contract DocumentVault is ZamaEthereumConfig {
    struct Document {
        string name;
        string encryptedBody;
        eaddress encryptedAccessKey;
        address owner;
        uint256 lastUpdated;
    }

    uint256 private _documentCount;
    mapping(uint256 => Document) private _documents;
    mapping(address => uint256[]) private _documentsByOwner;
    mapping(uint256 => mapping(address => bool)) private _canEdit;

    event DocumentCreated(uint256 indexed documentId, address indexed owner, string name);
    event DocumentUpdated(
        uint256 indexed documentId,
        address indexed editor,
        bytes32 bodyFingerprint,
        uint256 timestamp
    );
    event AccessGranted(uint256 indexed documentId, address indexed grantee);

    modifier onlyExisting(uint256 documentId) {
        require(_documents[documentId].owner != address(0), "Document missing");
        _;
    }

    modifier onlyOwner(uint256 documentId) {
        require(_documents[documentId].owner == msg.sender, "Only owner");
        _;
    }

    modifier onlyEditor(uint256 documentId) {
        require(_canEdit[documentId][msg.sender], "No permission");
        _;
    }

    /// @notice Create a new document with an encrypted access key.
    /// @param name Human readable document name.
    /// @param encryptedBody The body encrypted off-chain using the generated access key.
    /// @param encryptedKey Encrypted access key handle.
    /// @param inputProof Proof that validates the encrypted access key.
    /// @return documentId The identifier of the created document.
    function createDocument(
        string calldata name,
        string calldata encryptedBody,
        externalEaddress encryptedKey,
        bytes calldata inputProof
    ) external returns (uint256 documentId) {
        require(bytes(name).length > 0, "Name required");

        eaddress internalKey = FHE.fromExternal(encryptedKey, inputProof);

        _documentCount += 1;
        documentId = _documentCount;

        _documents[documentId] = Document({
            name: name,
            encryptedBody: encryptedBody,
            encryptedAccessKey: internalKey,
            owner: msg.sender,
            lastUpdated: block.timestamp
        });

        _documentsByOwner[msg.sender].push(documentId);
        _canEdit[documentId][msg.sender] = true;

        // Allow the creator to decrypt the stored access key
        FHE.allow(internalKey, msg.sender);
        FHE.allowThis(internalKey);

        emit DocumentCreated(documentId, msg.sender, name);
    }

    /// @notice Update the encrypted body of an existing document.
    /// @param documentId Target document identifier.
    /// @param newEncryptedBody Body encrypted off-chain with the shared access key.
    function updateDocument(uint256 documentId, string calldata newEncryptedBody)
        external
        onlyExisting(documentId)
        onlyEditor(documentId)
    {
        Document storage doc = _documents[documentId];
        doc.encryptedBody = newEncryptedBody;
        doc.lastUpdated = block.timestamp;

        emit DocumentUpdated(documentId, msg.sender, keccak256(bytes(newEncryptedBody)), doc.lastUpdated);
    }

    /// @notice Allow another address to decrypt the encrypted access key and edit the document.
    /// @param documentId Target document identifier.
    /// @param grantee Address that should be able to decrypt and edit.
    function allowAccess(uint256 documentId, address grantee) external onlyExisting(documentId) onlyOwner(documentId) {
        require(grantee != address(0), "Invalid grantee");

        Document storage doc = _documents[documentId];
        _canEdit[documentId][grantee] = true;

        FHE.allow(doc.encryptedAccessKey, grantee);

        emit AccessGranted(documentId, grantee);
    }

    /// @notice Return stored document data.
    /// @param documentId Target document identifier.
    /// @return Document struct including encrypted key and body.
    function getDocument(uint256 documentId) external view onlyExisting(documentId) returns (Document memory) {
        return _documents[documentId];
    }

    /// @notice Retrieve document identifiers created by an address.
    /// @param owner Address that created documents.
    /// @return Array of document identifiers.
    function getDocumentsFor(address owner) external view returns (uint256[] memory) {
        return _documentsByOwner[owner];
    }

    /// @notice Check if an address can edit a document.
    /// @param documentId Target document identifier.
    /// @param account Address to check.
    /// @return True if the account can edit.
    function canEdit(uint256 documentId, address account) external view returns (bool) {
        return _canEdit[documentId][account];
    }

    /// @notice Return the number of documents created.
    function documentCount() external view returns (uint256) {
        return _documentCount;
    }
}
