-- Row Level Security policies for Sahl
-- Run this in the Supabase SQL Editor to allow the app to access the database

-- portfolios: allow read and create (no auth, so anon can access)
alter table portfolios enable row level security;

create policy "Allow anon to select portfolios"
  on portfolios for select
  to anon
  using (true);

create policy "Allow anon to insert portfolios"
  on portfolios for insert
  to anon
  with check (true);

-- cash_ledger: allow read and insert
alter table cash_ledger enable row level security;

create policy "Allow anon to select cash_ledger"
  on cash_ledger for select
  to anon
  using (true);

create policy "Allow anon to insert cash_ledger"
  on cash_ledger for insert
  to anon
  with check (true);

-- trades: allow read and insert
alter table trades enable row level security;

create policy "Allow anon to select trades"
  on trades for select
  to anon
  using (true);

create policy "Allow anon to insert trades"
  on trades for insert
  to anon
  with check (true);

-- positions: allow read, insert, update, delete (RPCs update/insert/delete)
alter table positions enable row level security;

create policy "Allow anon to select positions"
  on positions for select
  to anon
  using (true);

create policy "Allow anon to insert positions"
  on positions for insert
  to anon
  with check (true);

create policy "Allow anon to update positions"
  on positions for update
  to anon
  using (true)
  with check (true);

create policy "Allow anon to delete positions"
  on positions for delete
  to anon
  using (true);
