/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';
import { Channel } from 'amqplib';

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private connection: amqp.Connection;
  private channel: Channel;

  async onModuleInit() {
    try {
      const rabbitmqUrl =
        process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5673';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      this.connection = await amqp.connect(rabbitmqUrl);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      this.channel = await this.connection.createChannel();

      // Setup queues
      await this.setupQueues();
      console.log('RabbitMQ connected successfully');
    } catch (error) {
      console.error('Failed to connect to RabbitMQ:', error);
      // Don't throw error to prevent app from crashing
    }
  }

  async onModuleDestroy() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    await this.channel?.close();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    await this.connection?.close();
  }

  private async setupQueues() {
    // Bid processing queue
    await this.channel.assertQueue('bid-processing', { durable: true });

    // Notification queue
    await this.channel.assertQueue('notifications', { durable: true });

    // Audit queue
    await this.channel.assertQueue('audit', { durable: true });

    // Dead letter queue
    await this.channel.assertQueue('dead-letters', { durable: true });
  }

  async publishToBidQueue(message: any): Promise<void> {
    if (!this.channel) return;

    await this.channel.sendToQueue(
      'bid-processing',
      Buffer.from(JSON.stringify(message)),
      { persistent: true },
    );
  }

  async publishToNotificationQueue(message: any): Promise<void> {
    if (!this.channel) return;

    await this.channel.sendToQueue(
      'notifications',
      Buffer.from(JSON.stringify(message)),
      { persistent: true },
    );
  }

  async publishToAuditQueue(message: any): Promise<void> {
    if (!this.channel) return;

    await this.channel.sendToQueue(
      'audit',
      Buffer.from(JSON.stringify(message)),
      { persistent: true },
    );
  }

  getChannel(): Channel {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }
    return this.channel;
  }
}
