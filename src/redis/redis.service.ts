import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private publisher: Redis;
  private subscriber: Redis;

  onModuleInit() {
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    };

    this.client = new Redis(redisConfig);
    this.publisher = new Redis(redisConfig);
    this.subscriber = new Redis(redisConfig);

    console.log('Redis connected successfully');
  }

  async onModuleDestroy() {
    await this.client?.quit();
    await this.publisher?.quit();
    await this.subscriber?.quit();
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setex(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.publisher.publish(channel, message);
  }

  async subscribe(
    channel: string,
    callback: (message: string) => void,
  ): Promise<void> {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (receivedChannel, message) => {
      if (receivedChannel === channel) {
        callback(message);
      }
    });
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, ttl: number): Promise<void> {
    await this.client.expire(key, ttl);
  }

  async setnx(key: string, value: string): Promise<number> {
    return this.client.setnx(key, value);
  }

  // Pattern based subscription (pub/sub patterns)
  async psubscribe(
    pattern: string,
    callback: (channel: string, message: string) => void,
  ): Promise<void> {
    await this.subscriber.psubscribe(pattern);
    this.subscriber.on('pmessage', (pat, receivedChannel, message) => {
      if (pat === pattern) {
        callback(receivedChannel, message);
      }
    });
  }
}
