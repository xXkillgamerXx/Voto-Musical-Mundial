import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { NoStoreInterceptor } from '../../common/no-store.interceptor';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('account')
@UseInterceptors(NoStoreInterceptor)
export class AccountDeletionController {
  constructor(private readonly users: UsersService) {}

  @Post('deletion-request')
  requestDeletion(@Body() body: unknown) {
    return this.users.requestAccountDeletion(body);
  }

  @Post('deletion-confirm')
  confirmDeletion(@Body() body: unknown) {
    return this.users.confirmAccountDeletion(body);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  deleteMe(@CurrentUser() user: { id: bigint }, @Body() body: unknown) {
    const confirm = String((body as { confirm?: string } | null)?.confirm || '')
      .trim()
      .toUpperCase();
    if (confirm !== 'ELIMINAR' && confirm !== 'DELETE') {
      throw new BadRequestException('Escribe ELIMINAR o DELETE para confirmar.');
    }
    return this.users.deleteOwnAccount(user.id);
  }
}
