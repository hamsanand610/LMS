import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { leaderboardQuerySchema } from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../core/auth/decorators.js';
import { LeaderboardService } from './leaderboard.service.js';

@ApiTags('gamification')
@Controller('leaderboard')
@ModuleScope('gamification')
export class GamificationController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  /** The points board for one batch: a learner's own, or one the caller's scope reaches. */
  @RequirePermission('leaderboard:read')
  @Get()
  board(
    @Query({ schema: leaderboardQuerySchema }) query: z.infer<typeof leaderboardQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.leaderboard.board(user, query);
  }
}
