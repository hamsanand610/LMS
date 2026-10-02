import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/index.js';
import {
  MeCertificatesController,
  PublicCertificatesController,
  StaffCertificatesController,
} from './certificates.controller.js';
import { CertificatesService } from './certificates.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [
    MeCertificatesController,
    StaffCertificatesController,
    PublicCertificatesController,
  ],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
