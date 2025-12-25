import { task } from "hardhat/config";
import type { DocumentVault } from "../types";

task("document:create", "Create a document with a freshly generated access key")
    .addParam("name", "Name of the document")
    .addOptionalParam("body", "Encrypted body to store", "")
    .setAction(async ({ name, body }, hre) => {
        const [signer] = await hre.ethers.getSigners();
        const deployment = await hre.deployments.get("DocumentVault");
        const contract = (await hre.ethers.getContractAt(
            "DocumentVault",
            deployment.address,
        )) as unknown as DocumentVault;

        const generatedKey = hre.ethers.Wallet.createRandom().address;
        const encryptedKey = await hre.fhevm
            .createEncryptedInput(deployment.address, signer.address)
            .addAddress(generatedKey)
            .encrypt();

        const tx = await contract
            .connect(signer)
            .createDocument(name, body, encryptedKey.handles[0], encryptedKey.inputProof);
        const receipt = await tx.wait();
        const created = receipt?.logs?.find((log) => log.fragment?.name === "DocumentCreated");
        console.log(`Document created`);
        console.log(`- id: ${created?.args?.documentId?.toString?.() ?? "unknown"}`);
        console.log(`- key: ${generatedKey}`);
        console.log(`- contract: ${deployment.address}`);
    });

task("document:allow", "Grant another address access to decrypt the stored key")
    .addParam("documentId", "Document identifier")
    .addParam("grantee", "Address to allow")
    .setAction(async ({ documentId, grantee }, hre) => {
        const [signer] = await hre.ethers.getSigners();
        const deployment = await hre.deployments.get("DocumentVault");
        const contract = (await ethers.getContractAt(
            "DocumentVault",
            deployment.address,
        )) as unknown as DocumentVault;

        const tx = await contract.connect(signer).allowAccess(BigInt(documentId), grantee);
        await tx.wait();
        console.log(`Granted access to ${grantee} for document ${documentId}`);
    });
