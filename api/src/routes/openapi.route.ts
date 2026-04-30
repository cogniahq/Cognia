import { Router } from 'express'
import { getOpenApiSpec } from '../services/openapi.service'

const router = Router()

router.get('/openapi.json', (_req, res) => {
  res.json(getOpenApiSpec())
})

export default router
