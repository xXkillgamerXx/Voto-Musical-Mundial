import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  readonly startedAt = Date.now();
  private requests = 0;
  private realtime = 0;

  incRequest() {
    this.requests += 1;
  }

  incRealtime() {
    this.realtime += 1;
  }

  decRealtime() {
    this.realtime = Math.max(0, this.realtime - 1);
  }

  snapshot() {
    const uptimeMs = Date.now() - this.startedAt;
    const uptimeMinutes = uptimeMs / 60000;

    return {
      uptimeSeconds: Math.floor(uptimeMs / 1000),
      requests: this.requests,
      requestsPerMinute: uptimeMinutes > 0 ? Math.round(this.requests / uptimeMinutes) : this.requests,
      realtimeConnections: this.realtime,
    };
  }
}
