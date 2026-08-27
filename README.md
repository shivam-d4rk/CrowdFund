# Crypto Crowdfunding dApp (Remix + React)

This project is a decentralized crowdfunding platform where campaign rules are enforced by a smart contract instead of a centralized server.

You can use this README as your full explanation sheet for class/demo.

## 1. What This Project Is

This is a full-stack Web3 dApp with:

- an on-chain crowdfunding contract written in Solidity
- a frontend dashboard (React) to create and fund campaigns
- wallet integration (MetaMask)
- escrow-like release/refund logic enforced by blockchain rules

Main idea:

- money is collected in the smart contract
- creator receives funds only when conditions are met
- donors can refund when campaign fails or is canceled

## 2. What We Have Built

Implemented features:

- Campaign creation with title, description, ETH goal, and duration
- Donation flow from connected wallet
- Automatic campaign status evaluation (active, goal met, released, canceled)
- Creator fund release button with strict eligibility checks
- Donor refund support in failed/canceled scenarios
- Platform fee model in basis points (BPS)
- Owner controls for fee percentage and fee recipient
- Remix-based Solidity test suite
- Frontend with two-view sidebar navigation:
   - Create Campaign
   - Active Campaigns
- Improved UI spacing, centering, and scroll behavior

## 3. How Blockchain Is Used Here

Blockchain is used as the trust layer.

All important financial rules are executed on-chain in [contracts/CryptoCrowdfund.sol](contracts/CryptoCrowdfund.sol):

- who can donate
- when creator can claim funds
- when donors can refund
- fee calculation and transfer

Because these rules are in a smart contract:

- anyone can verify logic
- no centralized admin can secretly change campaign outcomes
- all transactions are transparent on-chain

## 4. Which Blockchain Network Is Used

Network used: Ethereum Sepolia testnet.

- Chain ID: 11155111
- Wallet: MetaMask (Injected Provider in Remix)
- Frontend expects Sepolia via [frontend/src/lib/contract.js](frontend/src/lib/contract.js)

Why Sepolia:

- safe for development
- uses test ETH (no real money)
- same Ethereum behavior for learning/demo
- it is very safe and secured.

## 5. AI Usage Clarification

Runtime AI in the app: none.

This dApp does not include an AI model in production logic.

AI-assisted development: yes.

- AI coding assistance was used to speed up coding, refactoring, and UI cleanup
- blockchain rules and transactions still execute only through Solidity + Ethereum

So if asked in class:

- AI helped development productivity
- blockchain provides actual trust/execution layer

## 6. Tech Stack (Detailed)

Smart contract layer:

- Solidity 0.8.20
- Remix IDE for compile/deploy
- Remix Solidity Unit Testing plugin for tests

Blockchain interaction:

- Ethers.js v6
- MetaMask wallet connection and transaction signing

Frontend:

- React (functional components + hooks)
- Vite (development server and bundling)
- Custom CSS (themed layout, sidebar, responsive UI)

Testing:

- Solidity tests in [tests/CryptoCrowdfundRemix_test.sol](tests/CryptoCrowdfundRemix_test.sol)

Config:

- environment variables in [frontend/.env](frontend/.env)

## 7. Project Structure

- [contracts/CryptoCrowdfund.sol](contracts/CryptoCrowdfund.sol): main smart contract
- [tests/CryptoCrowdfundRemix_test.sol](tests/CryptoCrowdfundRemix_test.sol): Remix unit tests
- [frontend/src/App.jsx](frontend/src/App.jsx): frontend logic and UI structure
- [frontend/src/App.css](frontend/src/App.css): frontend styling
- [frontend/src/lib/contract.js](frontend/src/lib/contract.js): ABI + contract constants

## 8. Smart Contract Logic (Teacher-Friendly Summary)

Core functions in [contracts/CryptoCrowdfund.sol](contracts/CryptoCrowdfund.sol):

- createCampaign:
   creates new campaign with deadline and goal

- donate:
   accepts ETH only while campaign is active and not canceled/released

- cancelCampaign:
   only creator can cancel before deadline and before goal is met

- releaseFunds:
   only creator, only after deadline, only if goal met
   also applies platform fee

- refund:
   allows donor withdrawal if campaign canceled or failed after deadline

Important safety pattern:

- in refund, donor amount is set to zero before transfer (checks-effects-interactions style)

## 9. Frontend Workflow

In [frontend/src/App.jsx](frontend/src/App.jsx):

- Connect wallet
- Load campaigns from contract
- Show two sidebar views:
   - Create Campaign form
   - Active Campaigns cards
- Trigger transactions:
   - createCampaign
   - donate
   - releaseFunds

Display and UX improvements:

- cleaner card stats
- responsive layout
- centered page sections
- smoother scroll behavior

## 10. Deployment and Run Steps

### A) Deploy contract in Remix

1. Open Remix.
2. Add [contracts/CryptoCrowdfund.sol](contracts/CryptoCrowdfund.sol).
3. Compile with Solidity 0.8.20.
4. Deploy using Injected Provider (MetaMask).
5. Select Sepolia in MetaMask.
6. Deploy constructor with initial fee BPS (example: 250).
7. Copy deployed contract address.

### B) Configure frontend

Edit [frontend/.env](frontend/.env):

- VITE_CROWDFUND_CONTRACT_ADDRESS = your deployed address
- VITE_CHAIN_ID = 11155111

Optional RPC entry (if needed):

- VITE_ALCHEMY_SEPOLIA_RPC = your Sepolia RPC URL

### C) Run frontend

```bash
cd frontend
npm install
npm run dev
```

## 11. Testing

Run Solidity tests in Remix using [tests/CryptoCrowdfundRemix_test.sol](tests/CryptoCrowdfundRemix_test.sol).

Covered cases include:

- campaign creation
- donation tracking
- cancel and refund flow
- rejection of invalid refund

## 12. Security and Limitations

Security notes:

- testnet-only by default
- fee parameters are owner-controlled
- contract should be audited before real mainnet use

Current limitations:

- no backend database/indexer
- no pagination for large campaign counts
- no formal audit or fuzz test suite yet

## 13. Quick Viva / Teacher Explanation Script

You can explain it like this:

1. This is a decentralized crowdfunding app where trust comes from smart contract rules.
2. We deployed Solidity contract on Sepolia and connected it to a React frontend via Ethers.js.
3. Campaign creation, donations, release, and refunds are all blockchain transactions.
4. The contract enforces conditions, so no central admin can manually manipulate outcomes.
5. AI was used only for coding assistance during development, not as runtime business logic.

## 14. Future Improvements

- add creator profile and campaign categories
- add event indexing for faster campaign history
- add unit/integration tests for frontend
- add contract audit and production hardening

## 15. Basic AI Feature (Groq)

A basic AI helper is now added to generate campaign descriptions.

What was added:

- Backend endpoint: [frontend/ai-server.js](frontend/ai-server.js)
- Frontend button in create form: [frontend/src/App.jsx](frontend/src/App.jsx)
- AI button styling: [frontend/src/App.css](frontend/src/App.css)

How it works:

1. User enters campaign title (and optional goal/duration).
2. User clicks Generate with AI.
3. Frontend sends request to local backend `/api/ai/campaign-description`.
4. Backend calls Groq API securely using `GROQ_API_KEY` from env.
5. Generated text is returned and auto-filled into description.

Important security point:

- API key is stored server-side (`GROQ_API_KEY`), not exposed in browser code.

Run steps:

```bash
cd frontend
npm install
```

In terminal 1:

```bash
npm run ai:server
```

In terminal 2:

```bash
npm run dev
```

Required env values in [frontend/.env](frontend/.env):

- `GROQ_API_KEY=your_real_key`
- `VITE_AI_API_URL=http://localhost:8787`

Optional:

- `GROQ_MODEL=llama-3.1-8b-instant`
- `AI_SERVER_PORT=8787`
