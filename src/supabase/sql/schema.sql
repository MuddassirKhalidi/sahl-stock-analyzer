create extension if not exists pgcrypto;

create table portfolios (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    name text default 'Main Portfolio',
    created_at timestamptz default now()
);

create index idx_portfolios_email
on portfolios(email);

create table cash_ledger (
    id uuid primary key default gen_random_uuid(),
    portfolio_id uuid references portfolios(id) on delete cascade,

    transaction_type text not null check (
        transaction_type in ('DEPOSIT','WITHDRAW','BUY','SELL')
    ),

    amount numeric(14,2) not null,
    notes text,

    created_at timestamptz default now()
);

create index idx_cash_portfolio
on cash_ledger(portfolio_id);

create table trades (
    id uuid primary key default gen_random_uuid(),
    portfolio_id uuid references portfolios(id) on delete cascade,

    side text not null check (
        side in ('BUY','SELL')
    ),

    symbol text not null,
    quantity numeric(14,4) not null,
    price numeric(14,2) not null,
    fees numeric(14,2) default 0,

    executed_at timestamptz default now()
);

create index idx_trades_portfolio
on trades(portfolio_id);

create index idx_trades_symbol
on trades(symbol);

create table positions (
    id uuid primary key default gen_random_uuid(),
    portfolio_id uuid references portfolios(id) on delete cascade,

    symbol text not null,
    quantity numeric(14,4) default 0,
    avg_cost numeric(14,2) default 0,

    updated_at timestamptz default now(),

    unique(portfolio_id, symbol)
);

create index idx_positions_portfolio
on positions(portfolio_id);