<div align="center">
  <h1>🔍 Gluk</h1>
  <p><strong>A full-stack AI research agent — chat, search, read documents, and get cited answers.</strong></p>
  <p>
    <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" />
    <img src="https://img.shields.io/badge/Mastra-1.3-blueviolet" alt="Mastra" />
    <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" />
  </p>
</div>

---

## What is Gluk?

Gluk is an AI-powered research assistant you can chat with. Unlike a standard chatbot, Gluk can:

- 🔎 **Search the web** in real time and cite its sources
- 📄 **Read your files** — upload a PDF, CSV, Word doc, or text file and ask questions about it
- 🧠 **Run deep research** — automatically breaks complex questions into sub-queries, fetches full pages, ranks sources by credibility, and synthesises a structured answer with inline citations
- 💬 **Remember your conversation** — persistent multi-turn memory across sessions
- 🔒 **Secure by default** — Google & GitHub login via NextAuth

---

## ✨ Features

| Feature | Description |
|---|---|
| **Multi-step research pipeline** | Plan → Search → Deep-read → Rerank → Synthesise |
| **RAG (document Q&A)** | Upload files; Gluk stores them in Pinecone and answers from them |
| **Live web search** | Tavily API with advanced depth, 8 results, published dates |
| **Source ranking** | TF-IDF relevance + domain credibility scoring |
| **Hybrid vector search** | 70% vector similarity + 30% keyword overlap, MMR deduplication |
| **Streaming responses** | Token-by-token streaming, no page reload |
| **Conversation history** | Stored in Turso (LibSQL), synced per user |
| **Image attachments** | Upload images via Cloudinary, passed to the agent |
| **Auth** | Google and GitHub OAuth via NextAuth |

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org) (App Router, Turbopack) |
| **AI orchestration** | [Mastra](https://mastra.ai) + `@mastra/core` |
| **LLM** | [OpenRouter](https://openrouter.ai) — `deepseek/deepseek-chat` by default (configurable via `OPENROUTER_MODEL`) |
| **Embeddings** | HuggingFace `sentence-transformers/all-MiniLM-L6-v2` |
| **Vector DB** | [Pinecone](https://pinecone.io) |
| **Database** | [Turso](https://turso.tech) (LibSQL) — conversations + research sessions |
| **File storage** | [Cloudinary](https://cloudinary.com) |
| **Auth** | [NextAuth v4](https://next-auth.js.org) — Google + GitHub |
| **Server-state cache** | TanStack Query — conversations and user resources |
| **Workspace real-time chat** | Supabase Realtime Broadcast and Presence; Turso-backed messages and unread cursors |
| **UI** | React 19, Tailwind CSS v4, shadcn/ui, Lucide icons |
| **Language** | TypeScript 5 |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 22.13+
- A Supabase project with Realtime enabled for workspace chat
- Accounts (all have free tiers): [OpenRouter](https://openrouter.ai), [Pinecone](https://pinecone.io), [Turso](https://turso.tech), [Cloudinary](https://cloudinary.com), [Tavily](https://tavily.com)
- Google and/or GitHub OAuth app credentials

### 1. Clone the repo

```bash
git clone https://github.com/daviddozie/gluk.git
cd gluk
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy the example file and fill in your keys:

```bash
cp .env.example .env.local
```

| Variable | Where to get it |
|---|---|
| `OPENROUTER_API_KEY` | [openrouter.ai/keys](https://openrouter.ai/keys) |
| `TAVILY_API_KEY` | [tavily.com](https://tavily.com) |
| `PINECONE_API_KEY` | [app.pinecone.io](https://app.pinecone.io) |
| `PINECONE_INDEX` | Your index name in Pinecone (e.g. `gluk`) |
| `PINECONE_HOST` | Your index host URL from the Pinecone dashboard |
| `TURSO_DATABASE_URL` | `libsql://your-db.turso.io` |
| `TURSO_AUTH_TOKEN` | From your Turso dashboard |
| `CLOUDINARY_CLOUD_NAME` | [cloudinary.com/console](https://cloudinary.com/console) |
| `CLOUDINARY_API_KEY` | Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | Cloudinary dashboard |
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` (dev) or your production URL |
| `GOOGLE_CLIENT_ID` | [console.cloud.google.com](https://console.cloud.google.com) |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console |
| `GITHUB_CLIENT_ID` | [github.com/settings/developers](https://github.com/settings/developers) |
| `GITHUB_CLIENT_SECRET` | GitHub Developer Settings |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable API key; safe for browser use |
| `SUPABASE_SECRET_KEY` | Supabase secret API key; server only |
| `SUPABASE_REALTIME_JWT_KID` | `kid` of the ES256 signing key registered under Supabase Auth → JWT Signing Keys |
| `SUPABASE_REALTIME_JWT_PRIVATE_JWK` | Private ES256 JWK used by Next.js to issue five-minute workspace-scoped tokens; server only |

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Workspace chat uses Supabase Realtime and does not need a separate socket process or Redis. Set the Supabase variables in `.env.local`. Get the URL and publishable/secret API keys from the Supabase project dashboard. Generate an ES256 signing key with `supabase gen signing-key --algorithm ES256`, register the matching public JWK in Supabase Auth → JWT Signing Keys, activate it, then configure the key `kid` and private JWK on the server. Keep the secret API key and private JWK out of browser variables and source control. Apply `supabase/migrations/20260929000000_workspace_realtime.sql` in the Supabase SQL Editor; it authorizes private workspace message, ephemeral, and per-user read-cursor channels using short-lived member-scoped JWT claims. The app continues to store chat messages and unread read-cursors in Turso. Run `npm run dev:all` to start Next.js and Mastra Studio.

Workspace Realtime carries saved-message broadcasts, presence, and typing only. The free Supabase tier has finite connection and message quotas; Realtime broadcast fan-out contributes usage per recipient, so monitor Realtime usage as workspaces grow. `@Gluk` replies are generated after the HTTP send response within the Next.js function lifetime; this is not a durable job queue.

---

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx                  # Main chat UI
│   ├── resources/page.tsx         # User resource library
│   ├── login/page.tsx            # Auth screen
│   └── api/
│       ├── chat/route.ts         # Streaming chat endpoint (RAG + agent + research)
│       ├── ingest/route.ts       # Document → Pinecone embedding pipeline
│       ├── upload/route.ts       # File → Cloudinary upload
│       ├── conversations/        # CRUD for conversation history
│       ├── resources/             # User resource listing and actions
│       └── auth/                 # NextAuth handler
├── components/
│   ├── query-provider.tsx        # App-wide TanStack Query client
│   ├── resources-library.tsx     # Searchable grid/list resource views
│   ├── chat-window.tsx           # Message list renderer
│   ├── chat-input.tsx            # Input bar with file attachment support
│   ├── message-bubble.tsx        # Per-message component (markdown + citations)
│   └── sidebar.tsx               # Conversation history sidebar
├── lib/
│   ├── auth.ts                   # NextAuth config
│   ├── db.ts                     # Turso/LibSQL client
│   ├── queries/                  # Query keys and server-state API functions
│   ├── embeddings.ts             # HuggingFace embedding wrapper (soft-fail on errors)
│   ├── vector-store.ts           # Pinecone store + hybrid search + MMR deduplication
│   ├── document-processor.ts     # PDF/CSV/DOCX/TXT parser + semantic chunker
│   └── research-store.ts         # Research session persistence (Turso)
└── mastra/
    ├── index.ts                  # Mastra config — agent + workflow registration
    ├── agents/
    │   └── gluk-agent.ts         # Main AI agent (tools, memory, system prompt)
    ├── tools/
    │   ├── web-search-tool.tsx   # Tavily web search
    │   ├── web-fetch-tool.ts     # Full-page HTML extractor
    │   └── source-rerank-tool.ts # TF-IDF + domain credibility ranker
    └── workflows/
        └── research-workflow.ts  # 5-step deep research pipeline
```

---

## Client Data Architecture

- **TanStack Query** owns authenticated server state for conversations and uploaded resources. Query keys are scoped by user, and cache updates or invalidation follow server mutations.
- **React Context** owns transient UI and in-progress chat state: active conversation, sidebar, theme, guest drafts, and streamed assistant messages.
- **Direct fetch flows** remain for streamed AI responses, multipart uploads, and speech requests because they use response streams or file bodies.
- **Server boundaries** remain Next.js API routes plus `src/lib` persistence/search helpers and Mastra agents/workflows. Client caching does not replace server-side authorization.

## �� How the Research Pipeline Works

When Gluk detects a research-type question, it runs a 5-step Mastra workflow instead of a single agent call:

```
1. Plan        → Break the question into 2–3 focused sub-queries
2. Gather      → Run Tavily search for each sub-query (with rate-limit courtesy delays)
3. Deep-fetch  → Fetch the top 3 URLs in full — strip boilerplate, extract prose
4. Rerank      → Score every source by TF-IDF relevance + domain credibility
5. Synthesise  → Write a structured answer with inline [Title](URL) citations
```

For document questions (e.g. *"list the orders in the file"*), the research workflow is skipped. Gluk answers directly from Pinecone RAG — one LLM call, no web search.

---

## 📄 Supported File Types

| Type | Extension(s) |
|---|---|
| PDF | `.pdf` |
| Word | `.docx` |
| Spreadsheet | `.csv` |
| Plain text | `.txt`, `.md` |
| Images | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` |

Documents are semantically chunked (paragraph → sentence boundaries) and stored in Pinecone. Images are uploaded to Cloudinary and passed directly to the agent.

---

## 🔑 Rate Limits (Free Tier)

The default model is `deepseek/deepseek-chat` (or customize via `OPENROUTER_MODEL` in `.env.local`).

To configure your model or limits:
- Set `OPENROUTER_MODEL` in `.env.local` to any slug from [openrouter.ai/models](https://openrouter.ai/models) (e.g. `deepseek/deepseek-chat`, `nvidia/nemotron-3.5-lightning:free`, etc.)
- Add credits on OpenRouter if using paid models or to unlock higher throughput.

---

## 📦 Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Next.js dev server (Turbopack) |
| `npm run dev:all` | Start Next.js and Mastra Studio concurrently |
| `npm run mastra` | Start Mastra Studio only (`localhost:4111`) |
| `npm run build` | Build for production |
| `npm run start` | Run the production build |
| `npm run lint` | Run ESLint |

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on how to get involved.

---

## 📄 License

MIT — see [LICENSE](./LICENSE) for details.
# Workspaces

Signed-in users can create private workspaces at `/workspaces`. Workspace APIs
authorize every request against the signed-in email's membership. Owners can
invite people by email; invitations expire after seven days and can only be
accepted by signing in with the invited email. Configure `RESEND_API_KEY` and
`RESEND_FROM_EMAIL` to send invitations. If either setting is missing, the
workspace page displays a copyable invitation link instead.

Workspace chat is text-only. Mention `@Gluk` in a message to get an assistant
reply in the shared conversation. Projects and workspace resource records are
scoped to their workspace. Resource files are served through a member-checked
endpoint; the underlying files still use the app's existing storage providers.
Workspace chat uses private Supabase Realtime channels for live delivery,
presence, typing indicators, and in-app message notices. Turso remains the
durable source for messages and per-member unread cursors; there is no periodic
message polling. Video calls and browser push notifications are not included.
