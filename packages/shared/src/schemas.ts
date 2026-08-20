import { z } from "zod"

import {
  MAX_ALT_TEXT_LENGTH,
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_LOCATION_LENGTH,
  MAX_MEDIA_PER_POST,
  MAX_MESSAGE_LENGTH,
  MAX_PAGE_SIZE,
  MAX_PASSWORD_LENGTH,
  MAX_POST_LENGTH,
  MAX_UPLOAD_BYTES,
  MAX_USERNAME_LENGTH,
  MAX_WEBSITE_LENGTH,
  MIN_PASSWORD_LENGTH,
  MIN_USERNAME_LENGTH,
  RESERVED_USERNAMES,
  USERNAME_PATTERN,
} from "./constants"

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(MIN_USERNAME_LENGTH, `Username must be at least ${MIN_USERNAME_LENGTH} characters`)
  .max(MAX_USERNAME_LENGTH, `Username must be at most ${MAX_USERNAME_LENGTH} characters`)
  .regex(USERNAME_PATTERN, "Only lowercase letters, digits and underscore are allowed")
  .refine((value) => !RESERVED_USERNAMES.includes(value), "This username is reserved")

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(320)

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(MAX_PASSWORD_LENGTH)
  .refine((value) => /[a-zA-Z]/.test(value), "Password must contain a letter")
  .refine((value) => /[0-9]/.test(value), "Password must contain a digit")

export const uuidSchema = z.string().uuid("Invalid identifier")

export const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(MAX_DISPLAY_NAME_LENGTH).optional(),
})

export const loginSchema = z.object({
  /** Email address or username. */
  identifier: z.string().trim().min(1, "Enter your email or username").max(320),
  password: z.string().min(1, "Enter your password").max(MAX_PASSWORD_LENGTH),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(512),
})

export const logoutSchema = z.object({
  refreshToken: z.string().min(20).max(512).optional(),
})

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(512),
  password: passwordSchema,
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(MAX_PASSWORD_LENGTH),
  newPassword: passwordSchema,
})

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(MAX_DISPLAY_NAME_LENGTH).optional(),
    bio: z.string().trim().max(MAX_BIO_LENGTH).nullable().optional(),
    location: z.string().trim().max(MAX_LOCATION_LENGTH).nullable().optional(),
    website: z
      .string()
      .trim()
      .max(MAX_WEBSITE_LENGTH)
      .url("Enter a valid URL, e.g. https://example.com")
      .nullable()
      .optional(),
    /** Storage keys previously returned by the media endpoints. */
    avatarKey: z.string().trim().max(512).nullable().optional(),
    bannerKey: z.string().trim().max(512).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Nothing to update")

export const postMediaInputSchema = z.object({
  key: z.string().trim().min(1).max(512),
  altText: z.string().trim().max(MAX_ALT_TEXT_LENGTH).nullable().optional(),
  width: z.number().int().positive().max(20000).nullable().optional(),
  height: z.number().int().positive().max(20000).nullable().optional(),
  mimeType: z.string().trim().max(128).nullable().optional(),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES).nullable().optional(),
})

export const createPostSchema = z
  .object({
    content: z.string().max(MAX_POST_LENGTH, `Posts are limited to ${MAX_POST_LENGTH} characters`),
    parentId: uuidSchema.nullable().optional(),
    quotedPostId: uuidSchema.nullable().optional(),
    visibility: z.enum(["PUBLIC", "FOLLOWERS", "UNLISTED"]).default("PUBLIC"),
    media: z.array(postMediaInputSchema).max(MAX_MEDIA_PER_POST).default([]),
  })
  .refine(
    (value) => value.content.trim().length > 0 || value.media.length > 0,
    "Write something or attach an image",
  )

export const paginationSchema = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
})

export const feedQuerySchema = paginationSchema.extend({
  type: z.enum(["home", "recommended", "popular", "latest"]).default("home"),
})

export const searchQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(1, "Enter a search query").max(120),
  type: z.enum(["all", "posts", "users", "hashtags"]).default("all"),
})

export const notificationsQuerySchema = paginationSchema.extend({
  unreadOnly: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((value) => value === true || value === "true")
    .optional(),
})

export const startConversationSchema = z.object({
  username: usernameSchema,
})

export const sendMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Write a message first")
    .max(MAX_MESSAGE_LENGTH, `Messages are limited to ${MAX_MESSAGE_LENGTH} characters`),
})

export const uploadUrlSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(3).max(128),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  purpose: z.enum(["post", "avatar", "banner"]).default("post"),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type RefreshInput = z.infer<typeof refreshSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type CreatePostInput = z.input<typeof createPostSchema>
export type PaginationInput = z.infer<typeof paginationSchema>
export type FeedQueryInput = z.infer<typeof feedQuerySchema>
export type SearchQueryInput = z.infer<typeof searchQuerySchema>
export type StartConversationInput = z.infer<typeof startConversationSchema>
export type SendMessageInput = z.infer<typeof sendMessageSchema>
export type UploadUrlInput = z.infer<typeof uploadUrlSchema>
