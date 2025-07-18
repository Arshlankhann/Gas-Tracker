# ⛽ Real-Time Cross-Chain Gas Price Tracker with Wallet Simulation

🚀 **Live Demo**: [https://gas-tracker-pi.vercel.app/](https://gas-tracker-pi.vercel.app/)

---

## 📌 Project Overview

A **React.js + Web3 dashboard** that displays **real-time gas prices** across **Ethereum, Polygon, and Arbitrum**, and allows users to **simulate wallet transactions** to calculate **USD gas + transaction costs** using only **on-chain data**.

---

## ✨ Features
✔ **Real-Time Gas Prices** via native RPC (Ethereum, Polygon, Arbitrum)  
✔ **No third-party APIs** for gas data  
✔ **ETH/USD price from Uniswap V3 Swap events**  
✔ **Transaction simulation** with cost comparison  
✔ **Interactive candlestick chart** using `lightweight-charts`  
✔ **Built with React, Zustand, and Ethers.js**  

---

## 🛠 Tech Stack
- **Frontend:** React.js, Tailwind CSS
- **State Management:** Zustand
- **Blockchain Interaction:** Ethers.js
- **Charts:** Lightweight Charts
- **WebSocket Providers:** Ethereum, Polygon, Arbitrum

---

## 🔍 Problem Statement
Build a **React dashboard** that:
1. Fetches **real-time gas fees** from 3 blockchains via WebSocket.
2. Calculates **USD transaction cost** for a given amount (ETH/MATIC).
3. Displays **gas volatility** on an interactive chart.

---

## 📈 Architecture
```mermaid
graph LR
  A[User] --> B[React Frontend]
  B --> C[Zustand Store]
  C --> D{Mode}
  D -->|Live| E[WebSocket RPC]
  D -->|Simulate| F[Cost Calculator]
  E --> G[Ethereum RPC]
  E --> H[Polygon RPC]
  E --> I[Arbitrum RPC]
  F --> J[Uniswap V3 ETH/USDC Pool]
  J --> K[Parse Swap Events]
  K --> L[Calculate ETH/USD]
  L --> M[Gas Cost in USD]
  G --> N[Base/Priority Fees]
  H --> N
  I --> N
  N --> O[Candlestick Chart]
  O --> P[Lightweight Charts]
  M --> P
