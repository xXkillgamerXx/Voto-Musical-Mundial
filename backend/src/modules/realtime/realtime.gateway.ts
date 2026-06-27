import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RealtimeGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(private readonly redis: RedisService) {}

  async afterInit() {
    await this.redis.subscriber.psubscribe('poll:*:votes');
    this.redis.subscriber.on('pmessage', (_pattern, channel, message) => {
      const pollId = channel.split(':')[1];
      const payload = JSON.parse(message);
      this.server.to(`poll:${pollId}`).emit('vote_delta', payload);
      this.server.to(`poll:${pollId}`).emit('results_dirty', {
        pollId,
        roundId: payload.roundId || null,
      });
    });
    this.logger.log('Realtime gateway subscribed to Redis vote channels');
  }

  @SubscribeMessage('join_poll')
  joinPoll(@ConnectedSocket() client: Socket, @MessageBody() body: { pollId: string }) {
    if (!body?.pollId) return { ok: false };
    client.join(`poll:${body.pollId}`);
    return { ok: true, room: `poll:${body.pollId}` };
  }

  @SubscribeMessage('leave_poll')
  leavePoll(@ConnectedSocket() client: Socket, @MessageBody() body: { pollId: string }) {
    if (!body?.pollId) return { ok: false };
    client.leave(`poll:${body.pollId}`);
    return { ok: true };
  }
}
