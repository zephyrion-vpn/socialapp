import type { AuthContext } from "../middleware/auth"

declare global {
  namespace Express {
    interface Request {
      /** Populated by requireAuth / optionalAuth. */
      auth?: AuthContext
      /** Parsed + sanitised input produced by the validate() middleware. */
      valid?: {
        body?: any
        query?: any
        params?: any
      }
      requestId?: string
      startedAt?: number
    }
  }
}

export {}
