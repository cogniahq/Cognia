# Cognia Docs

VitePress static site. Source for [docs.cognia.xyz](https://docs.cognia.xyz).

## Run locally

```sh
npm install
npm run dev      # dev server with HMR at http://localhost:5173
```

## Build

```sh
npm run build           # outputs to .vitepress/dist
npm run preview         # serve the production build
```

## Deploy

### Vercel (recommended)

```sh
vercel
```

The project root is this directory. `vercel.json` is preconfigured. Connect the GitHub repo for automatic preview deployments per PR.

### Netlify / Cloudflare Pages

Settings:
- Build command: `npm run build`
- Output directory: `.vitepress/dist`
- Node version: 20

## Structure

```
.
├── .vitepress/
│   └── config.ts        # site config, nav, sidebar
├── index.md             # landing page
├── guides/              # task-oriented guides
├── sdk/                 # @cogniahq/sdk reference
├── mcp/                 # @cogniahq/mcp reference
├── api/                 # REST API reference
├── architecture/        # internal design docs (public-readable)
├── changelog.md
├── vercel.json
└── package.json
```

## Conventions

- Headings are sentence-case ("Hybrid retrieval", not "Hybrid Retrieval").
- Code blocks always declare language. Dual code blocks use `:::code-group`.
- Internal links use VitePress `[text](./relative-path)` form. No bare `.md` extensions.
- Diagrams are ASCII art (vendor-neutral, copy-pasteable). Avoid mermaid for permanence.

## Updating

Edit the relevant `.md` file. Push. Vercel rebuilds in ~30 seconds.
