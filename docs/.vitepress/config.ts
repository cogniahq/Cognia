import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'en-US',
  title: 'Cognia',
  description:
    'Production-grade memory mesh, hybrid retrieval, SDK, and MCP server. Build with private knowledge that stays current.',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: 'localhostLinks',

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#0a0a0a' }],
    [
      'meta',
      {
        name: 'og:image',
        content: 'https://docs.cognia.xyz/og-default.png',
      },
    ],
  ],

  themeConfig: {
    siteTitle: 'Cognia Docs',
    nav: [
      { text: 'Quickstart', link: '/guides/quickstart' },
      { text: 'SDK', link: '/sdk/' },
      { text: 'MCP', link: '/mcp/' },
      { text: 'API', link: '/api/' },
      { text: 'Architecture', link: '/architecture/retrieval' },
      {
        text: 'Resources',
        items: [
          { text: 'Changelog', link: '/changelog' },
          { text: 'Status', link: 'https://status.cognia.xyz' },
          { text: 'GitHub', link: 'https://github.com/cogniahq/cognia' },
        ],
      },
    ],

    sidebar: {
      '/guides/': [
        {
          text: 'Get started',
          items: [
            { text: 'Quickstart', link: '/guides/quickstart' },
            { text: 'API keys & scopes', link: '/guides/api-keys' },
            { text: 'Errors & retries', link: '/guides/errors' },
          ],
        },
        {
          text: 'Workflows',
          items: [
            { text: 'Search-driven UX', link: '/guides/search-ux' },
            { text: 'Ingesting documents', link: '/guides/ingest' },
            { text: 'Self-hosting', link: '/guides/self-hosting' },
          ],
        },
      ],

      '/sdk/': [
        {
          text: 'TypeScript SDK',
          items: [
            { text: 'Overview', link: '/sdk/' },
            { text: 'Installation', link: '/sdk/install' },
            { text: 'Client reference', link: '/sdk/client' },
            { text: 'Search', link: '/sdk/search' },
            { text: 'Memories', link: '/sdk/memories' },
            { text: 'Errors', link: '/sdk/errors' },
            { text: 'Examples', link: '/sdk/examples' },
          ],
        },
      ],

      '/mcp/': [
        {
          text: 'MCP Server',
          items: [
            { text: 'Overview', link: '/mcp/' },
            { text: 'Claude Desktop', link: '/mcp/claude-desktop' },
            { text: 'Cursor', link: '/mcp/cursor' },
            { text: 'Cline / Continue', link: '/mcp/cline' },
            { text: 'Tools reference', link: '/mcp/tools' },
            { text: 'Programmatic embedding', link: '/mcp/programmatic' },
          ],
        },
      ],

      '/api/': [
        {
          text: 'REST API',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'Authentication', link: '/api/auth' },
            { text: 'Memories', link: '/api/memories' },
            { text: 'Search', link: '/api/search' },
            { text: 'MCP / JSON-RPC', link: '/api/mcp-jsonrpc' },
          ],
        },
      ],

      '/architecture/': [
        {
          text: 'Architecture',
          items: [
            { text: 'Hybrid retrieval', link: '/architecture/retrieval' },
            { text: 'Reranking', link: '/architecture/reranking' },
            { text: 'Ingest pipeline', link: '/architecture/ingest' },
            { text: 'Mesh & clusters', link: '/architecture/mesh' },
            { text: 'Multi-tenancy', link: '/architecture/multi-tenancy' },
          ],
        },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/cogniahq/cognia' }],

    footer: {
      message: 'Released under the Apache-2.0 License.',
      copyright: 'Copyright © 2026 Cognia',
    },

    search: { provider: 'local' },

    editLink: {
      pattern: 'https://github.com/cogniahq/cognia/edit/main/Cognia/docs/:path',
    },
  },
})
