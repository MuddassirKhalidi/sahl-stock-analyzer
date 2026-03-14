# Sahl Stock Analyzer - Complete User Flow & Technical Context

## Project Overview

- **Type:** React + TypeScript + Vite portfolio analysis web app
- **Backend:** Supabase (PostgreSQL) for data storage
- **Automation:** n8n workflow for generating and emailing stock analysis reports
- **Live App:** https://sahl-stock-analyzer.vercel.app/

---

## Complete User Flow

### Step 1: User Lands on Homepage

```
URL: http://localhost:5173/
Action: Enter email → Click "Enter Sahl"
Result: Creates/fetches portfolio in Supabase, navigates to Dashboard
```

**File:** `src/pages/LandingPage.tsx`

**What Happens:**
1. User enters their email address
2. App queries Supabase `portfolios` table for existing portfolio with that email
3. If exists: reuses existing portfolio ID
4. If new: creates new portfolio record
5. Navigates to `/dashboard` with portfolio ID in state

---

### Step 2: Dashboard Loads

```
URL: http://localhost:5173/dashboard
Action: Fetches portfolio data from Supabase
Display: Shows portfolio cards, holdings table, action buttons
```

**File:** `src/pages/Dashboard.tsx`

**Data Fetched:**
- `portfolio_summary` view → net cash balance
- `positions` table → current holdings
- `transaction_history` view → past transactions

---

### Step 3 (Optional): Import Sample Portfolio

```
Action: Click "Import Sample Portfolio"
Result: Portfolio populated with sample holdings
```

**What Happens:**
1. Calls Supabase RPC function `deposit_cash()` → adds initial cash
2. Calls `buy_stock()` for each sample holding (e.g., AAPL, MSFT, GOOGL)
3. Updates `cash_ledger`, `trades`, and `positions` tables
4. Refreshes dashboard to show new holdings

---

### Step 4: Trigger Analysis Report (THE KEY STEP)

```
Action: Click "Send Analysis Report" button
Frontend Code: handleSendAnalysisReport() in Dashboard.tsx:316
```

**Request Sent to n8n:**

```json
POST {VITE_N8N_WEBHOOK_URL}
Content-Type: application/json

{
  "portfolioId": "uuid-here",
  "email": "user@example.com",
  "date": "2025-03-14",
  "netCash": 50000,
  "totalMarketValue": 100000,
  "netAssets": 150000,
  "holdings": [
    {
      "symbol": "AAPL",
      "quantity": 50,
      "averageCost": 175.50,
      "marketValue": 8775.00
    },
    {
      "symbol": "MSFT",
      "quantity": 30,
      "averageCost": 380.00,
      "marketValue": 11400.00
    }
  ]
}
```

**Webhook Configuration:**
- **URL:** Value of `VITE_N8N_WEBHOOK_URL` in `.env`
- **Method:** POST
- **n8n Path:** `sahl-analyze-stocks`

---

### Step 5: n8n Workflow Executes

```
Entry Point: Webhook node (path: sahl-analyze-stocks)
Execution: AI agents run in parallel/series
```

**AI Agents in Workflow:**

| # | Agent | Model | Purpose |
|---|-------|-------|---------|
| 1 | Market Regime Detection | perplexity/sonar | Classify current market (inflation, growth, etc.) |
| 2 | Top-Down Macro Analysis | perplexity/sonar | Find historical comparisons, sector outlook |
| 3 | Portfolio Hedging Strategy | perplexity/sonar | Recommend hedges (options, inverse ETFs) |
| 4 | Short Squeeze Screener | perplexity/sonar | Find short squeeze candidates |
| 5 | Sector/Market Extraction | gpt-4o-mini | Classify holdings by sector/market |
| 6 | M&A Analysis | perplexity/sonar | Recent merger/acquisition activity |
| 7 | Sentiment Analysis | perplexity/sonar | Market sentiment indicators |
| 8 | Dividend Risk Analysis | perplexity/sonar | Dividend safety for holdings |
| 9 | Institutional Positioning | perplexity/sonar | Smart money positioning |

**Why Perplexity/Sonar?**
- Built-in web search for real-time data
- Cites sources (FRED, Federal Reserve, IMF, etc.)
- Specialized in financial/economic data
- Returns data from last 30 days

**Each Agent Returns:**
- Structured JSON output
- Source citations
- Current market data

---

### Step 6: Email Report Generated & Sent

```
Node: Gmail "Send a message"
Recipient: User's email from Step 1
```

**Email Content (HTML):**
- Market Outlook
- Confidence Score (0-1)
- Hedge Summary
- Macro Risks (bulleted list)
- Portfolio Adjustments (recommendations)
- Top Trade Ideas:
  - Ticker
  - Thesis
  - Signal Alignment
  - Risk Level
- Notes

**Sent From:** Gmail account configured in n8n credentials

---

### Step 7: Response to Frontend

```
n8n Node: "Respond to Webhook"
```

**Response:**

```json
{
  "success": true,
  "message": "Analysis report sent to your email."
}
```

**Frontend Behavior:**
- Shows loading states during processing (~30-60 seconds)
- Displays success/error message after response
- Clears loading state

---

### End Result

```
User receives HTML email with portfolio analysis
Delivery Time: ~30-60 seconds after clicking button
Check: User's Gmail inbox (including spam folder)
```

---

## Quick Test Flow

1. **Start app:** `npm run dev` → open http://localhost:5173
2. **Enter email:** `test@example.com` → Click "Enter Sahl"
3. **Import sample:** Click "Import Sample Portfolio"
4. **Send report:** Click "Send Analysis Report"
5. **Wait:** ~30-60 seconds
6. **Check email:** Look for "Sahl Stock Analysis Report" in inbox

---

## Files Involved

| File | Purpose |
|------|---------|
| `src/pages/LandingPage.tsx` | Email input, portfolio creation |
| `src/pages/Dashboard.tsx` | Display portfolio, trigger webhook (line 316) |
| `.env` | `VITE_N8N_WEBHOOK_URL` |
| `n8n_workflows/stock_analyzer_workflow_n8n.json` | Full workflow definition |
| `src/supabase/sql/schema.sql` | Database tables |
| `src/supabase/sql/functions.sql` | RPC functions (deposit, buy, sell) |
| `src/supabase/sql/views.sql` | Summary views |
| `src/supabase/sql/rls.sql` | Row Level Security policies |

---

## Database Schema

### Tables

**portfolios**
- `id` (uuid, primary key)
- `email` (text)
- `name` (text, default: "Main Portfolio")
- `created_at` (timestamptz)

**cash_ledger**
- `id` (uuid)
- `portfolio_id` (uuid → portfolios.id)
- `transaction_type` (DEPOSIT, WITHDRAW, BUY, SELL)
- `amount` (numeric)
- `notes` (text)
- `created_at` (timestamptz)

**trades**
- `id` (uuid)
- `portfolio_id` (uuid → portfolios.id)
- `side` (BUY, SELL)
- `symbol` (text)
- `quantity` (numeric)
- `price` (numeric)
- `fees` (numeric)
- `executed_at` (timestamptz)

**positions**
- `id` (uuid)
- `portfolio_id` (uuid → portfolios.id)
- `symbol` (text)
- `quantity` (numeric)
- `avg_cost` (numeric)
- `updated_at` (timestamptz)

### Views

**portfolio_summary**
- Aggregates net cash from cash_ledger

**transaction_history**
- Lists all transactions ordered by date

### Functions

- `deposit_cash(portfolio_id, amount, notes)`
- `withdraw_cash(portfolio_id, amount, notes)`
- `buy_stock(portfolio_id, symbol, quantity, price, fees, notes)`
- `sell_stock(portfolio_id, symbol, quantity, price, fees, notes)`

---

## n8n Workflow Details

### Credentials Required

| Credential | Purpose | Provider |
|------------|---------|----------|
| OpenRouter API | AI/LLM calls (Perplexity Sonar) | openrouter.ai |
| OpenAI API | Sector/market classification | platform.openai.com |
| Gmail OAuth2 | Sending email reports | Google Cloud Console |

### Webhook Configuration

- **Path:** `sahl-analyze-stocks`
- **Method:** POST
- **Full URL:** `https://your-n8n-instance.com/webhook/sahl-analyze-stocks`
- **Response Mode:** Response Node (custom JSON response)

### Model Usage

**Perplexity/Sonar (5 nodes):**
- Requires web search for current data
- Financial/economic data specialization
- Source citations required

**GPT-4o-mini (1 node):**
- Sector/market classification
- No web search needed
- Structured JSON output

---

## Environment Variables

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# n8n Webhook URL
VITE_N8N_WEBHOOK_URL=https://your-n8n.com/webhook/sahl-analyze-stocks
```

---

## Common Issues & Solutions

### Issue: "Webhook URL not configured"
**Solution:** Add `VITE_N8N_WEBHOOK_URL` to `.env` and restart dev server

### Issue: "Insufficient cash" when importing sample
**Solution:** Ensure `deposit_cash()` is called before `buy_stock()`

### Issue: No email received
**Solution:**
1. Check n8n workflow execution logs
2. Verify Gmail credentials in n8n
3. Check spam folder
4. Ensure workflow is activated in n8n

### Issue: n8n workflow fails on Perplexity nodes
**Solution:**
1. Check OpenRouter API key has credits
2. Verify model name is correct (`perplexity/sonar`)
3. Check rate limits on OpenRouter

---

## Architecture Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Supabase   │◀────│   Database   │
│  (React/Vite)│     │   (Backend)  │     │  (PostgreSQL)│
└──────────────┘     └──────────────┘     └──────────────┘
       │
       │ POST /webhook
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│     n8n      │────▶│  AI Models   │────▶│    Gmail     │
│  (Workflow)  │     │ (OpenRouter) │     │    (SMTP)    │
└──────────────┘     └──────────────┘     └──────────────┘
```

---

## Contributing Notes

- **Branch Strategy:** `main` (production) ← `staging` ← `feature/*`
- **Pull Requests:** Target `staging` branch
- **Testing:** Run `npm run dev` and test full flow before PR

---

**Document Created:** 2025-03-14
**Last Updated:** 2025-03-14
