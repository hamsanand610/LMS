import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { searchQuerySchema, type SearchType } from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../core/auth/decorators.js';
import { RateLimit } from '../../core/rate-limit/rate-limit.decorator.js';
import { SearchService } from './search.service.js';

@ApiTags('search')
@Controller('search')
@ModuleScope('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @RequirePermission('search:use')
  @RateLimit({ points: 120, durationSec: 60, keyBy: 'user' })
  @Get()
  find(
    @Query({ schema: searchQuerySchema })
    query: { q: string; types?: SearchType[]; limit: number },
    @CurrentUser() user: AuthUser,
  ) {
    return this.search.search(user, query);
  }
}
