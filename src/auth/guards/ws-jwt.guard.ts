import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() === 'ws') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = context.switchToWs().getClient() as any;
      const token = client.handshake.auth.token;

      if (!token) {
        throw new WsException('Authentication token not found');
      }

      try {
        const payload = await this.jwtService.verifyAsync(token);
        // Attach user to socket for later use
        client.user = payload;
        return true;
      } catch (error) {
        throw new WsException('Invalid authentication token');
      }
    }

    return true;
  }
}
