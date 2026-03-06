# Database Overview

## Tables

### portfolios
- id: uuid, primary key
- email: text
- name: text
- created_at: timestamptz

### cash_ledger
- id: uuid
- portfolio_id: uuid -> portfolios.id
- transaction_type: DEPOSIT | WITHDRAW | BUY | SELL
- amount: numeric
- notes: text
- created_at: timestamptz

### trades
- id: uuid
- portfolio_id: uuid -> portfolios.id
- side: BUY | SELL
- symbol: text
- quantity: numeric
- price: numeric
- fees: numeric
- executed_at: timestamptz

### positions
- id: uuid
- portfolio_id: uuid -> portfolios.id
- symbol: text
- quantity: numeric
- avg_cost: numeric
- updated_at: timestamptz

## Functions

### deposit_cash(portfolio_id, amount, notes)
Adds a DEPOSIT row to cash_ledger.

### withdraw_cash(portfolio_id, amount, notes)
Checks available cash, then adds a WITHDRAW row.

### buy_stock(portfolio_id, symbol, quantity, price, fees, notes)
- checks cash balance
- inserts into trades
- inserts BUY row into cash_ledger
- updates positions

### sell_stock(portfolio_id, symbol, quantity, price, fees, notes)
- checks owned shares
- inserts into trades
- inserts SELL row into cash_ledger
- updates/deletes positions