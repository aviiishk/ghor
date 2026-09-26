import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

@Injectable()
export class PushTokensService {
  constructor(private readonly prisma: PrismaService) {}

  // A user may have multiple devices (root CLAUDE.md §14.4) — upsert on
  // (userId, expoPushToken) so re-registering the same token (e.g. every app launch)
  // never creates duplicate rows, it just refreshes deviceId.
  //
  // A device token belongs to ONE user at a time (code review 2026-09-26): when user B
  // signs in on a phone user A used, B's registration removes A's row for that token —
  // otherwise A's chat messages kept arriving as notifications on B's screen.
  async register(userId: string, dto: RegisterPushTokenDto) {
    const [, row] = await this.prisma.$transaction([
      this.prisma.pushToken.deleteMany({
        where: { expoPushToken: dto.expoPushToken, userId: { not: userId } },
      }),
      this.prisma.pushToken.upsert({
        where: {
          userId_expoPushToken: { userId, expoPushToken: dto.expoPushToken },
        },
        create: {
          userId,
          expoPushToken: dto.expoPushToken,
          deviceId: dto.deviceId,
        },
        update: { deviceId: dto.deviceId },
      }),
    ]);
    return row;
  }

  // Sign-out on a device: stop pushing this user's notifications to it.
  async unregister(userId: string, expoPushToken: string) {
    const { count } = await this.prisma.pushToken.deleteMany({
      where: { userId, expoPushToken },
    });
    return { removed: count };
  }
}
