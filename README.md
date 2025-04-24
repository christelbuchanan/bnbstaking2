# BNB Staking Smart Contract

A smart contract for staking BNB on BNB Chain and earning rewards.

## Features

- Stake BNB and earn rewards based on staking duration
- Configurable reward rate, minimum stake amount, and lock period
- Claim rewards without unstaking
- Owner can update pool parameters and add reward funds
- Emergency withdrawal function for contract owner
- Comprehensive test suite

## Contract Overview

The `BNBStaking` contract allows users to:

1. Stake BNB tokens
2. Earn rewards based on staking duration and amount
3. Unstake tokens after the lock period
4. Claim rewards without unstaking

## Technical Details

- Built with Solidity 0.8.18
- Uses OpenZeppelin contracts for security
- Implements ReentrancyGuard to prevent reentrancy attacks
- Uses SafeMath for arithmetic operations

## Contract Parameters

- **Reward Rate**: The rate at which rewards accrue (in basis points, 1 = 0.01% per second)
- **Minimum Stake Amount**: The minimum amount of BNB that can be staked
- **Lock Period**: The duration for which staked BNB is locked

## Deployment

To deploy the contract:

1. Set up your `.env` file with your private key:
   ```
   PRIVATE_KEY=your_private_key_here
   ```

2. Compile the contract:
   ```
   npx hardhat compile
   ```

3. Deploy to BSC Testnet:
   ```
   npx hardhat run scripts/deploy.js --network bscTestnet
   ```

4. Deploy to BSC Mainnet:
   ```
   npx hardhat run scripts/deploy.js --network bsc
   ```

## Testing

Run the test suite:

```
npx hardhat test
```

## Security Considerations

- The contract uses ReentrancyGuard to prevent reentrancy attacks
- Owner functions are protected with the Ownable modifier
- The contract uses SafeMath for arithmetic operations to prevent overflows
- Funds can only be withdrawn by the contract owner

## License

MIT
