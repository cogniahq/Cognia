import { mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, "..")
const repoRoot = path.resolve(clientRoot, "..", "..")
const outputDir = path.join(repoRoot, "output", "mesh-showcase")

const width = 1600
const height = 900
const durationMs = 7000
const settleMs = 800
const url = "http://127.0.0.1:4173/mesh-showcase"

await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({
  headless: true,
})

const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: outputDir,
    size: { width, height },
  },
})

const page = await context.newPage()

await page.goto(url, { waitUntil: "networkidle" })
await page.waitForSelector("canvas", { state: "visible", timeout: 15000 })
await page.waitForTimeout(settleMs)

await page.screenshot({
  path: path.join(outputDir, "mesh-showcase-poster.png"),
})

await page.waitForTimeout(durationMs)

await context.close()
await browser.close()
