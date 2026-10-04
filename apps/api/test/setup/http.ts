import type { INestApplication } from '@nestjs/common';
import request, { type Response, type Test as SupertestRequest } from 'supertest';
import { API_PREFIX } from '@lms/shared';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

/**
 * A browser-like client: remembers cookies set by the API and sends the CSRF header on mutations,
 * exactly as the web app does. Paths are relative to /api/v1.
 */
export class Session {
  private readonly cookies = new Map<string, string>();

  constructor(private readonly app: INestApplication) {}

  get server(): Parameters<typeof request>[0] {
    return this.app.getHttpServer() as Parameters<typeof request>[0];
  }

  cookie(name: string): string | undefined {
    return this.cookies.get(name);
  }

  /** The Cookie header this session sends, for a request a test builds itself (a stream read as it arrives). */
  cookieHeader(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  login(email: string, password: string, rememberMe = false): Promise<Response> {
    return this.post('/auth/login', { email, password, rememberMe });
  }

  get(path: string): Promise<Response> {
    return this.request('get', path);
  }

  post(path: string, body?: unknown): Promise<Response> {
    return this.request('post', path, body);
  }

  put(path: string, body?: unknown): Promise<Response> {
    return this.request('put', path, body);
  }

  patch(path: string, body?: unknown): Promise<Response> {
    return this.request('patch', path, body);
  }

  delete(path: string): Promise<Response> {
    return this.request('delete', path);
  }

  /** Send a mutation without the CSRF header (to prove the guard rejects it). */
  withoutCsrf(method: Method, path: string, body?: unknown): Promise<Response> {
    return this.request(method, path, body, false);
  }

  private async request(
    method: Method,
    path: string,
    body?: unknown,
    csrf = true,
  ): Promise<Response> {
    let req: SupertestRequest = request(this.server)
      [method](`${API_PREFIX}${path}`)
      .set('Accept', 'application/json');
    if (this.cookies.size)
      req = req.set('Cookie', [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '));
    if (csrf && method !== 'get') req = req.set('x-csrf-token', this.cookies.get('lms_csrf') ?? '');
    if (body !== undefined) req = req.send(body as object);
    const res = await req;
    // Absorb Set-Cookie headers from every response so the session evolves like a browser's.
    this.absorb(res);
    return res;
  }

  private absorb(res: Response): void {
    const header = res.headers['set-cookie'] as string[] | string | undefined;
    const list = Array.isArray(header) ? header : header ? [header] : [];
    for (const raw of list) {
      const [pair, ...attributes] = raw.split(';');
      const eq = pair!.indexOf('=');
      const name = pair!.slice(0, eq).trim();
      const value = pair!.slice(eq + 1).trim();
      const expired = attributes.some((a) => /^\s*(max-age=0|expires=Thu, 01 Jan 1970)/i.test(a));
      if (!value || expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
}

export function problemCode(res: Response): string | undefined {
  return (res.body as { code?: string } | undefined)?.code;
}

/**
 * Asserts a status and, when it differs, fails with the server's own problem document.
 * Without this a mismatch shows only two numbers, which says nothing about the cause.
 */
export function expectStatus(res: Response, expected: number): Response {
  if (res.status !== expected) {
    const body = typeof res.body === 'object' ? JSON.stringify(res.body) : String(res.text ?? '');
    throw new Error(`Expected ${expected} but received ${res.status}: ${body.slice(0, 600)}`);
  }
  return res;
}
