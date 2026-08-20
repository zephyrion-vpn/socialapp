import type { NextFunction, Request, RequestHandler, Response } from "express"
import type { ZodTypeAny } from "zod"

import { isZodError, validationError } from "../lib/errors"

export interface ValidationSchemas {
  body?: ZodTypeAny
  query?: ZodTypeAny
  params?: ZodTypeAny
}

/**
 * Validates and normalises every piece of untrusted input. Parsed values are
 * exposed on `req.valid` - route handlers only ever read from there, so raw
 * client input can never reach the database layer.
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.valid = {
        body: schemas.body ? schemas.body.parse(req.body ?? {}) : undefined,
        query: schemas.query ? schemas.query.parse(req.query ?? {}) : undefined,
        params: schemas.params ? schemas.params.parse(req.params ?? {}) : undefined,
      }
      next()
    } catch (error) {
      // Shape based detection on purpose: schemas owned by @socialapp/shared
      // can raise a ZodError from a second zod instance. See isZodError().
      if (isZodError(error)) {
        next(validationError("Some fields need your attention", error.flatten()))
        return
      }
      next(error)
    }
  }
}

export function validBody<T>(req: Request): T {
  return req.valid?.body as T
}

export function validQuery<T>(req: Request): T {
  return req.valid?.query as T
}

export function validParams<T>(req: Request): T {
  return req.valid?.params as T
}
