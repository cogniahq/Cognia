<a href="https://cogniahq.tech" target="_blank"><img width="1572" height="273" alt="Banner-sm" src="https://github.com/user-attachments/assets/70a378fe-fb38-4570-bb8e-9db728789e6a" />
</a>



> An AI-powered knowledge graph for capturing, organizing, and retrieving your digital context.


## Quick Start

### Prerequisites
- Node.js 18+
- Docker and Docker Compose
- Gemini API key or Ollama (for AI)

### 1. Running backend + databases with Docker

You can start the API together with PostgreSQL, Qdrant and Redis using Docker. Below are a few supported ways — use the one that fits your workflow.

Option A — Recommended: Docker Compose (single command)

```bash
cd api
docker compose up -d
```

This brings up Postgres, Qdrant, Redis, and the API (if configured in `api/docker-compose.yml`). Qdrant will be available at `http://localhost:6333` (HTTP) and `http://localhost:6334` (gRPC) by default.

Option B — Rebuild the API image then compose up

If you've changed backend code and want the Compose service to run the rebuilt image:

```bash
cd api
docker compose up --build -d
```

Option C — Run DB services only, then run API container separately

Start core services with Compose and then build/run the API container manually (useful for iterating locally):

```bash
cd api
docker compose up -d postgres qdrant redis

# In another terminal, build and run the API container (example):
docker build -t cognia-api:local .
docker run --rm -it \
	--env-file .env \
	--network host \
	-p 3000:3000 \
	cognia-api:local
```

Notes:
- If you run the API container manually, ensure `.env` is copied from `.env.example` and updated: `cp api/.env.example api/.env`.
- When using `--network host` on macOS Docker Desktop, networking behaves differently; alternatively connect containers using the Compose network (recommended).

Option D — Run a single service from the Compose file

You can start only specific services from the Compose file, for example Qdrant:

```bash
cd api
docker compose up -d qdrant
```

Troubleshooting & logs

- Follow logs: `cd api && docker compose logs -f`
- Inspect service status: `cd api && docker compose ps`
- View a single container log: `docker logs -f <container-name>`

The API will automatically create the `memory_embeddings` collection on startup with the configured embedding dimension and payload indexes when it can reach Qdrant.

### 2. API Setup

```bash
cd api

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your values (see .env.example for details)

# Run migrations
npm run db:migrate

# Start API server
npm start
# Server runs on http://localhost:3000
```

### 3. Web Client Setup

```bash
cd client

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your values (see .env.example for details)

# Start development server
npm run dev
# Client runs on http://localhost:5173
```

### 4. Browser Extension Setup

```bash
cd extension

# Install dependencies
npm install

# Build extension
npm run build
```

**Load Extension in Chrome:**

1. Navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select the `extension/dist` folder

**Next Steps:**

- Open http://localhost:5173 and create your account
- The extension will automatically detect authentication status

<img width="1582" height="976" alt="Screenshot 2025-11-16 at 5 12 44 PM" src="https://github.com/user-attachments/assets/ea0d7958-e40a-4186-be5a-a8fae01b8f85" />


---

## Core Features

### 1. Intelligent Capture
- **Browser Extension**: Automatic capture of web content as you browse
- **Smart Deduplication**: Prevents storing the same content twice
- **Privacy-Aware**: Detects and adapts to privacy extensions
- **Multi-Source**: Extension or web client

### 2. AI-Powered Processing
- **Hybrid AI**: Gemini (cloud) → Ollama (local) → Deterministic fallback
- **Summarization**: Concise, actionable summaries (≤200 words)
- **Metadata Extraction**: Topics, categories, sentiment, importance
- **Vector Embeddings**: 768-dimensional semantic representations

### 3. Knowledge Graph (Memory Mesh)
- **Semantic Relations**: Content similarity via embeddings (≥0.3 threshold)
- **Topical Relations**: Weighted metadata overlap
- **Temporal Relations**: Time-based proximity with decay
- **Force-Directed Visualization**: 3D graph in web client

### 4. Semantic Search
- **Vector Similarity**: Qdrant-powered fast vector search
- **AI Answers**: GPT-style responses with inline citations [1], [2]
- **Meta Summaries**: Contextual overview across results
- **Hybrid Mode**: Blends keyword (40%) + semantic (60%) search
- **Context Export**: Format results for ChatGPT/Claude

### 5. User Authentication
- **JWT-based Auth**: Secure token-based authentication
- **Email/Password**: Traditional login and registration
- **Session Cookies**: HttpOnly, Secure cookies for web clients
- **Extension Auth**: Automatic token generation for browser extensions
- **User Isolation**: All memories are user-scoped and protected

### 6. Analytics & Insights
- **Memory Stats**: Total count, processing status
- **Topic Analysis**: Top topics, categories, sentiment distribution
- **Processing Monitoring**: Track processing states and status
- **Browsing Summaries**: AI-generated daily/weekly/monthly summaries of your browsing activity

### 7. Data Management
- **Privacy Controls**: Audit logs for account activity tracking
- **Profile Management**: User profile with preferences and settings

### 8. Additional Features
- **Email Drafting**: AI-powered email reply generation based on your memories
- **Command Menu**: Quick navigation and actions via keyboard shortcuts (Cmd/Ctrl+K)
- **Dark Mode**: Theme switching with system preference detection

---

## Technology Stack

### Frontend
- React 18 with TypeScript
- Vite build tool
- Tailwind CSS
- Three.js + React Three Fiber for 3D graph visualization
- Radix UI for accessible components
- React Router for navigation
- cmdk for command menu
- sonner for toast notifications

### Backend
- Node.js + Express.js
- TypeScript
- Prisma ORM
- BullMQ (Redis) for job queue
- JWT for authentication
- bcryptjs for password hashing
- Background workers for content processing, insights generation, and profile updates

### Database
- PostgreSQL 14+ (relational data only)
- Qdrant vector database for embeddings storage and search
- Redis for job queue

### AI/ML
- Google Gemini API (text-embedding-004)
- Ollama (local alternative)
- Deterministic fallback embeddings

### Tools
- ESBuild (extension bundling)
- Jest (API testing)
- Prettier (code formatting)
- ESLint for code quality
- TypeScript for type safety

---

## Usage

Cognia provides multiple ways to capture and interact with your knowledge:

- **Browser Extension**: Automatically captures web content as you browse, with smart deduplication and privacy-aware detection
- **Web Client**: Manual memory entry with rich editing and visualization tools

### Web Client Pages

- **Landing**: Welcome page with product overview
- **Memories**: Browse all memories with filters, search, and interactive 3D memory mesh visualization
- **Analytics**: Comprehensive analytics dashboard with memory statistics, topic analysis, and processing monitoring
- **Insights**: AI-generated browsing summaries (daily/weekly/monthly) with key learnings and patterns
- **Profile**: User profile management with preferences and settings
- **Docs**: Complete documentation and API reference

### Key Workflows

**Capturing Memories**: Once captured (via extension or manual entry), memories are automatically processed with canonicalization and vector embeddings. The system builds a knowledge graph connecting related memories through semantic, topical, and temporal relationships.

**Searching**: Use natural language queries to search your knowledge base. The system performs semantic search across vector embeddings and generates AI-powered answers with inline citations to source memories. Access search via spotlight (Cmd/Ctrl+K) or in the Memories page. Results can be exported for use with ChatGPT or Claude.

**Visualizing**: Explore your knowledge as an interactive 3D force-directed graph, where nodes represent memories and edges show relationships. The graph is color-coded by source type and edge thickness indicates relationship strength.

**Insights**: Generate AI-powered summaries of your browsing activity to discover patterns, key learnings, and trends over time.

---

## Development

**Tests**: `cd api && npm test`

**Formatting**: `npm run format` (api/extension) or `npx prettier --write .` (client)

**Database**: `npm run db:migrate` (migrations), `npm run db:generate` (Prisma client), `npm run db:studio` (Prisma Studio), `npm run db:reset` (⚠️ deletes all data)

**Qdrant**: `npm run clean:qdrant` (⚠️ deletes embeddings), `npm run clean:all` (⚠️ deletes everything)

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for:

- Development setup and workflow
- Coding standards and conventions
- Commit message format
- Pull request process
- Issue reporting guidelines

---

## Deployment

### API (Railway/Render)
1. Create PostgreSQL database
2. Deploy Qdrant instance (or use Qdrant Cloud)
3. Create Redis instance
4. Set environment variables (including QDRANT_URL, QDRANT_API_KEY if using Qdrant Cloud)
5. Deploy from GitHub
6. Run migrations: `npm run db:deploy`

### Client (Vercel)
1. Import GitHub repository
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Add environment variables
5. Deploy

### Extension (Chrome Web Store)
1. Build extension: `npm run build`
2. Create ZIP of `dist/` folder
3. Upload to Chrome Web Store Developer Dashboard
4. Submit for review

---

## Troubleshooting

**Extension not capturing**: Verify extension is enabled, API endpoint is correct, and authentication token is set. Check browser console for errors.

**Search returns no results**: Ensure memories exist, embeddings were generated, and authentication is valid. Review API logs.

**Authentication failed**: Verify credentials, check JWT_SECRET is set, ensure cookies are enabled, and review CORS configuration.

**AI processing slow**: Gemini API may be rate-limited. Try switching to Ollama (local) or check network connection.

**Database/Qdrant connection failed**: Verify services are running, check connection URLs, and review service logs. For Qdrant, check `http://localhost:6333/health`.

---

## Performance

- **Ingestion**: 2-5s synchronous, 5-30s async processing, 10-20 memories/minute throughput
- **Search**: <100ms vector similarity (Qdrant), 5-15s AI answer generation
- **Database**: 1M+ memories, 10M+ relations, <100ms query performance
