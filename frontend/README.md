# Frontend - Crypto Crowdfunding

React + Vite + Ethers frontend for the Remix-deployed crowdfunding contract.

## Setup

1. Ensure contract is deployed from Remix.
2. Open `.env` and set `VITE_CROWDFUND_CONTRACT_ADDRESS`.
3. Install dependencies and run:

```bash
npm install
npm run dev
```

## Required Environment Variables

- `VITE_CROWDFUND_CONTRACT_ADDRESS`: contract address deployed in Remix
- `VITE_CHAIN_ID`: network chain id (Sepolia `11155111`)
- `VITE_ALCHEMY_SEPOLIA_RPC`: optional display value in app context

## Scripts

- `npm run dev` - start development server
- `npm run build` - production build
- `npm run lint` - run ESLint
