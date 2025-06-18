import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { Auction, User } from 'generated/prisma';

@Injectable()
export class AuctionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rabbitmq: RabbitmqService,
  ) {}

  async getAuction(auctionId: number) {
    try {
      const auction = await this.prisma.auction.findUnique({
        where: { id: auctionId },
        include: {
          winner: {
            select: {
              id: true,
              name: true,
            },
          },
          bids: {
            orderBy: { bidAmount: 'desc' },
            take: 3,
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          _count: {
            select: {
              bids: true,
            },
          },
        },
      });

      if (!auction) {
        throw new NotFoundException('Auction not found');
      }

      return auction;
    } catch (error) {
      console.error('Error fetching auction:', error);
      throw error;
    }
  }

  async placeBid(auctionId: number, userId: number, bidAmount: number) {
    try {
      // Use transaction for concurrency safety
      // Get current auction
      const auction: Auction | null = await this.prisma.auction.findUnique({
        where: { id: auctionId },
      });

      if (!auction) {
        throw new NotFoundException('Auction not found');
      }

      if (auction.status !== 'ACTIVE') {
        throw new BadRequestException('Auction is not active');
      }

      if (new Date() > auction.endTime) {
        throw new BadRequestException('Auction has ended');
      }

      if (bidAmount <= auction.currentHighestBid) {
        throw new BadRequestException(
          'Bid amount must be higher than current highest bid',
        );
      }

      // Verify user exists
      const user: User | null = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Queue for processing
      await this.rabbitmq.publishToBidQueue({
        auctionId,
        userId,
        bidAmount,
        timestamp: new Date(),
      });

      return {
        auction,
        user,
      };
    } catch (error) {
      console.error('Error placing bid:', error);
      throw error;
    }
  }

  async endAuction(auctionId: number) {
    try {
      const auction = await this.prisma.auction.update({
        where: { id: auctionId },
        data: { status: 'ENDED' },
        include: {
          winner: {
            select: {
              id: true,
              name: true,
            },
          },
          bids: {
            orderBy: { bidAmount: 'desc' },
            take: 1,
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      // Publish auction end event
      await this.redis.publish(
        `auction:${auctionId}`,
        JSON.stringify({
          type: 'AUCTION_ENDED',
          auctionId,
          winnerId: auction.winnerId,
          winnerName: auction.winner?.name,
          winningBid: auction.currentHighestBid,
          timestamp: new Date(),
        }),
      );

      // Queue notification
      await this.rabbitmq.publishToNotificationQueue({
        type: 'AUCTION_ENDED',
        auctionId,
        winnerId: auction.winnerId,
        winningBid: auction.currentHighestBid,
      });

      return auction;
    } catch (error) {
      console.error('Error ending auction:', error);
      throw error;
    }
  }

  async activateAuction(auctionId: number) {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
    });
    if (!auction) {
      throw new NotFoundException('Auction not found');
    }
    // if (auction.status !== 'PENDING') {
    //   throw new BadRequestException('Auction already active or ended');
    // }
    // if (auction.startTime > new Date()) {
    //   throw new BadRequestException('Auction start time is in the future');
    // }

    const updated = await this.prisma.auction.update({
      where: { id: auctionId },
      data: { status: 'ACTIVE' },
    });

    // notify subscribers
    await this.redis.publish(
      `auction:${auctionId}`,
      JSON.stringify({
        type: 'AUCTION_ACTIVATED',
        auctionId,
        timestamp: new Date(),
      }),
    );

    await this.rabbitmq.publishToNotificationQueue({
      type: 'AUCTION_ACTIVATED',
      auctionId,
    });

    return updated;
  }

  async createAuction(createAuctionDto: CreateAuctionDto) {
    const startTime = new Date(createAuctionDto.startTime);
    const endTime = new Date(createAuctionDto.endTime);

    if (startTime >= endTime) {
      throw new BadRequestException('End time must be after start time');
    }

    if (startTime <= new Date()) {
      throw new BadRequestException('Start time must be in the future');
    }

    const auction = await this.prisma.auction.create({
      data: {
        carId: createAuctionDto.carName,
        startingBid: createAuctionDto.startingBid,
        currentHighestBid: createAuctionDto.startingBid,
        startTime,
        endTime,
        status: 'ACTIVE', // using active for now
      },
    });

    // Cache the auction
    await this.redis.set(
      `auction:${auction.id}`,
      JSON.stringify(auction),
      3600, // 1 hour TTL
    );

    // Publish auction created event
    await this.rabbitmq.publishToNotificationQueue({
      type: 'AUCTION_CREATED',
      auctionId: auction.id,
      carId: auction.carId,
      startTime: auction.startTime,
      endTime: auction.endTime,
    });

    return auction;
  }

  async getAllAuctions() {
    return this.prisma.auction.findMany({
      include: {
        winner: {
          select: {
            id: true,
            name: true,
          },
        },
        bids: {
          orderBy: { bidAmount: 'desc' },
          take: 1,
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            bids: true,
          },
        },
      },
      orderBy: {
        startTime: 'desc',
      },
    });
  }

  async getAuctionBids(auctionId: number) {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
    });

    if (!auction) {
      throw new NotFoundException('Auction not found');
    }

    return this.prisma.bid.findMany({
      where: { auctionId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        bidAmount: 'desc',
      },
    });
  }
}
