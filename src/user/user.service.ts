import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(createUserDto: CreateUserDto) {
    try {
      const user = await this.prisma.user.create({
        data: {
          name: createUserDto.name,
          email: createUserDto.email,
        },
      });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
      };
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }

  async getUserById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        bids: {
          select: {
            id: true,
            bidAmount: true,
            createdAt: true,
            auction: {
              select: {
                id: true,
                carId: true,
                status: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 10, // Last 10 bids
        },
        wonAuctions: {
          select: {
            id: true,
            carId: true,
            currentHighestBid: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: {
            bids: true,
            wonAuctions: true,
          },
        },
      },
    });
  }
}
