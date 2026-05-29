import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '@lingxun/types';

@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get('messages')
  async searchMessages(
    @Query('q') query: string,
    @Query('page') page = 1,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.searchService.searchMessages(query, user.sub, Number(page));
  }
}
