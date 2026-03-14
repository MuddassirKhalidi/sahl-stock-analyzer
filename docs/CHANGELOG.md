# Changelog

All fixes, improvements, and changes made to this project.

---

## [Unreleased]

### Fixed

#### Sample Portfolio Import - Removed Hardcoded Non-Existent Portfolio ID

**Issue:**  
The "Import Sample Portfolio" button failed with error:
```
Failed to import sample
Failed to load resource: the server responded with a status of 406
```

**Root Cause:**  
`src/pages/Dashboard.tsx` referenced a hardcoded portfolio ID (`9f8e7d66-1c2f-4c8c-8a7a-2e6a1b0d1111`) that did not exist in the Supabase database. The `handleImportSample` function tried to query this non-existent portfolio to copy its data.

**File:** `src/pages/Dashboard.tsx`

**Before:**
```typescript
const SAMPLE_PORTFOLIO_ID = "9f8e7d66-1c2f-4c8c-8a7a-2e6a1b0d1111"

const handleImportSample = async () => {
  if (!portfolioId) return
  try {
    setError(null)
    const [summaryRes, positionsRes] = await Promise.all([
      supabase
        .from("portfolio_summary")
        .select("*")
        .eq("portfolio_id", SAMPLE_PORTFOLIO_ID)
        .single(),
      supabase
        .from("positions")
        .select("*")
        .eq("portfolio_id", SAMPLE_PORTFOLIO_ID),
    ])
    // ... copy data from template portfolio
  }
}
```

**After:**
```typescript
const handleImportSample = async () => {
  if (!portfolioId) return
  try {
    setError(null)
    
    // Sample portfolio: $100,000 initial cash
    const { error: depositErr } = await supabase.rpc("deposit_cash", {
      p_portfolio_id: portfolioId,
      p_amount: 100000,
      p_notes: "Sample portfolio import",
    })
    if (depositErr) throw depositErr

    // Sample holdings (symbol, quantity, price)
    const sampleHoldings = [
      { symbol: "AAPL", quantity: 50, price: 175.50 },
      { symbol: "MSFT", quantity: 30, price: 380.00 },
      { symbol: "GOOGL", quantity: 20, price: 140.25 },
      { symbol: "NVDA", quantity: 15, price: 485.00 },
      { symbol: "AMZN", quantity: 25, price: 178.50 },
    ]

    for (const { symbol, quantity, price } of sampleHoldings) {
      const { error: buyErr } = await supabase.rpc("buy_stock", {
        p_portfolio_id: portfolioId,
        p_symbol: symbol,
        p_quantity: quantity,
        p_price: price,
        p_fees: 0,
        p_notes: `Sample ${symbol} position`,
      })
      if (buyErr) throw buyErr
    }

    await fetchData()
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to import sample")
  }
}
```

**Impact:**
- Sample portfolio import now works without requiring a template portfolio in the database
- Creates a self-contained sample portfolio with:
  - $100,000 initial cash deposit
  - 5 tech stock positions (AAPL, MSFT, GOOGL, NVDA, AMZN)
- More transparent and maintainable code

**Date:** 2026-03-14

---

#### Analysis Report Error Handling - Fixed False Success Messages

**Issue:**  
When the n8n workflow failed, the frontend still displayed a green success message: "Analysis report sent." This was misleading because the workflow actually failed internally.

**Root Cause:**  
n8n webhooks return HTTP `200 OK` from the webhook endpoint even when the workflow execution fails internally. The frontend code only checked `res.ok` (HTTP status), not the actual workflow execution result.

**File:** `src/pages/Dashboard.tsx`

**Before:**
```typescript
const message = body?.message ?? (res.ok ? "Analysis report sent." : `Request failed: ${res.status}`)
const type = body?.success !== undefined 
  ? (body.success ? "success" : "error") 
  : (res.ok ? "success" : "error")

setReportMessage({ type, text: message })
```

**After:**
```typescript
// Check for explicit failure in response body (n8n may return 200 even on workflow failure)
const hasExplicitError = body?.success === false || body?.error !== undefined

if (!res.ok || hasExplicitError) {
  // Request failed or workflow explicitly reported failure
  const errorMessage = body?.message || body?.error || `Request failed: ${res.status}`
  setReportMessage({ type: "error", text: errorMessage })
} else if (body?.success === true || body?.message?.includes("sent")) {
  // Explicit success or message indicates success
  setReportMessage({ type: "success", text: body.message || "Analysis report sent." })
} else {
  // Ambiguous response - treat as error
  setReportMessage({ 
    type: "error", 
    text: "Failed to send analysis report. Please try again." 
  })
}
```

**Impact:**
- Users now see accurate error messages when workflow fails
- Red success message only appears on confirmed success
- Ambiguous responses are treated as errors (safer UX)
- Better error messages guide users to retry

**Date:** 2026-03-14

---

### Added

#### Table Export Functions - Copy and Download CSV Buttons

**Feature:**  
Added "Copy" and "Download CSV" buttons to both the Holdings and Transaction History tables for easy data export.

**Files Modified:**
- `src/pages/Dashboard.tsx`

**Implementation Details:**

1. **New Icons Imported:**
   - Added `Download`, `Copy`, `Check` from `lucide-react`

2. **New State Variable:**
   ```typescript
   const [copiedTable, setCopiedTable] = useState<"holdings" | "transactions" | null>(null)
   ```

3. **New Utility Functions:**
   - `copyHoldingsToClipboard()` - Copies holdings as tab-separated text
   - `downloadHoldingsAsCSV()` - Downloads holdings as CSV file
   - `copyTransactionsToClipboard()` - Copies transactions as tab-separated text
   - `downloadTransactionsAsCSV()` - Downloads transactions as CSV file

4. **UI Changes:**
   - Added `CardHeader` with flex layout to both table cards
   - Added two buttons per table:
     - **Copy Button**: Shows "Copied!" with checkmark icon for 2 seconds after clicking
     - **CSV Button**: Downloads file with date-stamped filename

**Holdings Table Export Format:**

Copy (tab-separated for pasting into spreadsheets):
```
Symbol	Quantity	Average Cost	Market Value
AAPL	50	175.50	8775.00
MSFT	30	380.00	11400.00
```

CSV Download:
```csv
Symbol,Quantity,Average Cost,Market Value
AAPL,50,175.50,8775.00
MSFT,30,380.00,11400.00
```

**Transaction History Export Format:**

Copy (tab-separated):
```
Time	Type	Symbol	Quantity	Amount	Notes
2026-03-14 10:30	BUY	AAPL	50	8775.00	Sample AAPL position
```

CSV Download:
```csv
Time,Type,Symbol,Quantity,Amount,Notes
2026-03-14 10:30,BUY,AAPL,50,8775.00,Sample AAPL position
```

**File Naming:**
- Holdings: `holdings_YYYY-MM-DD.csv`
- Transactions: `transactions_YYYY-MM-DD.csv`

**User Experience:**
- Copy button shows visual feedback ("Copied!" with checkmark) for 2 seconds
- CSV files download immediately with descriptive filenames
- Buttons styled consistently with existing UI (purple theme)
- Buttons only appear when table has data

**Date:** 2026-03-14

---

#### n8n Workflow Fix - Gmail Node Top Trade Ideas Data Path

**Issue:**  
The "Top Trade Ideas" section in the Gmail email template always displayed "No strong trade ideas supported by the current signal set." even when trade ideas were successfully generated by the AI agents.

**Root Cause:**  
Wrong data path in the `.map()` call inside the Gmail node's Top Trade Ideas section. The conditional check (`.length`) used the correct full path, but the `.map()` function used a shortened path that didn't match, causing it to access `undefined` and fall through to the fallback message.

**File:** `n8n_workflows/stock_analyzer_workflow_n8n.json` (Gmail node - "Send a message")

**Before (Broken):**
```javascript
{{
  $json.output[0].content[0].text.top_trade_ideas.length
    ? $json.top_trade_ideas.map(idea => `
        <div style="border:1px solid #4A3B68; border-radius:14px; padding:18px; margin-bottom:14px; background-color:#2D1D47;">
          <div style="font-size:17px; font-weight:700; color:#F7F6FB; margin-bottom:8px;">
            ${idea.ticker}
          </div>
          ...
        </div>
      `).join('')
    : `<div style="color:#B8AFD6; font-size:15px;">No strong trade ideas...</div>`
}}
```

**After (Fixed):**
```javascript
{{
  $json.output[0].content[0].text.top_trade_ideas.length
    ? $json.output[0].content[0].text.top_trade_ideas.map(idea => `
        <div style="border:1px solid #4A3B68; border-radius:14px; padding:18px; margin-bottom:14px; background-color:#2D1D47;">
          <div style="font-size:17px; font-weight:700; color:#F7F6FB; margin-bottom:8px;">
            ${idea.ticker}
          </div>
          ...
        </div>
      `).join('')
    : `<div style="color:#B8AFD6; font-size:15px;">No strong trade ideas...</div>`
}}
```

**Impact:**
- Top Trade Ideas now correctly display in the email report
- Email template data paths are now consistent throughout
- Users receive actionable trade ideas instead of empty fallback message

**Date:** 2026-03-14

---

### Added

#### Environment Configuration Files

**Files Created:**
- `.env` - Local environment variables (user-specific, gitignored)
- `.env.example` - Template for contributors with placeholder values (committed to repo)

**Content (`.env.example`):**
```env
# Supabase Configuration
# Get these from: https://supabase.com/dashboard > Project Settings > API
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_public_key

# n8n Webhook URL
# Get this from your n8n instance > Workflow > Webhook node > Production Webhook URL
VITE_N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/sahl-analyze-stocks
```

**Purpose:**
- `.env` - Stores actual API keys and URLs (never committed)
- `.env.example` - Documents required environment variables for contributors
- Helps new developers set up the project quickly

**Date:** 2026-03-14

---

#### Documentation Folder Structure

**Directory Created:** `docs/`

**Files Created:**

1. **`docs/USER_FLOW.md`** - Complete user flow and technical documentation
   - Step-by-step user journey from landing page to email report
   - n8n workflow architecture and AI agent details
   - Database schema reference (tables, views, functions, RLS policies)
   - Troubleshooting guide for common issues
   - Architecture diagram
   - Environment variables reference
   - n8n workflow credentials setup guide

2. **`docs/CHANGELOG.md`** - Centralized changelog (this file)
   - Tracks all fixes, improvements, and changes
   - Includes before/after code comparisons
   - Documents known issues and setup checklist

**Purpose:**
- Centralizes technical documentation
- Helps contributors understand the codebase
- Provides setup guide for new developers
- Documents project history and decisions

**Directory Structure:**
```
docs/
├── USER_FLOW.md      # Technical documentation and user flows
└── CHANGELOG.md      # Version history and changes
```

**Date:** 2026-03-14

---

## Known Issues (Not Yet Fixed)

### n8n Workflow - Perplexity/Sonar Model Requires Paid Credits

**Issue:**  
The n8n workflow uses `perplexity/sonar` model via OpenRouter for web search capabilities. This requires paid credits.

**Impact:**  
Users without OpenRouter credits cannot generate analysis reports.

**Potential Solutions:**
1. Use free OpenRouter models (limited web search capability)
2. Use Ollama for local model inference (no web search)
3. Use Google Gemini free tier API
4. Hybrid approach: Free APIs (FRED, Yahoo Finance) + free LLM

**Status:** Under investigation

---

## Setup Checklist for New Contributors

### Prerequisites
- [ ] Node.js 18+ installed
- [ ] Supabase account and project created
- [ ] n8n instance accessible (self-hosted or cloud)
- [ ] OpenRouter API key (for AI models)
- [ ] OpenAI API key (for GPT-4o-mini)
- [ ] Gmail OAuth2 credentials (for sending emails)

### Database Setup
- [ ] Run `src/supabase/sql/schema.sql` in Supabase SQL Editor
- [ ] Run `src/supabase/sql/views.sql`
- [ ] Run `src/supabase/sql/functions.sql`
- [ ] Run `src/supabase/sql/rls.sql`

### Environment Configuration
- [ ] Copy `.env.example` to `.env`
- [ ] Add `VITE_SUPABASE_URL`
- [ ] Add `VITE_SUPABASE_ANON_KEY`
- [ ] Add `VITE_N8N_WEBHOOK_URL`

### n8n Workflow Setup
- [ ] Import `n8n_workflows/stock_analyzer_workflow_n8n.json`
- [ ] Configure OpenRouter credentials
- [ ] Configure OpenAI credentials
- [ ] Configure Gmail OAuth2
- [ ] Activate workflow

### Testing
- [ ] Run `npm install`
- [ ] Run `npm run dev`
- [ ] Enter email on landing page
- [ ] Click "Import Sample Portfolio"
- [ ] Verify holdings appear in dashboard
- [ ] Click "Send Analysis Report"
- [ ] Check email inbox for report

---

## Project Structure Reference

```
sahl-stock-analyzer/
├── .env                          # Local environment variables (gitignored)
├── .env.example                  # Template for contributors
├── package.json                  # Node.js dependencies
├── vite.config.ts                # Vite configuration
├── tsconfig.json                 # TypeScript configuration
├── n8n_workflows/
│   └── stock_analyzer_workflow_n8n.json  # n8n workflow definition
├── src/
│   ├── pages/
│   │   ├── LandingPage.tsx       # Email input, portfolio creation
│   │   └── Dashboard.tsx         # Main dashboard, portfolio actions
│   ├── supabase/
│   │   ├── sql/
│   │   │   ├── schema.sql        # Database tables
│   │   │   ├── views.sql         # Database views
│   │   │   ├── functions.sql     # Stored procedures
│   │   │   └── rls.sql           # Row Level Security policies
│   │   └── docs/
│   │       └── database-overview.md
│   └── types/
│       └── supabase.ts           # Generated Supabase types
└── docs/
    ├── USER_FLOW.md              # Complete user flow documentation
    └── CHANGELOG.md              # This file
```

---

**Last Updated:** 2026-03-14
