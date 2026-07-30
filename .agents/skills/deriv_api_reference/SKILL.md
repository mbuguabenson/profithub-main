---
name: deriv_api_reference
description: Comprehensive Deriv WebSocket v3 API specifications, endpoints schema, trading calls, market data, and auto-sync instructions from api.deriv.com.
---

# Deriv WebSocket v3 API Reference & Agent Skill

This skill provides AI agents with full, authoritative specifications for interacting with Deriv's WebSocket v3 API (`wss://ws.derivws.com/websockets/v3?app_id={APP_ID}`).

---

## 🌐 Endpoint & Connection Protocol

- **Production WebSocket URL**: `wss://ws.derivws.com/websockets/v3?app_id={APP_ID}`
- **Staging WebSocket URL**: `wss://ws.derivws.com/websockets/v3?app_id={APP_ID}&l=EN&brand=deriv`
- **Default App ID**: Read from environment (`process.env.VITE_DERIV_APP_ID` or fallback `1089` / `69472` for custom apps).
- **Authentication**: Send `{ "authorize": "<API_TOKEN>" }` immediately after opening the connection for private account operations.

---

## ⚡ Core WebSocket API Schema Categories

### 1. Trading & Contract Management

#### `proposal`
- **Description**: Subscribes or fetches price proposal quotes for trading contracts.
- **Request Payload**:
  ```json
  {
    "proposal": 1,
    "amount": 10,
    "basis": "stake",
    "contract_type": "CALL",
    "currency": "USD",
    "duration": 5,
    "duration_unit": "t",
    "symbol": "R_100",
    "subscribe": 1
  }
  ```
- **Response**: Returns contract details including `id`, `ask_price`, `payout`, `spot`, and `barrier`.

#### `buy`
- **Description**: Purchases a contract using either a proposal ID or direct contract parameters.
- **Proposal ID Purchase Payload**:
  ```json
  {
    "buy": "2d8f99e4-5c91-4d94-a212-3211516e8b23",
    "price": 10.00
  }
  ```
- **Direct Parameters Purchase Payload**:
  ```json
  {
    "buy": "1",
    "price": 10.00,
    "parameters": {
      "amount": 10,
      "basis": "stake",
      "contract_type": "CALL",
      "currency": "USD",
      "duration": 5,
      "duration_unit": "t",
      "symbol": "R_100"
    }
  }
  ```
- **Response**: Returns `buy` object with `contract_id`, `transaction_id`, `buy_price`, and `balance_after`.

#### `sell`
- **Description**: Sells an active open contract before expiry at the current market bid price.
- **Request Payload**:
  ```json
  {
    "sell": 123456789,
    "price": 0
  }
  ```
- **Response**: Returns `sell` object with `contract_id`, `sold_for`, `transaction_id`, and `balance_after`.

#### `proposal_open_contract`
- **Description**: Streams or polls real-time updates for an active contract.
- **Request Payload**:
  ```json
  {
    "proposal_open_contract": 1,
    "contract_id": 123456789,
    "subscribe": 1
  }
  ```
- **Response**: Streams contract state including `status` (`open`/`won`/`lost`/`sold`), `entry_spot`, `exit_spot`, `current_spot`, `profit`, `barrier`, and `is_sold`.

#### `contract_update`
- **Description**: Updates risk management limits (Stop Loss / Take Profit) on an open contract.
- **Request Payload**:
  ```json
  {
    "contract_update": 1,
    "contract_id": 123456789,
    "limit_order": {
      "stop_loss": 5.00,
      "take_profit": 15.00
    }
  }
  ```

#### `contract_update_history`
- **Description**: Retrieves audit trail history of contract parameter updates.
- **Request Payload**:
  ```json
  {
    "contract_update_history": 1,
    "contract_id": 123456789
  }
  ```

#### `cancel`
- **Description**: Cancels an eligible contract (e.g. Multipliers / Accumulators) within its cancellation window.
- **Request Payload**:
  ```json
  {
    "cancel": 123456789
  }
  ```

---

### 2. Market Data & Tick Streams

#### `ticks`
- **Description**: Subscribes to real-time tick price feeds for a given market symbol.
- **Request Payload**: `{ "ticks": "R_100", "subscribe": 1 }`

#### `ticks_history`
- **Description**: Fetches historic tick or OHLC candle data.
- **Request Payload**:
  ```json
  {
    "ticks_history": "R_100",
    "adjust_start_time": 1,
    "count": 500,
    "end": "latest",
    "style": "ticks"
  }
  ```

#### `active_symbols`
- **Description**: Retrieves list of all open markets, assets, and trade categories.
- **Request Payload**: `{ "active_symbols": "brief", "product_type": "basic" }`

#### `contracts_for`
- **Description**: Retrieves available trade contract types and duration limits for a symbol.
- **Request Payload**: `{ "contracts_for": "R_100" }`

---

### 3. Account & Cashier APIs

#### `authorize`
- **Description**: Authenticates WebSocket connection.
- **Request Payload**: `{ "authorize": "<API_TOKEN>" }`

#### `balance`
- **Description**: Streams user account balance and currency updates.
- **Request Payload**: `{ "balance": 1, "subscribe": 1 }`

#### `profit_table`
- **Description**: Retrieves closed contract transaction history.
- **Request Payload**: `{ "profit_table": 1, "description": 1, "limit": 50, "sort": "DESC" }`

#### `statement`
- **Description**: Retrieves account transaction ledger statement.
- **Request Payload**: `{ "statement": 1, "description": 1, "limit": 50 }`

---

## 🔄 Dynamic API Schema Auto-Sync Protocol

To sync or verify updated Deriv WebSocket schemas directly from Deriv:
1. Fetch latest schema definition from `https://api.deriv.com/config/v3/config.json` or `https://developers.deriv.com`.
2. Inspect schema changes for new fields, contract types, or parameters.
3. Update `endpoints.json` located alongside this skill file.
