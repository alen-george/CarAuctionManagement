import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { RedisService } from '../../redis/redis.service';

// interface WsClient {
//   handshake?: {
//     address?: string;
//     auth?: { userId?: string };
//   };
// }

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() === 'ws') {
      const client = context.switchToWs().getClient();
      const ip = client.handshake?.address || 'unknown';
      const userId = client.handshake?.auth?.userId;

      // Rate limit - IP
      const ipKey = `ratelimit:ip:${ip}`;
      const ipCount = await this.redisService.get(ipKey);
      if (ipCount && parseInt(ipCount) > 100) {
        // 100 requests per minute per IP
        throw new WsException('Too many requests from this IP');
      }

      // Rate limit - user
      if (userId) {
        const userKey = `ratelimit:user:${userId}`;
        const userCount = await this.redisService.get(userKey);
        if (userCount && parseInt(userCount) > 50) {
          // 50 requests per minute per user
          throw new WsException('Too many requests from this user');
        }
        // Increment user counter
        await this.redisService.set(
          userKey,
          (parseInt(userCount || '0') + 1).toString(),
          60,
        );
      }

      // Increment IP counter
      await this.redisService.set(
        ipKey,
        (parseInt(ipCount || '0') + 1).toString(),
        60,
      );

      return true;
    }

    return true;
  }
}
