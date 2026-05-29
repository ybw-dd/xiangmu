import { Module, forwardRef } from '@nestjs/common';
import { FriendService } from './friend.service';
import { FriendController } from './friend.controller';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [forwardRef(() => WebSocketModule)],
  controllers: [FriendController],
  providers: [FriendService],
  exports: [FriendService],
})
export class FriendModule {}
