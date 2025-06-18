import { Module } from '@nestjs/common';
import { AuctionGateway } from './auction.gateway';
import { AuctionService } from './auction.service';
import { AuctionController } from './auction.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    RabbitMQModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: '1d',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuctionController],
  providers: [AuctionGateway, AuctionService],
  exports: [AuctionService],
})
export class AuctionModule {}
