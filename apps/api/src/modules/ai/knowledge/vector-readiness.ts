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
 * Whether this database holds vectors (Roadmap Phase 8A; ADR-0026): read from PostgreSQL's own
 * catalogue, never assumed. Nothing here installs anything: Phase 8C's migration installs the
 * extension, on the pgvector image every environment now runs (ADR-0035), and the embeddings live
 * in a table of their own.
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
