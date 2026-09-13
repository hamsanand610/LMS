import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { MeController } from './me.controller.js';
import { MeService } from './me.service.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [AuthModule, SettingsModule],
  controllers: [UsersController, MeController],
  providers: [UsersService, MeService],
  exports: [UsersService],
})
export class UsersModule {}
