import { Module, forwardRef } from '@nestjs/common';
import { WebSocketGateway } from './websocket.gateway';
import { AuthModule } from '../auth/auth.module';
import { MessageModule } from '../message/message.module';
import { ChatModule } from '../chat/chat.module';
import { UserModule } from '../user/user.module';
import { FriendModule } from '../friend/friend.module';

@Module({
  imports: [AuthModule, MessageModule, ChatModule, UserModule, forwardRef(() => FriendModule)],
  providers: [WebSocketGateway],
  exports: [WebSocketGateway],
})
export class WebSocketModule {}
