import {
  MAX_UPLOAD_BYTES,
  uploadUrlSchema,
  type UploadTicket,
  type UploadUrlInput,
  type UploadedMedia,
} from "@socialapp/shared"
import { Router } from "express"
import multer from "multer"
import { z } from "zod"

import { badRequest, storageNotConfigured } from "../lib/errors"
import { asyncHandler } from "../lib/http"
import {
  assertAllowedImage,
  buildStorageKey,
  createPresignedUploadUrl,
  isStorageConfigured,
  putObject,
} from "../lib/storage"
import { requireAuth } from "../middleware/auth"
import { uploadLimiter } from "../middleware/rate-limit"
import { validate, validBody } from "../middleware/validate"

export const mediaRouter = Router()

// Files are buffered in memory and streamed straight to object storage - the
// container filesystem is never used (Railway disks are ephemeral).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
})

const purposeSchema = z.enum(["post", "avatar", "banner"]).default("post")

/** Presigned PUT ticket: the client uploads directly to object storage. */
mediaRouter.post(
  "/upload-url",
  requireAuth,
  uploadLimiter,
  validate({ body: uploadUrlSchema }),
  asyncHandler(async (req, res) => {
    if (!isStorageConfigured()) throw storageNotConfigured()

    const body = validBody<UploadUrlInput>(req)
    assertAllowedImage(body.mimeType)

    const key = buildStorageKey({
      purpose: body.purpose,
      userId: req.auth!.userId,
      fileName: body.fileName,
    })
    const ticket = await createPresignedUploadUrl({ key, contentType: body.mimeType })

    const payload: UploadTicket = {
      key: ticket.key,
      uploadUrl: ticket.uploadUrl,
      publicUrl: ticket.publicUrl,
      headers: { "Content-Type": body.mimeType },
      expiresInSeconds: ticket.expiresInSeconds,
    }
    res.status(201).json(payload)
  }),
)

/** Multipart upload proxied by the API - simplest path for the desktop client. */
mediaRouter.post(
  "/upload",
  requireAuth,
  uploadLimiter,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!isStorageConfigured()) throw storageNotConfigured()

    const file = req.file
    if (!file) throw badRequest("No file was uploaded")
    assertAllowedImage(file.mimetype)

    const purpose = purposeSchema.parse(
      typeof req.body?.purpose === "string" ? req.body.purpose : undefined,
    )

    const key = buildStorageKey({
      purpose,
      userId: req.auth!.userId,
      fileName: file.originalname || "upload",
    })
    const stored = await putObject({ key, body: file.buffer, contentType: file.mimetype })

    const payload: UploadedMedia = {
      key: stored.key,
      url: stored.url,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    }
    res.status(201).json(payload)
  }),
)
