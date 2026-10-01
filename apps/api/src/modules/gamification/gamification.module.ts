import { Module } from '@nestjs/common';
import { GamificationController } from './gamification.controller.js';
import { LeaderboardService } from './leaderboard.service.js';

@Module({
  controllers: [GamificationController],
  providers: [LeaderboardService],
  exports: [LeaderboardService],
})
export class GamificationModule {}
