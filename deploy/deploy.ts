import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedDocumentVault = await deploy("DocumentVault", {
    from: deployer,
    log: true,
  });

  console.log(`DocumentVault contract: `, deployedDocumentVault.address);
};
export default func;
func.id = "deploy_documentVault"; // id required to prevent reexecution
func.tags = ["DocumentVault"];
