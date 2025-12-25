import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { DocumentVault } from "../types";
import { expect } from "chai";

type Signers = {
    alice: HardhatEthersSigner;
};

describe("DocumentVaultSepolia", function () {
    let signers: Signers;
    let vault: DocumentVault;
    let vaultAddress: string;
    let step = 0;
    let steps = 0;

    function progress(message: string) {
        console.log(`${++step}/${steps} ${message}`);
    }

    before(async function () {
        if (fhevm.isMock) {
            console.warn("DocumentVaultSepolia test must run against Sepolia");
            this.skip();
        }

        try {
            const deployment = await deployments.get("DocumentVault");
            vaultAddress = deployment.address;
            vault = await ethers.getContractAt("DocumentVault", deployment.address);
        } catch (e) {
            (e as Error).message += ". Deploy DocumentVault before running this test.";
            throw e;
        }

        const [alice] = await ethers.getSigners();
        signers = { alice };
    });

    beforeEach(async () => {
        step = 0;
        steps = 0;
    });

    it("creates a document and decrypts the stored key", async function () {
        this.timeout(5 * 40000);
        steps = 7;

        const generatedKey = ethers.Wallet.createRandom().address;
        progress("Encrypting generated access key");
        const encryptedKey = await fhevm
            .createEncryptedInput(vaultAddress, signers.alice.address)
            .addAddress(generatedKey)
            .encrypt();

        progress("Submitting document to Sepolia");
        const tx = await vault
            .connect(signers.alice)
            .createDocument("Sepolia doc", "", encryptedKey.handles[0], encryptedKey.inputProof);
        await tx.wait();

        progress("Fetching the latest document");
        const documentId = await vault.documentCount();
        const stored = await vault.getDocument(documentId);

        progress("Decrypting stored key through relayer");
        const decrypted = await fhevm.userDecryptEaddress(stored.encryptedAccessKey, vaultAddress, signers.alice);
        expect(decrypted.toLowerCase()).to.eq(generatedKey.toLowerCase());

        progress("Document stored and decrypted successfully");
    });
});
