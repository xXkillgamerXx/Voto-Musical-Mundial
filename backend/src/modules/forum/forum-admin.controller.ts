import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminListForumTopicsDto, AdminUpdateForumTopicDto } from './dto/admin-topic.dto';
import { CreateForumCategoryDto, UpdateForumCategoryDto } from './dto/upsert-category.dto';
import { ForumService } from './forum.service';

@Controller('admin/forum')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.superadmin, UserRole.owner)
export class ForumAdminController {
  constructor(private readonly forum: ForumService) {}

  @Get('categories')
  categories() {
    return this.forum.adminCategories();
  }

  @Post('categories')
  createCategory(@Body() body: CreateForumCategoryDto) {
    return this.forum.adminCreateCategory(body);
  }

  @Patch('categories/:slug')
  updateCategory(@Param('slug') slug: string, @Body() body: UpdateForumCategoryDto) {
    return this.forum.adminUpdateCategory(slug, body);
  }

  @Get('topics')
  topics(@Query() query: AdminListForumTopicsDto) {
    return this.forum.adminTopics(query);
  }

  @Patch('topics/:id')
  updateTopic(@Param('id') id: string, @Body() body: AdminUpdateForumTopicDto) {
    return this.forum.adminUpdateTopic(id, body);
  }
}
