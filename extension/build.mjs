import { build, context } from 'esbuild'
import { cp, mkdir } from 'node:fs/promises'
import { watch as fsWatch } from 'node:fs'
import { resolve } from 'node:path'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import { readFile, writeFile, access } from 'node:fs/promises'
import { constants } from 'node:fs'

const rootDir = resolve(process.cwd())
const srcDir = resolve(rootDir, 'src')
const publicDir = resolve(rootDir, 'public')
const outDir = resolve(rootDir, 'dist')

async function copyPublic() {
  await mkdir(outDir, { recursive: true })
  // Copy static assets like manifest.json and popup.html
  await cp(publicDir, outDir, { recursive: true })

  // Create Firefox-compatible manifest
  const manifestPath = resolve(publicDir, 'manifest.json')
  const manifestContent = await readFile(manifestPath, 'utf-8')
  const manifest = JSON.parse(manifestContent)

  // For Firefox, write a compatibility manifest using background.scripts
  if (manifest.background?.service_worker) {
    const firefoxManifest = {
      ...manifest,
      background: {
        scripts: [manifest.background.service_worker],
      },
    }

    await writeFile(
      resolve(outDir, 'manifest-firefox.json'),
      JSON.stringify(firefoxManifest, null, 2)
    )
  }
}

async function loadEnvFile() {
  const envPath = resolve(rootDir, '.env')
  const env = {}

  try {
    await access(envPath, constants.F_OK)
    const envContent = await readFile(envPath, 'utf-8')
    const lines = envContent.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const match = trimmed.match(/^([^=]+)=(.*)$/)
      if (match) {
        const [, key, value] = match
        env[key.trim()] = value.trim().replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    // .env file doesn't exist, use defaults
  }

  return env
}

async function buildCSS() {
  const cssFile = resolve(srcDir, 'styles/index.css')
  const cssContent = await readFile(cssFile, 'utf-8')

  const result = await postcss([tailwindcss, autoprefixer]).process(cssContent, {
    from: cssFile,
    to: resolve(outDir, 'styles.css'),
  })

  await writeFile(resolve(outDir, 'styles.css'), result.css)
}

async function buildScripts(watch = false) {
  const envVars = await loadEnvFile()
  const nodeEnv = process.env.NODE_ENV || envVars.NODE_ENV || 'development'

  const define = {
    'process.env.NODE_ENV': JSON.stringify(nodeEnv),
    'import.meta.env.NODE_ENV': JSON.stringify(nodeEnv),
  }

  for (const [key, value] of Object.entries(envVars)) {
    if (key.startsWith('EXT_')) {
      define[`import.meta.env.${key}`] = JSON.stringify(value)
    }
    define[`process.env.${key}`] = JSON.stringify(value)
  }

  const options = {
    entryPoints: [
      resolve(srcDir, 'background/index.ts'),
      resolve(srcDir, 'content/index.ts'),
      resolve(srcDir, 'popup/index.tsx'),
    ],
    outdir: outDir,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    sourcemap: true,
    target: ['chrome120'],
    minify: nodeEnv === 'production',
    splitting: false,
    jsx: 'automatic',
    jsxImportSource: 'react',
    external: [],
    define,
  }

  if (watch) {
    const ctx = await context(options)
    await ctx.watch()
  } else {
    await build(options)
  }
}

async function main() {
  const watch = process.argv.includes('--watch')
  await copyPublic()
  await buildCSS()
  await buildScripts(watch)

  if (watch) {
    // Mirror changes from public/ into dist/ during watch mode
    fsWatch(publicDir, { recursive: true }, (_eventType, _filename) => {
      copyPublic()
        .then(() => console.log('Public assets copied'))
        .catch(err => console.error('Copy public failed:', err))
    })

    // Watch CSS changes
    fsWatch(resolve(srcDir, 'styles'), { recursive: true }, (_eventType, _filename) => {
      buildCSS()
        .then(() => console.log('CSS built'))
        .catch(err => console.error('CSS build failed:', err))
    })
  }
  console.log(`Built to ${outDir}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
