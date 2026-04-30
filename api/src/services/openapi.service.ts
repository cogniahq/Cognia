export function getOpenApiSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Cognia API',
      version: '1.0.0',
      description: 'Programmatic access to Cognia memories and search.',
    },
    servers: [{ url: process.env.PUBLIC_API_URL || 'http://localhost:3000' }],
    components: {
      securitySchemes: {
        apiKey: { type: 'http', scheme: 'bearer', bearerFormat: 'API key (ck_live_*)' },
      },
      schemas: {
        Memory: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string', nullable: true },
            content: { type: 'string' },
            url: { type: 'string', nullable: true },
            memory_type: { type: 'string' },
            source: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        SearchResult: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string', nullable: true },
            snippet: { type: 'string' },
            url: { type: 'string', nullable: true },
          },
        },
      },
    },
    security: [{ apiKey: [] as string[] }],
    paths: {
      '/v1/memories': {
        get: {
          summary: 'List memories',
          tags: ['Memories'],
          parameters: [
            { in: 'query', name: 'cursor', schema: { type: 'string' } },
            { in: 'query', name: 'limit', schema: { type: 'integer', maximum: 200 } },
            { in: 'query', name: 'q', schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Paginated memories',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Memory' },
                      },
                      next_cursor: { type: 'string', nullable: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/v1/memories/{id}': {
        get: {
          summary: 'Get a memory',
          tags: ['Memories'],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: {
            '200': {
              description: 'Memory',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { data: { $ref: '#/components/schemas/Memory' } },
                  },
                },
              },
            },
            '404': { description: 'Not found' },
          },
        },
        patch: {
          summary: 'Update a memory',
          tags: ['Memories'],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    content: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Updated' } },
        },
        delete: {
          summary: 'Soft-delete a memory',
          tags: ['Memories'],
          responses: { '204': { description: 'Deleted' } },
        },
      },
      '/v1/search': {
        post: {
          summary: 'Search memories',
          tags: ['Search'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['query'],
                  properties: {
                    query: { type: 'string' },
                    limit: { type: 'integer', maximum: 50 },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Results',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/SearchResult' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }
}
