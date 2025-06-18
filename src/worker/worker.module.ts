import { Module } from '@nestjs/common';
import { BidProcessorService } from './bid-processor.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, RabbitMQModule, RedisModule],
  providers: [BidProcessorService],
})
export class WorkerModule {}
