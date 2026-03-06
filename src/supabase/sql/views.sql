create view portfolio_summary as
select
    p.id as portfolio_id,
    p.email,

    coalesce(sum(
        case
            when cl.transaction_type = 'DEPOSIT' then cl.amount
            when cl.transaction_type = 'SELL' then cl.amount
            when cl.transaction_type = 'WITHDRAW' then -cl.amount
            when cl.transaction_type = 'BUY' then -cl.amount
        end
    ),0) as net_cash

from portfolios p
left join cash_ledger cl
on cl.portfolio_id = p.id

group by p.id,p.email;

create view transaction_history as
select
    cl.portfolio_id,
    cl.transaction_type,
    cl.amount,
    cl.notes,
    cl.created_at
from cash_ledger cl
order by cl.created_at desc;