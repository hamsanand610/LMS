import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service.js';

export interface VectorReadiness {
  extension: 'vector';
  /** The database server has pgvector to install (ADR-0026's image). */
  available: boolean;
  /** This database has it installed. */
  installed: boolean;
  /** The installed version, if any. */
  version: string | null;
}

/**
 * Whether this database can hold vectors yet (Roadmap Phase 8A; ADR-0026): read from PostgreSQL's
 * own catalogue, never assumed. Nothing in Phase 8A depends on the answer — the knowledge base has no
 * vector column — and nothing here installs anything: the extension arrives by a Phase 8C migration,
 * once every environment runs the pgvector image.
 */
@Injectable()
export class VectorReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<VectorReadiness> {
    const [available] = await this.prisma.$queryRaw<{ name: string }[]>`
      SELECT name FROM pg_available_extensions WHERE name = 'vector'`;
    const [installed] = await this.prisma.$queryRaw<{ extversion: string }[]>`
      SELECT extversion FROM pg_extension WHERE extname = 'vector'`;
    return {
      extension: 'vector',
      available: Boolean(available),
      installed: Boolean(installed),
      version: installed?.extversion ?? null,
    };
  }
}
