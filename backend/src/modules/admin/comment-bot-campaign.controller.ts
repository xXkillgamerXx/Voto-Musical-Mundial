import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CommentBotCampaignService } from './comment-bot-campaign.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.superadmin, UserRole.owner)
export class CommentBotCampaignController {
  constructor(private readonly campaigns: CommentBotCampaignService) {}

  @Post('polls/:pollId/comment-bot-campaigns/suggest-messages')
  async suggestMessages(@Param('pollId') pollId: string, @Body() body: any) {
    return this.campaigns.suggestMessages({
      pollId,
      topic: String(body.topic || body.brief || body.prompt || ''),
      count: Number(body.count ?? body.totalComments ?? 25),
      artistId: body.artistId ? String(body.artistId) : undefined,
      artistName: body.artistName ? String(body.artistName) : undefined,
      rivalArtistName: body.rivalArtistName ? String(body.rivalArtistName) : undefined,
    });
  }

  @Post('polls/:pollId/comment-bot-campaigns')
  async create(@Param('pollId') pollId: string, @Body() body: any) {
    return this.campaigns.create({
      pollId,
      totalComments: Number(body.totalComments ?? body.comments ?? 0),
      botsCount: Number(body.botsCount ?? body.bots ?? 0),
      durationMinutes: Number(body.durationMinutes ?? body.duration ?? 0),
      messages: body.messages,
      topic: body.topic ? String(body.topic) : undefined,
      artistId: body.artistId ? String(body.artistId) : undefined,
      artistName: body.artistName ? String(body.artistName) : undefined,
      rivalArtistName: body.rivalArtistName ? String(body.rivalArtistName) : undefined,
      createdBy: body.createdBy ? String(body.createdBy) : null,
    });
  }

  @Get('polls/:pollId/comment-bot-campaigns')
  async listForPoll(@Param('pollId') pollId: string) {
    return this.campaigns.listForPoll(pollId);
  }

  @Get('comment-bot-campaigns/:id')
  async detail(@Param('id') id: string) {
    return this.campaigns.getDetail(id);
  }

  @Post('comment-bot-campaigns/:id/cancel')
  async cancel(@Param('id') id: string) {
    return this.campaigns.cancel(id);
  }

  @Post('comment-bot-campaigns/:id/delete-comments')
  async deleteComments(@Param('id') id: string) {
    return this.campaigns.deleteComments(id);
  }
}
