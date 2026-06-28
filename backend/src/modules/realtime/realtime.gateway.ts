import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MetricsService } from '../metrics/metrics.service';
import { RedisService } from '../redis/redis.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly redis: RedisService,
    private readonly metrics: MetricsService,
  ) {}

  handleConnection() {
    this.metrics.incRealtime();
  }

  handleDisconnect() {
    this.metrics.decRealtime();
  }

  async afterInit() {
    await this.redis.subscriber.psubscribe('poll:*:votes', 'poll:*:state', 'poll:*:comment', 'user:*:events');
    this.redis.subscriber.on('pmessage', (_pattern, channel, message) => {
      const parts = channel.split(':');
      const scope = parts[0];
      const id = parts[1];
      const kind = parts[2];
      let payload: any = {};
      try {
        payload = JSON.parse(message);
      } catch {
        payload = {};
      }

      if (scope === 'user' && kind === 'events') {
        this.server.to(`user:${id}`).emit('user_event', { userId: id, ...payload });
        return;
      }

      if (kind === 'comment') {
        this.server.to(`poll:${id}`).emit('comment_event', { pollId: id, ...payload });
        return;
      }

      if (kind === 'state') {
        const statePayload = {
          pollId: id,
          ...payload,
        };
        this.server.to(`poll:${id}`).emit('poll_state_changed', statePayload);
        this.server.to('polls:live').emit('poll_state_changed', statePayload);
        this.server.to(`poll:${id}`).emit('results_dirty', {
          pollId: id,
          roundId: payload.roundId || null,
        });
        return;
      }

      this.server.to(`poll:${id}`).emit('vote_delta', payload);
      this.server.to(`poll:${id}`).emit('results_dirty', {
        pollId: id,
        roundId: payload.roundId || null,
      });
    });
    this.logger.log('Realtime gateway subscribed to Redis vote/state/user channels');
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

  @SubscribeMessage('join_live_polls')
  joinLivePolls(@ConnectedSocket() client: Socket) {
    client.join('polls:live');
    return { ok: true, room: 'polls:live' };
  }

  @SubscribeMessage('leave_live_polls')
  leaveLivePolls(@ConnectedSocket() client: Socket) {
    client.leave('polls:live');
    return { ok: true };
  }

  @SubscribeMessage('join_user')
  joinUser(@ConnectedSocket() client: Socket, @MessageBody() body: { userId: string }) {
    if (!body?.userId) return { ok: false };
    client.join(`user:${body.userId}`);
    return { ok: true, room: `user:${body.userId}` };
  }

  @SubscribeMessage('leave_user')
  leaveUser(@ConnectedSocket() client: Socket, @MessageBody() body: { userId: string }) {
    if (!body?.userId) return { ok: false };
    client.leave(`user:${body.userId}`);
    return { ok: true };
  }
}
