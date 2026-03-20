import { Request, Response, NextFunction } from 'express'
import { logger } from '../../utils/core/logger.util'

interface IError extends Error {
  statusCode?: number
  status?: string
  isOperational?: boolean
}

const sendErrorDev = (err: IError, req: Request, res: Response) => {
  if (res.headersSent) {
    logger.warn('Response already sent, cannot send error response', {
      error: err.message,
      url: req.originalUrl,
    })
    return
  }

  if (req.originalUrl) {
    return res.status(err.statusCode || 500).json({
      status: err.status || 'error',
      error: err,
      message: err.message,
      stack: err.stack,
    })
  }

  throw err.message
}

const sendErrorProd = (err: IError, req: Request, res: Response) => {
  if (res.headersSent) {
    logger.warn('Response already sent, cannot send error response', {
      error: err.message,
      url: req.originalUrl,
    })
    return
  }

  const statusCode = err.statusCode || 500
  const isOperational = 'isOperational' in err ? Boolean(err.isOperational) : false

  res.status(statusCode).json({
    status: err.status || 'error',
    message: isOperational || statusCode < 500 ? err.message : 'Internal server error',
  })
}

export default (err: IError, req: Request, res: Response, next: NextFunction) => {
  void next
  err.statusCode = err.statusCode || 500
  err.status = err.status || 'error'

  if (process.env.NODE_ENV === 'production') {
    sendErrorProd(err, req, res)
    return
  }

  sendErrorDev(err, req, res)
}
