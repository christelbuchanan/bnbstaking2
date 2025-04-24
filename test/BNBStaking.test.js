const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BNBStaking", function () {
  let BNBStaking;
  let staking;
  let owner;
  let addr1;
  let addr2;
  
  // Test parameters
  const rewardRate = 10; // 0.1% per second
  const minimumStakeAmount = ethers.utils.parseEther("0.1"); // 0.1 BNB
  const lockPeriod = 7 * 24 * 60 * 60; // 7 days in seconds
  
  beforeEach(async function () {
    // Get contract factory and signers
    BNBStaking = await ethers.getContractFactory("BNBStaking");
    [owner, addr1, addr2] = await ethers.getSigners();
    
    // Deploy contract
    staking = await BNBStaking.deploy(rewardRate, minimumStakeAmount, lockPeriod);
    await staking.deployed();
  });
  
  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await staking.owner()).to.equal(owner.address);
    });
    
    it("Should set the correct pool parameters", async function () {
      const poolInfo = await staking.getPoolInfo();
      expect(poolInfo.rewardRate).to.equal(rewardRate);
      expect(poolInfo.minimumStakeAmount).to.equal(minimumStakeAmount);
      expect(poolInfo.lockPeriod).to.equal(lockPeriod);
    });
  });
  
  describe("Staking", function () {
    it("Should allow staking BNB", async function () {
      const stakeAmount = ethers.utils.parseEther("1.0");
      
      await expect(staking.connect(addr1).stake({ value: stakeAmount }))
        .to.emit(staking, "Staked")
        .withArgs(addr1.address, stakeAmount);
      
      const stakerInfo = await staking.getStakerInfo(addr1.address);
      expect(stakerInfo.stakedAmount).to.equal(stakeAmount);
    });
    
    it("Should reject staking below minimum amount", async function () {
      const stakeAmount = ethers.utils.parseEther("0.05"); // Below minimum
      
      await expect(
        staking.connect(addr1).stake({ value: stakeAmount })
      ).to.be.revertedWith("Amount below minimum stake");
    });
  });
  
  describe("Unstaking", function () {
    it("Should not allow unstaking during lock period", async function () {
      const stakeAmount = ethers.utils.parseEther("1.0");
      
      await staking.connect(addr1).stake({ value: stakeAmount });
      
      await expect(
        staking.connect(addr1).unstake(stakeAmount)
      ).to.be.revertedWith("Still in lock period");
    });
    
    it("Should allow unstaking after lock period", async function () {
      const stakeAmount = ethers.utils.parseEther("1.0");
      
      await staking.connect(addr1).stake({ value: stakeAmount });
      
      // Fast forward time past lock period
      await ethers.provider.send("evm_increaseTime", [lockPeriod + 1]);
      await ethers.provider.send("evm_mine");
      
      await expect(staking.connect(addr1).unstake(stakeAmount))
        .to.emit(staking, "Unstaked")
        .withArgs(addr1.address, stakeAmount);
      
      const stakerInfo = await staking.getStakerInfo(addr1.address);
      expect(stakerInfo.stakedAmount).to.equal(0);
    });
  });
  
  describe("Rewards", function () {
    it("Should calculate rewards correctly", async function () {
      const stakeAmount = ethers.utils.parseEther("1.0");
      
      await staking.connect(addr1).stake({ value: stakeAmount });
      
      // Fast forward time (1 day)
      const timeToForward = 24 * 60 * 60;
      await ethers.provider.send("evm_increaseTime", [timeToForward]);
      await ethers.provider.send("evm_mine");
      
      // Calculate expected reward
      // reward = stakedAmount * rewardRate * timeElapsed / 10000 / 365 days
      const expectedReward = stakeAmount
        .mul(rewardRate)
        .mul(timeToForward)
        .div(10000)
        .div(365 * 24 * 60 * 60);
      
      const pendingReward = await staking.calculateReward(addr1.address);
      expect(pendingReward).to.be.closeTo(expectedReward, ethers.utils.parseEther("0.0001"));
    });
    
    it("Should allow claiming rewards", async function () {
      const stakeAmount = ethers.utils.parseEther("1.0");
      
      await staking.connect(addr1).stake({ value: stakeAmount });
      
      // Add funds to contract for rewards
      await owner.sendTransaction({
        to: staking.address,
        value: ethers.utils.parseEther("10.0")
      });
      
      // Fast forward time (30 days)
      const timeToForward = 30 * 24 * 60 * 60;
      await ethers.provider.send("evm_increaseTime", [timeToForward]);
      await ethers.provider.send("evm_mine");
      
      const balanceBefore = await ethers.provider.getBalance(addr1.address);
      
      // Get pending reward before claiming
      const pendingReward = await staking.calculateReward(addr1.address);
      
      // Claim rewards
      const tx = await staking.connect(addr1).claimRewards();
      const receipt = await tx.wait();
      
      // Calculate gas used
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      
      const balanceAfter = await ethers.provider.getBalance(addr1.address);
      
      // Check that balance increased by reward amount (minus gas)
      expect(balanceAfter.add(gasUsed).sub(balanceBefore)).to.be.closeTo(
        pendingReward,
        ethers.utils.parseEther("0.0001")
      );
    });
  });
  
  describe("Admin functions", function () {
    it("Should allow owner to update pool parameters", async function () {
      const newRewardRate = 20;
      const newMinimumStake = ethers.utils.parseEther("0.2");
      const newLockPeriod = 14 * 24 * 60 * 60; // 14 days
      
      await staking.updatePool(newRewardRate, newMinimumStake, newLockPeriod);
      
      const poolInfo = await staking.getPoolInfo();
      expect(poolInfo.rewardRate).to.equal(newRewardRate);
      expect(poolInfo.minimumStakeAmount).to.equal(newMinimumStake);
      expect(poolInfo.lockPeriod).to.equal(newLockPeriod);
    });
    
    it("Should allow owner to add reward funds", async function () {
      const fundAmount = ethers.utils.parseEther("5.0");
      const balanceBefore = await ethers.provider.getBalance(staking.address);
      
      await staking.addRewardFunds({ value: fundAmount });
      
      const balanceAfter = await ethers.provider.getBalance(staking.address);
      expect(balanceAfter.sub(balanceBefore)).to.equal(fundAmount);
    });
    
    it("Should allow owner to emergency withdraw", async function () {
      // First add some funds
      const fundAmount = ethers.utils.parseEther("5.0");
      await staking.addRewardFunds({ value: fundAmount });
      
      const balanceBefore = await ethers.provider.getBalance(owner.address);
      
      // Emergency withdraw
      const tx = await staking.emergencyWithdraw(fundAmount);
      const receipt = await tx.wait();
      
      // Calculate gas used
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      
      const balanceAfter = await ethers.provider.getBalance(owner.address);
      
      // Check that balance increased by withdrawn amount (minus gas)
      expect(balanceAfter.add(gasUsed).sub(balanceBefore)).to.equal(fundAmount);
    });
  });
});
