This project uses Supabase.

## Setup

1. Copy `.env.example` to `.env`
2. Add your Supabase URL and anon key from [Project Settings → API](https://supabase.com/dashboard/project/_/settings/api)
3. Run `npm run dev`

**Row Level Security:** After deploying the schema, run `src/supabase/sql/rls.sql` in the Supabase SQL Editor to allow the app to access the database.

Database schema is defined in:
- supabase/sql/schema.sql
- supabase/sql/functions.sql
- supabase/sql/views.sql

Do not invent tables or columns.
Use only:
- portfolios
- cash_ledger
- trades
- positions

Available SQL functions:
- deposit_cash
- withdraw_cash
- buy_stock
- sell_stock

When generating React or API code, rely on src/types/supabase.ts for exact types.