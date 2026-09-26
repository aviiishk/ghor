import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Global so every feature module (auth, listings, chat, ...) can inject PrismaService
// without importing PrismaModule everywhere — standard Nest+Prisma pattern.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
