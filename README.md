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
| **LLM** | [OpenRouter](https://openrouter.ai) — `nvidia/nemotron-3-nano-30b-a3b:free` by default |
| **Embeddings** | HuggingFace `sentence-transformers/all-MiniLM-L6-v2` |
| **Vector DB** | [Pinecone](https://pinecone.io) |
| **Database** | [Turso](https://turso.tech) (LibSQL) — conversations + research sessions |
| **File storage** | [Cloudinary](https://cloudinary.com) |
| **Auth** | [NextAuth v4](https://next-auth.js.org) — Google + GitHub |
| **UI** | React 19, Tailwind CSS v4, shadcn/ui, Lucide icons |
| **Language** | TypeScript 5 |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
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

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Tip:** To also run the Mastra Studio UI (agent inspector at `localhost:4111`), use `npm run dev:all` instead.

---

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx                  # Main chat UI
│   ├── login/page.tsx            # Auth screen
│   └── api/
│       ├── chat/route.ts         # Streaming chat endpoint (RAG + agent + research)
│       ├── ingest/route.ts       # Document → Pinecone embedding pipeline
│       ├── upload/route.ts       # File → Cloudinary upload
│       ├── conversations/        # CRUD for conversation history
│       └── auth/                 # NextAuth handler
├── components/
│   ├── chat-window.tsx           # Message list renderer
│   ├── chat-input.tsx            # Input bar with file attachment support
│   ├── message-bubble.tsx        # Per-message component (markdown + citations)
│   └── sidebar.tsx               # Conversation history sidebar
├── lib/
│   ├── auth.ts                   # NextAuth config
│   ├── db.ts                     # Turso/LibSQL client
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

The default model (`nvidia/nemotron-3-nano-30b-a3b:free`) allows **50 requests/day** on OpenRouter's free tier. The limit resets at midnight UTC.

To increase this:
- Add $10 credits on OpenRouter → unlocks 1 000 req/day
- Or switch model: set `OPENROUTER_MODEL` in `.env.local` to any slug from [openrouter.ai/models](https://openrouter.ai/models)

---

## 📦 Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Next.js dev server (Turbopack) |
| `npm run dev:all` | Start Next.js + Mastra Studio concurrently |
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
