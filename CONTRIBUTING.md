# Contributing to Gluk

First off — thanks for taking the time to contribute! 🎉

Whether you're fixing a bug, improving the docs, or proposing a new feature, every contribution is welcome.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Submitting a Pull Request](#submitting-a-pull-request)
- [Development Guide](#development-guide)
  - [Project Setup](#project-setup)
  - [Folder Conventions](#folder-conventions)
  - [Code Style](#code-style)
  - [Commit Messages](#commit-messages)
- [Areas That Need Help](#areas-that-need-help)

---

## Code of Conduct

Be kind, be respectful, and assume good intent. Harassment of any kind will not be tolerated.

---

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/gluk.git
   cd gluk
   ```
3. **Create a branch** for your work:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/the-bug-you-are-fixing
   ```
4. Follow the [setup steps in the README](./README.md#-getting-started) to get the app running locally.

---

## How to Contribute

### Reporting Bugs

Open a [GitHub Issue](https://github.com/daviddozie/gluk/issues) and include:

- A clear title and description
- Steps to reproduce the bug
- What you expected vs. what actually happened
- Relevant logs or screenshots (especially server logs from `npm run dev`)
- Your Node.js version and OS

### Suggesting Features

Open a [GitHub Issue](https://github.com/daviddozie/gluk/issues) with the label `enhancement` and describe:

- The problem you're trying to solve
- Your proposed solution
- Any alternatives you considered
- Whether you're willing to implement it yourself

### Submitting a Pull Request

1. Make your changes on your feature branch
2. Run the type-checker to make sure nothing is broken:
   ```bash
   npx tsc --noEmit
   ```
3. Run the linter:
   ```bash
   npm run lint
   ```
4. Commit with a clear message (see [Commit Messages](#commit-messages))
5. Push your branch and open a PR against `main`
6. Fill in the PR template — describe what changed and why

A maintainer will review your PR as soon as possible. Please be patient and respond to feedback promptly.

---

## Development Guide

### Project Setup

See the full setup guide in [README.md](./README.md#-getting-started). The short version:

```bash
npm install
cp .env.example .env.local   # fill in your API keys
npm run dev                  # Next.js at localhost:3000
npm run dev:all              # Next.js + Mastra Studio at localhost:4111
```

### Folder Conventions

| Path | What goes here |
|---|---|
| `src/app/api/` | Next.js API route handlers |
| `src/components/` | React UI components |
| `src/lib/` | Shared utilities (DB, embeddings, vector store, etc.) |
| `src/mastra/agents/` | Mastra agent definitions |
| `src/mastra/tools/` | Mastra tool definitions (one tool per file) |
| `src/mastra/workflows/` | Mastra multi-step workflow definitions |
| `src/types/` | Shared TypeScript types |

**Rules:**
- One exported entity per file for tools and agents
- Keep API routes thin — business logic belongs in `src/lib/` or `src/mastra/`
- Never import from `src/mastra/` in client components — Mastra runs server-side only

### Code Style

- **TypeScript** — strict mode is on; avoid `any` where possible, use `unknown` + type-narrowing instead
- **Formatting** — we use ESLint (`npm run lint`); run it before committing
- **No magic strings** — extract repeated strings into named constants
- **Error handling** — use soft-fail patterns for external APIs (HuggingFace, Pinecone, Tavily) so one service being down doesn't crash the whole chat
- **Comments** — explain *why*, not *what*; the code should speak for the what

### Commit Messages

We follow a simplified version of [Conventional Commits](https://www.conventionalcommits.org):

```
<type>: <short description>

[optional body]
```

| Type | When to use |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `chore` | Maintenance (deps update, config, etc.) |

**Examples:**
```
feat: add source credibility scoring to rerank tool
fix: guard against empty Pinecone upsert when all embeddings fail
docs: update README with PINECONE_HOST variable
perf: await ingest before chat request so RAG finds document chunks
```

---

## Areas That Need Help

Here are some good first issues and bigger projects if you're looking for somewhere to start:

**Good first issues**
- [ ] Add a "Research" toggle button in the chat UI (`useResearch: true/false`)
- [ ] Show a spinner / progress indicator during the research workflow steps
- [ ] Improve error messages when API keys are missing or invalid
- [ ] Add `.env.example` with placeholder values and descriptions for every variable

**Medium complexity**
- [ ] Cache Tavily search results by query hash (30-minute TTL) to reduce API usage
- [ ] Support `.md` and `.mdx` file uploads
- [ ] Add a document manager — let users see and delete their uploaded files
- [ ] Keyboard shortcuts (new chat, toggle sidebar, abort generation)

**Larger projects**
- [ ] Streaming progress events from the research workflow to the UI (show which step is running)
- [ ] Multi-model support — let users pick a model from a dropdown
- [ ] Export conversation as PDF or Markdown
- [ ] Eval harness — automated tests for agent answer quality

---

## Questions?

Open a [GitHub Discussion](https://github.com/daviddozie/gluk/discussions) or drop a comment on an existing issue. We're happy to help.
