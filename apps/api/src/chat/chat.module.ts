import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { PushModule } from '../push/push.module';

@Module({
  // Same "no global secret/expiry" reasoning as AuthModule — ChatGateway verifies
  // access tokens with a per-call secret via ConfigService, not JwtModule.register()'s
  // module-wide config.
  imports: [JwtModule.register({}), PushModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
})
export class ChatModule {}
