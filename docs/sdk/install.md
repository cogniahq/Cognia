# Installation

::: code-group
```sh [npm]
npm install @cogniahq/sdk
```

```sh [pnpm]
pnpm add @cogniahq/sdk
```

```sh [yarn]
yarn add @cogniahq/sdk
```

```sh [bun]
bun add @cogniahq/sdk
```
:::

## Runtime support

| Runtime | Supported |
|---|---|
| Node.js 18+        | ✓ (uses native `fetch`) |
| Node.js 16         | ✓ with `fetch` polyfill (`undici`) injected |
| Deno               | ✓ |
| Bun                | ✓ |
| Cloudflare Workers | ✓ (pass `fetch: globalThis.fetch`) |
| Vercel Edge        | ✓ |
| Browsers           | Possible but **not recommended** — would expose the API key |

## TypeScript

The SDK ships with `.d.ts` files. No `@types/*` package is required. Recommended `tsconfig.json` for downstream:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true
  }
}
```

The SDK is built with `exactOptionalPropertyTypes: true` and `noUncheckedIndexedAccess: true` — your code doesn't need to match, but your types will be tighter if it does.

## Bundler notes

- **Vite / esbuild / tsup** — works out of the box (ESM-first).
- **Webpack 5** — works; uses the `module` field automatically.
- **Webpack 4** — falls back to `main` (CJS).
