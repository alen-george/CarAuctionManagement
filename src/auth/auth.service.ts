import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const payload = { sub: user.id, email: user.email, name: user.name };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: '1d' });
    return { accessToken };
  }
}
