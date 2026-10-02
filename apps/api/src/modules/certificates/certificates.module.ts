import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/index.js';
import {
  MeCertificatesController,
  PublicCertificatesController,
} from './certificates.controller.js';
import { CertificatesService } from './certificates.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [MeCertificatesController, PublicCertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
