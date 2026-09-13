import { z } from 'zod';
import { emailSchema, passwordSchema } from './common.js';

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
  rememberMe: z.boolean().default(false),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const acceptInvitationSchema = z.object({
  password: passwordSchema,
  consents: z.object({
    terms: z.literal(true, { error: 'You must accept the terms' }),
    privacy: z.literal(true, { error: 'You must accept the privacy notice' }),
  }),
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export interface AuthTokensResponse {
  accessToken: string;
  /** seconds */
  expiresIn: number;
}

export interface SessionSummary {
  id: string;
  deviceLabel: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  current: boolean;
}
