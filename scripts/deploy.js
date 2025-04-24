const hre = require("hardhat");

async function main() {
  console.log("Deploying BNB Staking contract...");

  // Default parameters:
  // rewardRate: 10 (0.1% per second)
  // minimumStakeAmount: 0.1 BNB (in wei)
  // lockPeriod: 7 days (in seconds)
  const rewardRate = 10;
  const minimumStakeAmount = hre.ethers.utils.parseEther("0.1");
  const lockPeriod = 7 * 24 * 60 * 60; // 7 days in seconds

  const BNBStaking = await hre.ethers.getContractFactory("BNBStaking");
  const staking = await BNBStaking.deploy(rewardRate, minimumStakeAmount, lockPeriod);

  await staking.deployed();

  console.log(`BNB Staking contract deployed to: ${staking.address}`);
  console.log(`Parameters:`);
  console.log(`- Reward Rate: ${rewardRate} (0.1% per second)`);
  console.log(`- Minimum Stake: ${hre.ethers.utils.formatEther(minimumStakeAmount)} BNB`);
  console.log(`- Lock Period: ${lockPeriod} seconds (${lockPeriod / (24 * 60 * 60)} days)`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
