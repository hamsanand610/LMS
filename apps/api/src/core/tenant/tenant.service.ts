import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface OrganizationContext {
  id: string;
  key: string;
  name: string;
  timezone: string;
  locale: string;
}

/**
 * Single-tenant per deployment: returns the one organisation row (created by the base seed).
 * This is the only place that changes if a host-based tenant resolver is introduced later.
 */
@Injectable()
export class TenantService {
  private cached: OrganizationContext | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async getOrganization(): Promise<OrganizationContext> {
    if (this.cached) return this.cached;
    const org = await this.prisma.organization.findUnique({
      where: { key: this.config.CLIENT_KEY },
    });
    if (!org) {
      throw new Error(
        `Organisation "${this.config.CLIENT_KEY}" does not exist. Run "pnpm db:seed" to create it (CLIENT_KEY selects the client overlay).`,
      );
    }
    this.cached = {
      id: org.id,
      key: org.key,
      name: org.name,
      timezone: org.timezone,
      locale: org.locale,
    };
    return this.cached;
  }

  invalidate(): void {
    this.cached = null;
  }
}
