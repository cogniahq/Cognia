# Contributing to Cognia

## Development Setup

### Prerequisites
- Node.js 18+, Docker, Docker Compose
- OpenAI API key

### Quick Start

```bash
# 1. Setup API
cd api
npm install
cp .env.example .env  # Edit .env with your values (see .env.example for details)
npm run db:generate && npm run db:migrate
npm start  # Runs on http://localhost:3000
docker compose up -d

# 2. Setup Client
cd client
npm install
cp .env.example .env  # Edit .env with your values (see .env.example for details)
npm run dev  # Runs on http://localhost:5173

# 3. Setup Extension
cd extension
npm install
npm run build
# Load extension/dist in Chrome (chrome://extensions/)
```

## Development Workflow

1. Create branch: `git checkout -b <type>/<name>` (e.g., `feat/search-improvements`, `fix/memory-leak`)
2. Make changes
3. Format & lint: `npm run fix` (api/client) or `npm run check` (extension)
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/)
5. Push and open PR

**Branch naming**: `feat/`, `fix/`, `refactor/`, `chore/`, `docs/` prefixes

## Coding Standards

- **TypeScript**: Strict mode, avoid `any`, proper types
- **Formatting**: Prettier (2 spaces, configured)
- **Linting**: ESLint (configured)
- **Naming**: 
  - Files: kebab-case (`user-service.ts`)
  - Components: PascalCase (`MemoryCard.tsx`)
  - Functions/Vars: camelCase
  - Constants: UPPER_SNAKE_CASE
- **Organization**: Modular files, separate concerns (controllers → services), early returns

## Working with AI

We all use AI tools—that's normal and expected. What sets us apart as developers isn't whether we use AI, but how we use it. There are two critical skills: (1) our ability to drive the AI effectively, and (2) our ability to review and validate its output.

When we review code, we don't want to feel like we're reviewing raw AI output that we could have generated ourselves. If we're doing the same review cycles with code that we'd do with AI-generated code, then we'll wonder why we couldn't just ask our AI to do it directly.

Put in the work to validate AI output. Think through the entire picture, catch problems early, and give us something that reflects human intelligence—not just polished AI output. Review the code yourself, test it thoroughly, and ensure it fits the codebase context before submitting. That's what separates good developers from great ones in an AI-assisted world.

## Commit Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body> (optional)

<footer> (optional)
```

**Types**: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `test`, `perf`

**Scopes** (optional): `api`, `client`, `extension`, or specific module name

**Breaking Changes**: Add `!` after type/scope or include `BREAKING CHANGE:` in footer

**Examples**:
- `feat: add knowledge velocity scoring system`
- `feat(api): add knowledge velocity scoring system`
- `fix(client): correct Prisma JSON type casting`
- `refactor(extension): simplify logger utility`
- `feat(api)!: change authentication endpoint` (breaking change)
- `fix: resolve memory leak in search service` (with footer: `Closes #123`)

## Issue Reporting

Before opening an issue:
- Check existing issues for duplicates
- Include environment details (OS, Node version)
- Provide steps to reproduce
- Include expected vs actual behavior
- Add relevant logs/error messages

## Testing

- Test changes locally before submitting
- Ensure all existing functionality works
- Test edge cases and error handling
- Verify no TypeScript errors: `npm run check`

## Documentation

- Update relevant docs for new features
- Add JSDoc comments for public APIs
- Update README if setup/usage changes
- Keep inline comments minimal and meaningful

## Pull Requests

1. Rebase on latest `main`
2. Ensure builds pass, linting passes, no TypeScript errors
3. Clear PR description with context and testing steps
4. Link related issues
5. Address review feedback promptly
