# ProfitHub Architecture & Platform Documentation

Welcome to the official developer documentation for **ProfitHub** — a high-performance automated trading, bot building, and market analysis platform integrated with Deriv WebSocket v3 APIs.

---

## 🏛️ Platform Architecture Overview

```
                                  +----------------------------+
                                  |     Deriv WebSocket v3     |
                                  |  wss://ws.derivws.com/v3   |
                                  +--------------+-------------+
                                                 |
                                                 v
                                  +--------------+-------------+
                                  |   api_base / WS Engine     |
                                  |   (src/utils/trade-w3.ts)  |
                                  +--------------+-------------+
                                                 |
        +-----------------------+----------------+-----------------------+
        |                       |                |                       |
        v                       v                v                       v
+-------+-------+       +-------+-------+  +-----+---------+     +-------+-------+
|  Bot Builder  |       |  Auto Trades  |  | Market Hunter |     | Smart Trading |
|  (DBot Engine)|       |  (AI Engine)  |  | (Orbit Scanner|     | (Signals)     |
+---------------+       +---------------+  +---------------+     +---------------+
```

---

## 🧭 Page & Component Route Mappings

| Page / Feature | Route / File Path | Core Functionality | WebSocket API Calls |
| :--- | :--- | :--- | :--- |
| **Bot Builder (DBot)** | [src/pages/bot-builder/](file:///c:/Users/Castel%20Technologies/Videos/profithub-main-main/profithub-main-main/src/pages/bot-builder) | Blockly XML Workspace, Quick Strategies, Custom XML Import | `proposal`, `buy`, `proposal_open_contract`, `sell`, `ticks_history` |
| **Auto Trades** | [src/pages/auto-trades/](file:///c:/Users/Castel%20Technologies/Videos/profithub-main-main/profithub-main-main/src/pages/auto-trades) | Full AI Strategy Engine, Martingale safety caps, Recovery mode | `authorize`, `proposal`, `buy`, `proposal_open_contract`, `sell`, `balance` |
| **Market Hunter Pro** | [src/pages/market-hunter-pro/](file:///c:/Users/Castel%20Technologies/Videos/profithub-main-main/profithub-main-main/src/pages/market-hunter-pro) | Orbit Scanner Launcher, Digit Pattern Radar, Tick Stream | `ticks`, `ticks_history`, `active_symbols` |
| **Smart Trading** | [src/pages/smart-trading/](file:///c:/Users/Castel%20Technologies/Videos/profithub-main-main/profithub-main-main/src/pages/smart-trading) | Signal Centre, Technical Indicators (RSI/SMA/MACD), Contract Quotes | `contracts_for`, `proposal`, `buy` |
| **DTrader / Trading View**| [src/pages/dtrader/](file:///c:/Users/Castel%20Technologies/Videos/profithub-main-main/profithub-main-main/src/pages/dtrader) | Interactive Charting, Position Management, Stop Loss / Take Profit | `proposal`, `buy`, `sell`, `proposal_open_contract`, `contract_update`, `cancel` |
| **Transactions & Cashier** | [src/components/transactions/](file:///c:/Users/Castel%20Technologies/Videos/profithub-main-main/profithub-main-main/src/components/transactions) | Transaction Log, Journal, Deduplicated Logs (`HH:mm:ss [GMT]`) | `profit_table`, `statement`, `balance`, `get_account_status` |

---

## ⚡ Central Trading WebSocket API Suite

All Trading API methods are standardized and exported from [trade-purchase.ts](file:///c:/Users/Castel%20Technologies/Videos/profithub-main-main/profithub-main-main/src/utils/trade-purchase.ts):

### 1. `buyContractForUi({ parameters, price, source })`
- **WS Call**: `{ proposal: 1, ... }` -> `{ buy: proposal.id, price }` (with direct `buy: "1"` fallback).
- **Safety**: Validates demo/real balance and token permissions before buying.

### 2. `sellContractForUi({ contractId, price, source })`
- **WS Call**: `{ sell: contractId, price }`
- **Result**: Cashes out active contract immediately at market price.

### 3. `streamContractUntilSettled({ contractId, onUpdate, source })`
- **WS Call**: `{ proposal_open_contract: 1, contract_id, subscribe: 1 }`
- **Watchdog & Recovery**: Includes automatic 5-second polling and `profit_table` fallback recovery if WebSocket stream drops.

### 4. `updateContractForUi({ contractId, stopLoss, takeProfit, source })`
- **WS Call**: `{ contract_update: 1, contract_id, limit_order: { stop_loss, take_profit } }`
- **Result**: Sets or modifies dynamic risk limits on active open contracts.

### 5. `getContractUpdateHistoryForUi({ contractId, source })`
- **WS Call**: `{ contract_update_history: 1, contract_id }`
- **Result**: Retrieves audit history of parameter changes for contract.

### 6. `cancelContractForUi({ contractId, source })`
- **WS Call**: `{ cancel: contractId }`
- **Result**: Cancels eligible Multipliers / Accumulators within cancellation window.

### 7. `buyBulkContractsForUi({ parameters, price, count, source })`
- **WS Call**: Parallel `Promise.all` execution of `N` contract purchases simultaneously.

---

## 🛡️ Safety & Reliability Systems

1. **Martingale Stake Cap (10x Base Stake Limit)**:
   - Compounding martingale stakes are strictly capped at `10x initial stake`.
   - Any loss streak exceeding the safety threshold automatically resets the trade stake to `initial stake` instead of escalating to oversized amounts ($213.62, $534.06).
   - Applied across `auto-trades.tsx`, `full-ai-trade-engine.ts`, `bot-xml-generator.ts`, `scanner.tsx`, and `Purchase.js` in `bot-skeleton`.

2. **Journal Log Deduplication**:
   - `journalStore` automatically deduplicates identical log messages emitted within the exact same second (`HH:mm:ss [GMT]`).

3. **Deriv API Reference Agent Skill**:
   - Located at [.agents/skills/deriv_api_reference/SKILL.md](file:///c:/Users/Castel%20Technologies/Videos/profithub-main-main/profithub-main-main/.agents/skills/deriv_api_reference/SKILL.md) and [endpoints.json](file:///c:/Users/Castel%20Technologies/Videos/profithub-main-main/profithub-main-main/.agents/skills/deriv_api_reference/endpoints.json).
