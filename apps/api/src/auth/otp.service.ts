import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Clock } from '../common/clock';
import { SMS_SENDER, type SmsSender } from './sms-sender';

const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute
// Security review 2026-09-26: the 60s cooldown alone allowed ~1,440 SMS per number per
// day (SMS pumping runs up the SMS bill once a real provider is wired) and a fresh set
// of 5 guesses every minute. Cap sends per number per rolling 24h.
const OTP_DAILY_LIMIT = 10;
const OTP_MAX_ATTEMPTS = 5;

// Phone-OTP challenge engine shared by marketplace login (AuthService) and admin-console
// login (AdminAuthService). Extracted unchanged from AuthService (2026-09-29) so both
// paths get identical brute-force and SMS-pumping protections.
@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
  ) {}

  async send(phone: string): Promise<void> {
    const now = this.clock.now().getTime();
    const recent = await this.prisma.phoneOtp.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });
    if (recent && now - recent.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      throw new BadRequestException(
        'Please wait before requesting another code',
      );
    }
    const sentToday = await this.prisma.phoneOtp.count({
      where: { phone, createdAt: { gte: new Date(now - 24 * 60 * 60 * 1000) } },
    });
    if (sentToday >= OTP_DAILY_LIMIT) {
      throw new BadRequestException(
        'Too many codes requested for this number today. Try again tomorrow.',
      );
    }

    const code = randomInt(0, 10 ** OTP_LENGTH)
      .toString()
      .padStart(OTP_LENGTH, '0');
    const codeHash = await bcrypt.hash(code, 10);
    const row = await this.prisma.phoneOtp.create({
      data: {
        phone,
        codeHash,
        createdAt: new Date(now),
        expiresAt: new Date(now + OTP_TTL_MS),
      },
    });
    try {
      await this.sms.sendOtp(phone, code);
    } catch (e) {
      // An undeliverable code must not count against the cooldown/daily cap.
      await this.prisma.phoneOtp
        .delete({ where: { id: row.id } })
        .catch(() => {});
      throw e;
    }
  }

  // Verifies and consumes the latest code for `phone`. Throws UnauthorizedException with a
  // specific message; callers that must not leak detail (admin login) map it to a
  // generic one.
  async verifyAndConsume(phone: string, code: string): Promise<void> {
    const record = await this.prisma.phoneOtp.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) {
      throw new UnauthorizedException('No code was requested for this number');
    }
    if (record.expiresAt < this.clock.now()) {
      throw new UnauthorizedException('Code has expired, request a new one');
    }
    // Claim an attempt BEFORE comparing, atomically (code review 2026-09-26): the old
    // read-check-compare-increment let N parallel guesses all pass the `attempts < 5`
    // check first. Now each guess must win a conditional increment.
    const claimed = await this.prisma.phoneOtp.updateMany({
      where: { id: record.id, attempts: { lt: OTP_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count === 0) {
      throw new UnauthorizedException(
        'Too many incorrect attempts, request a new code',
      );
    }
    const valid = await bcrypt.compare(code, record.codeHash);
    if (!valid) throw new UnauthorizedException('Incorrect code');

    // Consume atomically too: two parallel requests with the right code can't both log in.
    const consumed = await this.prisma.phoneOtp.deleteMany({
      where: { id: record.id },
    });
    if (consumed.count === 0) {
      throw new UnauthorizedException(
        'Code has already been used, request a new one',
      );
    }
  }
}
