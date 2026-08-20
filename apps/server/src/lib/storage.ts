/**
 * Object storage adapter.
 *
 * Media is NEVER written to the application filesystem: Railway containers have
 * an ephemeral disk, so uploads go straight to S3 compatible storage
 * (AWS S3, Cloudflare R2, Backblaze B2, MinIO...). Configure it with
 * STORAGE_PROVIDER + the S3_* environment variables.
 */
import { randomBytes } from "node:crypto"
import path from "node:path"

import { ALLOWED_IMAGE_MIME_TYPES } from "@socialapp/shared"

import { env } from "../config/env"
import { badRequest, storageNotConfigured } from "./errors"
import { logger } from "./logger"

let clientPromise: Promise<any> | null = null

export function isStorageConfigured(): boolean {
  return Boolean(
    env.storageEnabled && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY,
  )
}

async function getClient(): Promise<any> {
  if (!isStorageConfigured()) throw storageNotConfigured()
  if (!clientPromise) {
    clientPromise = (async () => {
      const { S3Client } = await import("@aws-sdk/client-s3")
      return new S3Client({
        region: env.S3_REGION,
        endpoint: env.S3_ENDPOINT,
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
        credentials: {
          accessKeyId: env.S3_ACCESS_KEY_ID!,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
        },
      })
    })()
  }
  return clientPromise
}

export function assertAllowedImage(mimeType: string): void {
  if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) {
    throw badRequest(`Unsupported file type: ${mimeType}. Allowed: JPEG, PNG, WebP, GIF.`)
  }
}

export function buildStorageKey(args: {
  purpose: "post" | "avatar" | "banner"
  userId: string
  fileName: string
}): string {
  const extension = (path.extname(args.fileName) || ".bin").toLowerCase().replace(/[^.a-z0-9]/g, "")
  const stamp = new Date().toISOString().slice(0, 10)
  return `${args.purpose}/${args.userId}/${stamp}/${Date.now()}-${randomBytes(6).toString("hex")}${extension}`
}

export function publicUrlFor(key: string): string {
  if (env.S3_PUBLIC_BASE_URL) return `${env.S3_PUBLIC_BASE_URL.replace(/\/+$/, "")}/${key}`
  if (env.S3_ENDPOINT && env.S3_BUCKET) {
    const base = env.S3_ENDPOINT.replace(/\/+$/, "")
    return env.S3_FORCE_PATH_STYLE ? `${base}/${env.S3_BUCKET}/${key}` : `${base}/${key}`
  }
  return `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${key}`
}

export async function putObject(args: {
  key: string
  body: Buffer
  contentType: string
}): Promise<{ key: string; url: string }> {
  const client = await getClient()
  const { PutObjectCommand } = await import("@aws-sdk/client-s3")
  await client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: args.key,
      Body: args.body,
      ContentType: args.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  )
  logger.debug({ key: args.key }, "Uploaded object to storage")
  return { key: args.key, url: publicUrlFor(args.key) }
}

/** Presigned PUT so large uploads can bypass the API process entirely. */
export async function createPresignedUploadUrl(args: {
  key: string
  contentType: string
  expiresInSeconds?: number
}): Promise<{ key: string; uploadUrl: string; publicUrl: string; expiresInSeconds: number }> {
  const client = await getClient()
  const { PutObjectCommand } = await import("@aws-sdk/client-s3")
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner")
  const expiresInSeconds = args.expiresInSeconds ?? 900
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: args.key,
      ContentType: args.contentType,
    }),
    { expiresIn: expiresInSeconds },
  )
  return { key: args.key, uploadUrl, publicUrl: publicUrlFor(args.key), expiresInSeconds }
}
