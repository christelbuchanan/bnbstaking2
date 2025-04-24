// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title BNBStaking
 * @dev A contract for staking BNB and earning rewards
 */
contract BNBStaking is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // Staker info
    struct Staker {
        uint256 stakedAmount;      // Total staked amount
        uint256 lastStakedTime;    // Last time of staking
        uint256 lastClaimedTime;   // Last time rewards were claimed
        uint256 totalRewardsClaimed; // Total rewards claimed so far
    }

    // Staking pool info
    struct Pool {
        uint256 totalStaked;       // Total BNB staked in the pool
        uint256 rewardRate;        // Reward rate per second (in basis points, 1 = 0.01%)
        uint256 minimumStakeAmount; // Minimum amount to stake
        uint256 lockPeriod;        // Lock period in seconds
    }

    // Mapping of staker address to their info
    mapping(address => Staker) public stakers;
    
    // Pool configuration
    Pool public pool;
    
    // Events
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 reward);
    event PoolUpdated(uint256 rewardRate, uint256 minimumStakeAmount, uint256 lockPeriod);

    /**
     * @dev Constructor to initialize the staking pool
     * @param _rewardRate Reward rate per second in basis points (1 = 0.01%)
     * @param _minimumStakeAmount Minimum amount to stake
     * @param _lockPeriod Lock period in seconds
     */
    constructor(
        uint256 _rewardRate,
        uint256 _minimumStakeAmount,
        uint256 _lockPeriod
    ) {
        pool.rewardRate = _rewardRate;
        pool.minimumStakeAmount = _minimumStakeAmount;
        pool.lockPeriod = _lockPeriod;
    }

    /**
     * @dev Stake BNB into the contract
     */
    function stake() external payable nonReentrant {
        require(msg.value >= pool.minimumStakeAmount, "Amount below minimum stake");
        
        Staker storage staker = stakers[msg.sender];
        
        // If this is not the first stake, calculate and add pending rewards to the staked amount
        if (staker.stakedAmount > 0) {
            uint256 pendingReward = calculateReward(msg.sender);
            staker.stakedAmount = staker.stakedAmount.add(pendingReward);
        }
        
        // Update staker info
        staker.stakedAmount = staker.stakedAmount.add(msg.value);
        staker.lastStakedTime = block.timestamp;
        staker.lastClaimedTime = block.timestamp;
        
        // Update pool total
        pool.totalStaked = pool.totalStaked.add(msg.value);
        
        emit Staked(msg.sender, msg.value);
    }

    /**
     * @dev Unstake BNB from the contract
     * @param amount Amount to unstake
     */
    function unstake(uint256 amount) external nonReentrant {
        Staker storage staker = stakers[msg.sender];
        
        require(staker.stakedAmount >= amount, "Insufficient staked amount");
        require(block.timestamp >= staker.lastStakedTime.add(pool.lockPeriod), "Still in lock period");
        
        // Calculate rewards before unstaking
        uint256 reward = calculateReward(msg.sender);
        
        // Update staker info
        staker.stakedAmount = staker.stakedAmount.sub(amount);
        staker.lastClaimedTime = block.timestamp;
        
        // Update pool total
        pool.totalStaked = pool.totalStaked.sub(amount);
        
        // Transfer unstaked amount and reward
        uint256 totalToTransfer = amount.add(reward);
        staker.totalRewardsClaimed = staker.totalRewardsClaimed.add(reward);
        
        (bool success, ) = payable(msg.sender).call{value: totalToTransfer}("");
        require(success, "Transfer failed");
        
        emit Unstaked(msg.sender, amount);
        if (reward > 0) {
            emit RewardClaimed(msg.sender, reward);
        }
    }

    /**
     * @dev Claim rewards without unstaking
     */
    function claimRewards() external nonReentrant {
        Staker storage staker = stakers[msg.sender];
        
        require(staker.stakedAmount > 0, "No staked amount");
        
        uint256 reward = calculateReward(msg.sender);
        require(reward > 0, "No rewards to claim");
        
        // Update staker info
        staker.lastClaimedTime = block.timestamp;
        staker.totalRewardsClaimed = staker.totalRewardsClaimed.add(reward);
        
        // Transfer reward
        (bool success, ) = payable(msg.sender).call{value: reward}("");
        require(success, "Transfer failed");
        
        emit RewardClaimed(msg.sender, reward);
    }

    /**
     * @dev Calculate pending reward for a staker
     * @param stakerAddress Address of the staker
     * @return Pending reward amount
     */
    function calculateReward(address stakerAddress) public view returns (uint256) {
        Staker storage staker = stakers[stakerAddress];
        
        if (staker.stakedAmount == 0 || staker.lastClaimedTime == 0) {
            return 0;
        }
        
        uint256 timeElapsed = block.timestamp.sub(staker.lastClaimedTime);
        
        // Calculate reward: stakedAmount * rewardRate * timeElapsed / 10000 / 365 days
        // rewardRate is in basis points (1 = 0.01%)
        uint256 reward = staker.stakedAmount
            .mul(pool.rewardRate)
            .mul(timeElapsed)
            .div(10000)
            .div(365 days);
            
        return reward;
    }

    /**
     * @dev Get staker info
     * @param stakerAddress Address of the staker
     * @return Staked amount, last staked time, last claimed time, total rewards claimed, pending reward
     */
    function getStakerInfo(address stakerAddress) external view returns (
        uint256 stakedAmount,
        uint256 lastStakedTime,
        uint256 lastClaimedTime,
        uint256 totalRewardsClaimed,
        uint256 pendingReward,
        uint256 unlockTime
    ) {
        Staker storage staker = stakers[stakerAddress];
        
        return (
            staker.stakedAmount,
            staker.lastStakedTime,
            staker.lastClaimedTime,
            staker.totalRewardsClaimed,
            calculateReward(stakerAddress),
            staker.lastStakedTime.add(pool.lockPeriod)
        );
    }

    /**
     * @dev Get pool info
     * @return Total staked, reward rate, minimum stake amount, lock period
     */
    function getPoolInfo() external view returns (
        uint256 totalStaked,
        uint256 rewardRate,
        uint256 minimumStakeAmount,
        uint256 lockPeriod
    ) {
        return (
            pool.totalStaked,
            pool.rewardRate,
            pool.minimumStakeAmount,
            pool.lockPeriod
        );
    }

    /**
     * @dev Update pool parameters (only owner)
     * @param _rewardRate New reward rate
     * @param _minimumStakeAmount New minimum stake amount
     * @param _lockPeriod New lock period
     */
    function updatePool(
        uint256 _rewardRate,
        uint256 _minimumStakeAmount,
        uint256 _lockPeriod
    ) external onlyOwner {
        pool.rewardRate = _rewardRate;
        pool.minimumStakeAmount = _minimumStakeAmount;
        pool.lockPeriod = _lockPeriod;
        
        emit PoolUpdated(_rewardRate, _minimumStakeAmount, _lockPeriod);
    }

    /**
     * @dev Add funds to the contract for rewards (only owner)
     */
    function addRewardFunds() external payable onlyOwner {
        // Just receive the funds
    }

    /**
     * @dev Emergency withdraw funds (only owner)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient contract balance");
        
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Transfer failed");
    }

    /**
     * @dev Receive function to accept BNB
     */
    receive() external payable {
        // Allow receiving BNB
    }
}
