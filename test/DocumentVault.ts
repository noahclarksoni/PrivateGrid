import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { DocumentVault, DocumentVault__factory } from "../types";
import { expect } from "chai";

type Signers = {
    owner: HardhatEthersSigner;
    alice: HardhatEthersSigner;
    bob: HardhatEthersSigner;
};

async function deployFixture() {
    const factory = (await ethers.getContractFactory("DocumentVault")) as DocumentVault__factory;
    const contract = (await factory.deploy()) as DocumentVault;
    const contractAddress = await contract.getAddress();
    return { contract, contractAddress };
}

describe("DocumentVault", function () {
    let signers: Signers;
    let vault: DocumentVault;
    let vaultAddress: string;

    before(async function () {
        const ethSigners = await ethers.getSigners();
        signers = { owner: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
    });

    beforeEach(async function () {
        if (!fhevm.isMock) {
            console.warn("DocumentVault unit tests run only against the local FHEVM mock");
            this.skip();
        }

        ({ contract: vault, contractAddress: vaultAddress } = await deployFixture());
    });

    it("creates a document and lets the creator decrypt the key", async function () {
        const generatedKey = ethers.Wallet.createRandom().address;
        const encryptedKey = await fhevm
            .createEncryptedInput(vaultAddress, signers.owner.address)
            .addAddress(generatedKey)
            .encrypt();

        const createTx = await vault
            .connect(signers.owner)
            .createDocument("Project Plan", "", encryptedKey.handles[0], encryptedKey.inputProof);
        await createTx.wait();

        const stored = await vault.getDocument(1);
        expect(stored.name).to.eq("Project Plan");
        expect(stored.owner).to.eq(signers.owner.address);

        const clearKey = await fhevm.userDecryptEaddress(
            stored.encryptedAccessKey,
            vaultAddress,
            signers.owner,
        );
        expect(clearKey.toLowerCase()).to.eq(generatedKey.toLowerCase());

        const ids = await vault.getDocumentsFor(signers.owner.address);
        expect(ids.map((id) => Number(id))).to.deep.eq([1]);

        const canEdit = await vault.canEdit(1, signers.owner.address);
        expect(canEdit).to.eq(true);
    });

    it("lets the owner grant access and allows collaborators to update", async function () {
        const generatedKey = ethers.Wallet.createRandom().address;
        const encryptedKey = await fhevm
            .createEncryptedInput(vaultAddress, signers.owner.address)
            .addAddress(generatedKey)
            .encrypt();

        const createTx = await vault
            .connect(signers.owner)
            .createDocument("Shared Doc", "cipher://v1", encryptedKey.handles[0], encryptedKey.inputProof);
        await createTx.wait();

        await vault.connect(signers.owner).allowAccess(1, signers.bob.address);

        const collaboratorCanEdit = await vault.canEdit(1, signers.bob.address);
        expect(collaboratorCanEdit).to.eq(true);

        const decryptedByBob = await fhevm.userDecryptEaddress(
            (await vault.getDocument(1)).encryptedAccessKey,
            vaultAddress,
            signers.bob,
        );
        expect(decryptedByBob.toLowerCase()).to.eq(generatedKey.toLowerCase());

        const updateTx = await vault.connect(signers.bob).updateDocument(1, "cipher://v2");
        await updateTx.wait();

        const updated = await vault.getDocument(1);
        expect(updated.encryptedBody).to.eq("cipher://v2");
        expect(updated.lastUpdated).to.be.greaterThan(0n);
    });
});
