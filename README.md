# Sahl — Portfolio Analysis

**Sahl** is a stock analysis tool that helps users analyze their holdings and generate insights about their portfolio. Enter your email, build or import a portfolio, and request an analysis report delivered to your inbox.

**Live app:** [https://sahl-stock-analyzer.vercel.app/](https://sahl-stock-analyzer.vercel.app/)

---

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/MuddassirKhalidi/sahl-stock-analyzer.git
cd sahl-stock-analyzer
npm install
```

### 2. Environment variables (`.env`)

Create a `.env` file in the project root with:

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous (public) API key |
| `VITE_N8N_WEBHOOK_URL` | Your n8n workflow webhook URL (POST) |

#### Getting Supabase values

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) and open your project.
2. Go to **Project Settings** → **API**.
3. Copy **Project URL** → use as `VITE_SUPABASE_URL`.
4. Under **Project API keys**, copy the **anon** **public** key → use as `VITE_SUPABASE_ANON_KEY`.

#### Getting the n8n webhook URL

1. Set up the n8n workflow (see [n8n workflow setup](#n8n-workflow-setup) below).
2. In the workflow, open the **Webhook** node.
3. Copy the **Production Webhook URL** (or Test URL when testing).
4. Use that URL as `VITE_N8N_WEBHOOK_URL` in `.env`.

### 3. Run the app

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### 4. Database (Supabase)

Deploy the schema and RLS if you haven’t already:

- Schema: run the SQL in `src/supabase/sql/schema.sql`, then `functions.sql`, then `views.sql`.
- RLS: run `src/supabase/sql/rls.sql` in the Supabase SQL Editor so the app can access the database.

---

## n8n workflow setup

The “Send Analysis Report” action triggers an n8n workflow that generates a report and emails it. Set it up as follows.

### 1. Import the workflow

1. Open your n8n instance.
2. Go to **Workflows** → **Import from File** (or use the import option in the UI).
3. Select the file: **`n8n_workflows/stock_analyzer_workflow_n8n.json`** from this repo.
4. The workflow will appear with a Webhook trigger, AI/LLM nodes, and a Gmail “Send a message” node.

### 2. Configure credentials in n8n

You need to create and attach credentials for:

#### OpenAI API key

- In n8n, go to **Settings** → **Credentials** (or add from the node).
- Create a credential of type **OpenAI API**.
- Set **API Key** to your [OpenAI API key](https://platform.openai.com/api-keys).
- In the workflow, open any node that uses OpenAI and select this credential.

#### OpenRouter API key

- Create a credential for **OpenRouter** (or the HTTP/node type your workflow uses for OpenRouter).
- Set the API key from [OpenRouter](https://openrouter.ai/keys).
- Attach this credential to the node(s) that call OpenRouter.

#### Gmail

- In n8n, add a **Gmail** credential (e.g. **Gmail OAuth2**).
- Follow the OAuth flow to connect your Google account (the one that will send the report emails).
- In the workflow, open the **“Send a message”** (Gmail) node and select this Gmail credential.

### 3. Webhook URL

- In the imported workflow, open the **Webhook** node.
- Note the **Path** (e.g. `sahl-analyze-stocks`).
- Copy the full **Production Webhook URL** (e.g. `https://your-n8n.com/webhook/sahl-analyze-stocks`).
- Put this URL in your app’s `.env` as `VITE_N8N_WEBHOOK_URL`.

### 4. Activate the workflow

Save the workflow and set it to **Publish** so it can receive webhook requests.

---

## Project structure

- **Database:** `src/supabase/sql/` — schema, functions, views, RLS.
- **Types:** `src/types/supabase.ts` — generated Supabase types.
- **n8n:** `n8n_workflows/stock_analyzer_workflow_n8n.json` — workflow definition to import.

---

## Deployment (Vercel)

1. Connect the repo to Vercel.
2. In the project settings, add the same environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_N8N_WEBHOOK_URL` (use the production webhook URL).
3. Deploy. The app is available at [https://sahl-stock-analyzer.vercel.app/](https://sahl-stock-analyzer.vercel.app/).
