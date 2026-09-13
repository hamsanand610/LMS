export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

export interface EmailDriver {
  readonly name: string;
  send(message: EmailMessage): Promise<{ id: string | null }>;
  healthCheck(): Promise<{ ok: boolean; detail?: string }>;
}

export const EMAIL_DRIVER = Symbol('EMAIL_DRIVER');
