-- =========================================
-- PROCEDURE: deposit_cash
-- =========================================
create or replace function deposit_cash(
    p_portfolio_id uuid,
    p_amount numeric,
    p_notes text default null
)
returns void
language plpgsql
as $$
begin
    if p_amount <= 0 then
        raise exception 'Deposit amount must be greater than 0';
    end if;

    insert into cash_ledger (
        portfolio_id,
        transaction_type,
        amount,
        notes
    )
    values (
        p_portfolio_id,
        'DEPOSIT',
        p_amount,
        p_notes
    );
end;
$$;


-- =========================================
-- PROCEDURE: withdraw_cash
-- =========================================
create or replace function withdraw_cash(
    p_portfolio_id uuid,
    p_amount numeric,
    p_notes text default null
)
returns void
language plpgsql
as $$
declare
    v_cash_balance numeric;
begin
    if p_amount <= 0 then
        raise exception 'Withdraw amount must be greater than 0';
    end if;

    select coalesce(sum(
        case
            when transaction_type = 'DEPOSIT' then amount
            when transaction_type = 'SELL' then amount
            when transaction_type = 'WITHDRAW' then -amount
            when transaction_type = 'BUY' then -amount
        end
    ),0)
    into v_cash_balance
    from cash_ledger
    where portfolio_id = p_portfolio_id;

    if v_cash_balance < p_amount then
        raise exception 'Insufficient cash. Available: %, Requested: %', v_cash_balance, p_amount;
    end if;

    insert into cash_ledger (
        portfolio_id,
        transaction_type,
        amount,
        notes
    )
    values (
        p_portfolio_id,
        'WITHDRAW',
        p_amount,
        p_notes
    );
end;
$$;


-- =========================================
-- PROCEDURE: buy_stock
-- =========================================
create or replace function buy_stock(
    p_portfolio_id uuid,
    p_symbol text,
    p_quantity numeric,
    p_price numeric,
    p_fees numeric default 0,
    p_notes text default null
)
returns void
language plpgsql
as $$
declare
    v_cash_balance numeric;
    v_total_cost numeric;
    v_existing_quantity numeric;
    v_existing_avg_cost numeric;
    v_new_quantity numeric;
    v_new_avg_cost numeric;
begin
    if p_quantity <= 0 then
        raise exception 'Quantity must be greater than 0';
    end if;

    if p_price <= 0 then
        raise exception 'Price must be greater than 0';
    end if;

    if p_fees < 0 then
        raise exception 'Fees cannot be negative';
    end if;

    v_total_cost := (p_quantity * p_price) + p_fees;

    select coalesce(sum(
        case
            when transaction_type = 'DEPOSIT' then amount
            when transaction_type = 'SELL' then amount
            when transaction_type = 'WITHDRAW' then -amount
            when transaction_type = 'BUY' then -amount
        end
    ),0)
    into v_cash_balance
    from cash_ledger
    where portfolio_id = p_portfolio_id;

    if v_cash_balance < v_total_cost then
        raise exception 'Insufficient cash. Available: %, Required: %', v_cash_balance, v_total_cost;
    end if;

    insert into trades (
        portfolio_id,
        side,
        symbol,
        quantity,
        price,
        fees
    )
    values (
        p_portfolio_id,
        'BUY',
        upper(trim(p_symbol)),
        p_quantity,
        p_price,
        p_fees
    );

    insert into cash_ledger (
        portfolio_id,
        transaction_type,
        amount,
        notes
    )
    values (
        p_portfolio_id,
        'BUY',
        v_total_cost,
        coalesce(p_notes, 'Buy ' || upper(trim(p_symbol)))
    );

    select quantity, avg_cost
    into v_existing_quantity, v_existing_avg_cost
    from positions
    where portfolio_id = p_portfolio_id
      and symbol = upper(trim(p_symbol));

    if found then
        v_new_quantity := v_existing_quantity + p_quantity;

        v_new_avg_cost :=
            ((v_existing_quantity * v_existing_avg_cost) + (p_quantity * p_price) + p_fees)
            / v_new_quantity;

        update positions
        set
            quantity = v_new_quantity,
            avg_cost = v_new_avg_cost,
            updated_at = now()
        where portfolio_id = p_portfolio_id
          and symbol = upper(trim(p_symbol));
    else
        insert into positions (
            portfolio_id,
            symbol,
            quantity,
            avg_cost,
            updated_at
        )
        values (
            p_portfolio_id,
            upper(trim(p_symbol)),
            p_quantity,
            ((p_quantity * p_price) + p_fees) / p_quantity,
            now()
        );
    end if;
end;
$$;


-- =========================================
-- PROCEDURE: sell_stock
-- =========================================
create or replace function sell_stock(
    p_portfolio_id uuid,
    p_symbol text,
    p_quantity numeric,
    p_price numeric,
    p_fees numeric default 0,
    p_notes text default null
)
returns void
language plpgsql
as $$
declare
    v_existing_quantity numeric;
    v_existing_avg_cost numeric;
    v_remaining_quantity numeric;
    v_total_proceeds numeric;
begin
    if p_quantity <= 0 then
        raise exception 'Quantity must be greater than 0';
    end if;

    if p_price <= 0 then
        raise exception 'Price must be greater than 0';
    end if;

    if p_fees < 0 then
        raise exception 'Fees cannot be negative';
    end if;

    select quantity, avg_cost
    into v_existing_quantity, v_existing_avg_cost
    from positions
    where portfolio_id = p_portfolio_id
      and symbol = upper(trim(p_symbol));

    if not found then
        raise exception 'No position found for symbol %', upper(trim(p_symbol));
    end if;

    if v_existing_quantity < p_quantity then
        raise exception 'Insufficient shares. Owned: %, Trying to sell: %', v_existing_quantity, p_quantity;
    end if;

    v_total_proceeds := (p_quantity * p_price) - p_fees;

    if v_total_proceeds < 0 then
        raise exception 'Total proceeds cannot be negative';
    end if;

    insert into trades (
        portfolio_id,
        side,
        symbol,
        quantity,
        price,
        fees
    )
    values (
        p_portfolio_id,
        'SELL',
        upper(trim(p_symbol)),
        p_quantity,
        p_price,
        p_fees
    );

    insert into cash_ledger (
        portfolio_id,
        transaction_type,
        amount,
        notes
    )
    values (
        p_portfolio_id,
        'SELL',
        v_total_proceeds,
        coalesce(p_notes, 'Sell ' || upper(trim(p_symbol)))
    );

    v_remaining_quantity := v_existing_quantity - p_quantity;

    if v_remaining_quantity = 0 then
        delete from positions
        where portfolio_id = p_portfolio_id
          and symbol = upper(trim(p_symbol));
    else
        update positions
        set
            quantity = v_remaining_quantity,
            updated_at = now()
        where portfolio_id = p_portfolio_id
          and symbol = upper(trim(p_symbol));
    end if;
end;
$$;