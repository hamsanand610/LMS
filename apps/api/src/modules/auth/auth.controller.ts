import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  acceptInvitationSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  type AcceptInvitationInput,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type LoginInput,
  type ResetPasswordInput,
} from '@lms/shared';
import { type AuthUser, REFRESH_COOKIE } from '../../core/auth/auth-user.js';
import { AuthenticatedOnly, CurrentUser, ModuleScope, Public } from '../../core/auth/decorators.js';
import { APP_CONFIG, type AppConfig } from '../../core/config/env.js';
import { UnauthenticatedError } from '../../core/http/errors.js';
import { RateLimit } from '../../core/rate-limit/rate-limit.decorator.js';
import { AuthService, type IssuedTokens } from './auth.service.js';
import { clearAuthCookies, setAuthCookies } from './cookies.js';

const tokenParam = z.string().min(20).max(200);

@ApiTags('auth')
@Controller('auth')
@ModuleScope('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /*
   * Five tries per account from one address, five per account from everywhere (the account lock is
   * the durable version of that), and a ceiling per address across accounts that a classroom
   * signing in together stays well under.
   */
  @Public()
  @RateLimit({
    points: 5,
    durationSec: 900,
    keyBy: 'ip+body',
    bodyField: 'email',
    valuePoints: 5,
    ipPoints: 150,
  })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body({ schema: loginSchema }) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(body.email, body.password, deviceLabel(req));
    this.applyCookies(res, result.tokens, body.rememberMe);
    return {
      user: result.user,
      accessToken: result.tokens.accessToken,
      expiresIn: result.tokens.expiresIn,
    };
  }

  @Public()
  @RateLimit({ points: 60, durationSec: 300, keyBy: 'ip' })
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request & { cookies?: Record<string, string> },
    @Res({ passthrough: true }) res: Response,
  ) {
    const bodyToken = (req.body as { refreshToken?: unknown } | undefined)?.refreshToken;
    const token =
      req.cookies?.[REFRESH_COOKIE] ?? (typeof bodyToken === 'string' ? bodyToken : undefined);
    if (!token) throw new UnauthenticatedError('No refresh token');
    const tokens = await this.auth.refresh(token, deviceLabel(req));
    this.applyCookies(res, tokens, true);
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  @AuthenticatedOnly()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(user.sessionId, user.id);
    clearAuthCookies(res, this.config);
  }

  @AuthenticatedOnly()
  @Post('logout-all')
  @HttpCode(204)
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logoutAll(user.id);
    clearAuthCookies(res, this.config);
  }

  @AuthenticatedOnly()
  @Get('sessions')
  sessions(@CurrentUser() user: AuthUser) {
    return this.auth.listSessions(user.id, user.sessionId);
  }

  @AuthenticatedOnly()
  @Delete('sessions/:id')
  @HttpCode(204)
  async revokeSession(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: z.uuid() }) id: string,
  ): Promise<void> {
    await this.auth.revokeSession(user.id, id);
  }

  @Public()
  @RateLimit({ points: 10, durationSec: 900, keyBy: 'ip' })
  @Post('invitations/:token/accept')
  @HttpCode(200)
  async acceptInvitation(
    @Param('token', { schema: tokenParam }) token: string,
    @Body({ schema: acceptInvitationSchema }) body: AcceptInvitationInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.acceptInvitation(token, body.password);
    this.applyCookies(res, result.tokens, true);
    return {
      user: result.user,
      accessToken: result.tokens.accessToken,
      expiresIn: result.tokens.expiresIn,
    };
  }

  @Public()
  @RateLimit({
    points: 5,
    durationSec: 900,
    keyBy: 'ip+body',
    bodyField: 'email',
    valuePoints: 5,
    ipPoints: 50,
  })
  @Post('password/forgot')
  @HttpCode(202)
  async forgotPassword(@Body({ schema: forgotPasswordSchema }) body: ForgotPasswordInput) {
    await this.auth.forgotPassword(body.email);
    return { message: 'If an account exists for that email, a reset link has been sent.' };
  }

  @Public()
  @RateLimit({ points: 10, durationSec: 900, keyBy: 'ip' })
  @Post('password/reset')
  @HttpCode(204)
  async resetPassword(
    @Body({ schema: resetPasswordSchema }) body: ResetPasswordInput,
  ): Promise<void> {
    await this.auth.resetPassword(body.token, body.password);
  }

  @AuthenticatedOnly()
  @Post('password/change')
  @HttpCode(200)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body({ schema: changePasswordSchema }) body: ChangePasswordInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.changePassword(user, body.currentPassword, body.newPassword);
    this.applyCookies(res, tokens, true);
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  private applyCookies(res: Response, tokens: IssuedTokens, persistent: boolean): void {
    setAuthCookies(res, this.config, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      csrfToken: tokens.csrfToken,
      persistent,
    });
  }
}

function deviceLabel(req: Request): string | null {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' ? ua.slice(0, 120) : null;
}
