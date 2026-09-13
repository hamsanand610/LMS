import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { InvitationService } from './invitation.service.js';

@Module({
  imports: [SettingsModule],
  controllers: [AuthController],
  providers: [AuthService, InvitationService],
  exports: [AuthService, InvitationService],
})
export class AuthModule {}
