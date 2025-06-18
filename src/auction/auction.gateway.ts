import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger } from '@nestjs/common';
import { AuctionService } from './auction.service';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { RedisService } from '../redis/redis.service';

interface BidData {
  auctionId: number;
  bidAmount: number;
}

interface AuctionResult {
  winner: {
    id: number;
    name: string;
    email: string;
  } | null;
  finalBid: number | null;
}

interface AuctionResponse {
  event: string;
  data: unknown;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'auction',
})
export class AuctionGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(AuctionGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly auctionService: AuctionService,
    private readonly redisService: RedisService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      // Implement connection logic here
      this.logger.log(`Client connected: ${client.id}`);
      await this.validateConnection(client);
    } catch (error) {
      this.logger.error(
        `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      client.disconnect();
    }
  }

  private async validateConnection(client: Socket): Promise<void> {
    const key = `ws:ip:${client.handshake.address}`;
    const cnt = await this.redisService.incr(key);
    if (cnt > 5) throw new WsException('Too many sockets from this IP');
    await this.redisService.expire(key, 60);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @UseGuards(WsJwtGuard, RateLimitGuard)
  @SubscribeMessage('joinAuction')
  async handleJoinAuction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { auctionId: number },
  ): Promise<AuctionResponse> {
    try {
      const { auctionId } = data;
      await client.join(`auction-${auctionId}`);

      const auction = await this.auctionService.getAuction(auctionId);
      return {
        event: 'auctionJoined',
        data: auction,
      };
    } catch (error) {
      this.logger.error(
        `Join auction error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return {
        event: 'error',
        data: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  @UseGuards(WsJwtGuard, RateLimitGuard)
  @SubscribeMessage('placeBid')
  async handlePlaceBid(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: BidData,
  ): Promise<AuctionResponse> {
    try {
      const { auctionId, bidAmount } = data;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const userId = (client as unknown as { user?: { sub: number } }).user
        ?.sub;
      if (!userId) {
        throw new WsException('Unauthenticated');
      }

      const bid = await this.auctionService.placeBid(
        auctionId,
        userId,
        bidAmount,
      );

      // Broadcast the new bid to all clients in the auction room
      this.server.to(`auction-${auctionId}`).emit('bidPlaced', {
        auctionId,
        bidAmount,
        userId,
        timestamp: new Date(),
      });

      return {
        event: 'bidAccepted',
        data: bid,
      };
    } catch (error) {
      this.logger.error(
        `Place bid error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return {
        event: 'error',
        data: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('auctionEnd')
  async handleAuctionEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { auctionId: number },
  ): Promise<AuctionResponse> {
    try {
      const { auctionId } = data;
      const result = (await this.auctionService.endAuction(
        auctionId,
      )) as unknown as AuctionResult;

      this.server.to(`auction-${auctionId}`).emit('auctionEnded', {
        auctionId,
        winner: result.winner,
        finalBid: result.finalBid,
      });

      return {
        event: 'auctionEnded',
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Auction end error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return {
        event: 'error',
        data: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async onModuleInit() {
    // check for backend-generated events via Redis and forward to WS clients
    await this.redisService.psubscribe(
      'auction:*',
      async (_channel, message) => {
        try {
          const data = JSON.parse(message) as {
            type: string;
            auctionId: number;
            [k: string]: unknown;
          };

          const room = `auction-${data.auctionId}`;

          switch (data.type) {
            case 'BID_PLACED':
              this.server.to(room).emit('bidPlaced', data);
              break;
            case 'AUCTION_ENDED':
              this.server.to(room).emit('auctionEnded', data);
              break;
            case 'AUCTION_ACTIVATED':
              this.server.to(room).emit('auctionActivated', data);
              break;
            default:
              break;
          }
        } catch (err) {
          this.logger.error('Failed to relay Redis event', err as Error);
        }
      },
    );
  }
}
