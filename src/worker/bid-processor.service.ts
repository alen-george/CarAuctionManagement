/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { RedisService } from '../redis/redis.service';
import { Channel, ConsumeMessage } from 'amqplib';

@Injectable()
export class BidProcessorService implements OnModuleInit {
  private channel!: Channel;
  private readonly logger = new Logger(BidProcessorService.name);

  constructor(
    private readonly rabbit: RabbitmqService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit() {
    this.channel = this.rabbit.getChannel();
    await this.channel.consume(
      'bid-processing',
      (msg) => void this.handle(msg),
      { noAck: false },
    );
    this.logger.log('BidProcessor listening to bid-processing queue');
  }

  private async handle(msg: ConsumeMessage | null): Promise<void> {
    if (!msg) return;

    const rejectToDLQ = () => this.channel.nack(msg, false, false);

    try {
      const payload = JSON.parse(msg.content.toString()) as {
        auctionId: number;
        userId: number;
        bidAmount: number;
        timestamp?: string;
      };

      await this.processBid(payload.auctionId, payload.userId, payload.bidAmount);

      this.channel.ack(msg);
    } catch (err) {
      this.logger.error('Error processing bid', err as Error);
      rejectToDLQ();
    }
  }

  private async processBid(
    auctionId: number,
    userId: number,
    bidAmount: number,
  ): Promise<void> {
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      const succeeded = await this.prisma.$transaction(async (tx) => {
        //  set optimistic lock
        const auction = await tx.auction.findUnique({
          where: { id: auctionId },
          select: {
            currentHighestBid: true,
            status: true,
            version: true,
          },
        });

        if (!auction) throw new Error('Auction not found');
        if (auction.status !== 'ACTIVE') throw new Error('Auction not active');
        if (bidAmount <= auction.currentHighestBid)
          throw new Error('Bid too low');

        // Attempt conditional update
        const { count } = await tx.auction.updateMany({
          where: { id: auctionId, version: auction.version },
          data: {
            currentHighestBid: bidAmount,
            winnerId: userId,
            version: { increment: 1 },
          },
        });

        if (count === 0) {
          return false; // retry
        }

        // Persist bid record
        await tx.bid.create({ data: { auctionId, userId, bidAmount } });
        return true;
      });

      if (succeeded) {
        // Notify once commit succeeds
        await this.publishBidPlaced(auctionId, userId, bidAmount);
        return;
      }

      // add a delay before retry
      await new Promise((r) => setTimeout(r, 50));
    }

    throw new Error('Concurrency conflict – bid could not be applied');
  }

  private async publishBidPlaced(
    auctionId: number,
    userId: number,
    bidAmount: number,
  ): Promise<void> {
    const payload = {
      type: 'BID_PLACED',
      auctionId,
      userId,
      bidAmount,
      timestamp: new Date(),
    } as const;

    await this.rabbit.publishToNotificationQueue(payload);

    await this.redis.publish(`auction:${auctionId}`, JSON.stringify(payload));

    await this.rabbit.publishToAuditQueue({
      event: 'BID_PLACED',
      ...payload,
    });
  }
}

