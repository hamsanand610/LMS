import { Global, Module } from '@nestjs/common';
import { SheetsService } from './sheets.service.js';

/** Spreadsheet reading and writing, shared by the importers and the export jobs. */
@Global()
@Module({
  providers: [SheetsService],
  exports: [SheetsService],
})
export class SheetsModule {}
