import { Prisma } from "@prisma/client"
import { ERROR_CODES } from "@socialapp/shared"
import type { NextFunction, Request, Response } from "express"
import { MulterError } from "multer"
import { ZodError } from "zod"

import { env } from "../config/env"
import { HttpError } from "../lib/errors"
import { logger } from "../lib/logger"

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: ERROR_CODES.NOT_FOUND,
      message: `Cannot ${req.method} ${req.originalUrl}`,
      requestId: req.requestId,
    },
  })
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  let status = 500
  let code: string = ERROR_CODES.INTERNAL_ERROR
  let message = "Something went wrong on our side"
  let details: unknown

  if (error instanceof HttpError) {
    status = error.status
    code = error.code
    message = error.message
    details = error.details
  } else if (error instanceof ZodError) {
    status = 422
    code = ERROR_CODES.VALIDATION_ERROR
    message = "Some fields need your attention"
    details = error.flatten()
  } else if (error instanceof MulterError) {
    status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400
    code = error.code === "LIMIT_FILE_SIZE" ? ERROR_CODES.PAYLOAD_TOO_LARGE : ERROR_CODES.VALIDATION_ERROR
    message = error.code === "LIMIT_FILE_SIZE" ? "File is too large" : error.message
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      status = 409
      code = ERROR_CODES.CONFLICT
      const target = (error.meta?.target as string[] | undefined)?.join(", ")
      message = target ? `${target} is already taken` : "This value is already taken"
    } else if (error.code === "P2025") {
      status = 404
      code = ERROR_CODES.NOT_FOUND
      message = "Not found"
    } else {
      status = 400
      code = ERROR_CODES.VALIDATION_ERROR
      message = "The request could not be completed"
    }
  } else if (error instanceof SyntaxError && "body" in error) {
    status = 400
    code = ERROR_CODES.VALIDATION_ERROR
    message = "Malformed JSON body"
  }

  if (status >= 500) {
    logger.error({ err: error, requestId: req.requestId, path: req.originalUrl }, "Unhandled error")
  } else {
    logger.debug({ code, status, requestId: req.requestId, path: req.originalUrl }, "Handled error")
  }

  res.status(status).json({
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      requestId: req.requestId,
      ...(env.isProduction || status < 500 ? {} : { stack: (error as Error)?.stack }),
    },
  })
}
