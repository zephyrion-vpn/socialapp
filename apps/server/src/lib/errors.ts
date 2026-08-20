import { ERROR_CODES } from "@socialapp/shared"

export class HttpError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown
  readonly expose: boolean

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = "HttpError"
    this.status = status
    this.code = code
    this.details = details
    this.expose = status < 500
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, ERROR_CODES.VALIDATION_ERROR, message, details)

export const validationError = (message: string, details?: unknown) =>
  new HttpError(422, ERROR_CODES.VALIDATION_ERROR, message, details)

export const unauthorized = (message = "Authentication required", code: string = ERROR_CODES.UNAUTHORIZED) =>
  new HttpError(401, code, message)

export const invalidCredentials = (message = "Invalid email/username or password") =>
  new HttpError(401, ERROR_CODES.INVALID_CREDENTIALS, message)

export const forbidden = (message = "You do not have access to this resource") =>
  new HttpError(403, ERROR_CODES.FORBIDDEN, message)

export const notFound = (message = "Not found") => new HttpError(404, ERROR_CODES.NOT_FOUND, message)

export const conflict = (message: string, details?: unknown) =>
  new HttpError(409, ERROR_CODES.CONFLICT, message, details)

export const payloadTooLarge = (message = "File is too large") =>
  new HttpError(413, ERROR_CODES.PAYLOAD_TOO_LARGE, message)

export const tooManyRequests = (message = "Too many requests, please slow down") =>
  new HttpError(429, ERROR_CODES.RATE_LIMITED, message)

export const storageNotConfigured = () =>
  new HttpError(
    503,
    ERROR_CODES.MEDIA_STORAGE_NOT_CONFIGURED,
    "Media storage is not configured on this server. Set STORAGE_PROVIDER and the S3 variables.",
  )

export const internalError = (message = "Internal server error") =>
  new HttpError(500, ERROR_CODES.INTERNAL_ERROR, message)
