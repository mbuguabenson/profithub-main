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
| **Analysis Tool** | [src/pages/analysis-tool/](file:///c:/Users/Castel%20Technologies/Videos/profithub-main-main/profithub-main-main/src/pages/analysis-tool) | DCIRCLES, Circles Analysis, Digit Cracker, Easy Tool, ProfitHub Analysis | `ticks`, `ticks_history` |
| **Signals & Signal Centre** | [src/pages/signals/](file:///c:/Users/Castel%20Technologies/Videos/profithub-main-main/profithub-main-main/src/pages/signals) | AI Signals Radar, Signal Centre, Technical Indicators | `ticks`, `proposal`, `buy` |
| **Auto Trades** | [src/pages/auto-trades/](file:///c:/Users/Castel%20Technologies/Videos/profithub-main-main/profithub-main-main/src/pages/auto-trades) | Full AI Strategy Engine, Martingale safety caps, Recovery mode | `authorize`, `proposal`, `buy`, `proposal_open_contract`, `sell`, `balance` |
| **AI Strategy Scanner** | [src/pages/scanner/](file:///c:/Users/Castel%20Technologies/Videos/profithub-main-main/profithub-main-main/src/pages/scanner) | Orbit Scanner Launcher, Digit Pattern Radar, Tick Stream | `ticks`, `ticks_history`, `active_symbols` |
| **Manual Trading** | [src/pages/manual-trading/](file:///c:/Users/Castel%20Technologies/Videos/profithub-main-main/profithub-main-main/src/pages/manual-trading) | Manual trade execution, contract parameters | `proposal`, `buy`, `sell` |
| **Market Killer** | [src/pages/marketkiller/](file:///c:/Users/Castel%20Technologies/Videos/profithub-main-main/profithub-main-main/src/pages/marketkiller) | Accelerated strategy execution engine | `proposal`, `buy` |
| **Multi Trader** | [src/pages/multi-trader/](file:///c:/Users/Castel%20Technologies/Videos/profithub-main-main/profithub-main-main/src/pages/multi-trader) | Bulk contract execution suite | Parallel `buy` |

---

## 🤖 Detailed Module Specifications

### 1. Bot Builder / DBot Module (`src/pages/bot-builder/`)
The Bot Builder engine is built on Deriv's `bot-skeleton` framework ([src/external/bot-skeleton/](file:///c:/Users/Castel%20Technologies/Videos/profithub-main-main/profithub-main-main/src/external/bot-skeleton)) and provides 5 primary sub-tabs:

1. **Dashboard Tab** ([src/pages/bot-builder/quick-strategy/](file:///c:/Users/Castel%20Technologies/Videos/profithub-main-main/profithub-main-main/src/pages/bot-builder/quick-strategy)):
   - **Features**: Quick Strategy creation (Martingale, D'Alembert, Oscar's Grind, Accumulators).
   - **WebSocket APIs**: `active_symbols`, `contracts_for`.

2. **Bot Builder Workspace Tab** ([src/pages/bot-builder/bot-builder.tsx](file:///c:/Users/Castel%20Technologies/Videos/profithub-main-main/profithub-main-main/src/pages/bot-builder/bot-builder.tsx)):
   - **Features**: Interactive Google Blockly visual workspace, block palette, custom XML import/export.
   - **Safety Safeguard**: Enforces `10x initial stake` maximum cap in [Purchase.js](file:///c:/Users/Castel%20Technologies/Videos/profithub-main-main/profithub-main-main/src/external/bot-skeleton/services/tradeEngine/trade/Purchase.js).
   - **WebSocket APIs**: `proposal`, `buy`, `proposal_open_contract`, `sell`, `ticks_history`.

3. **Charts Tab** ([src/pages/bot-builder/chart/](file:///c:/Users/Castel%20Technologies/Videos/profithub-main-main/profithub-main-main/src/pages/bot-builder/chart)):
   - **Features**: Live financial market charting with technical overlays and tick subscriptions.
   - **WebSocket APIs**: `ticks`, `ticks_history`.

4. **Tutorial Tab** ([src/pages/tutorials/](file:///c:/Users/Castel%20Technologies/Videos/profithub-main-main/profithub-main-main/src/pages/tutorials)):
   - **Features**: Interactive onboarding guides and strategy video documentation.

5. **AI Market Scanner Tab** ([src/pages/bot-builder/scanner/scanner.tsx](file:///c:/Users/Castel%20Technologies/Videos/profithub-main-main/profithub-main-main/src/pages/bot-builder/scanner/scanner.tsx)):
   - **Features**: Automated market scanning, digit frequency analysis, dynamic XML bot generation.
   - **WebSocket APIs**: `ticks_history`, `proposal`, `buy`.

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
