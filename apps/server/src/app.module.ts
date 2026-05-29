import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './config/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { FriendModule } from './modules/friend/friend.module';
import { ChatModule } from './modules/chat/chat.module';
import { MessageModule } from './modules/message/message.module';
import { GroupModule } from './modules/group/group.module';
import { WebSocketModule } from './modules/websocket/websocket.module';
import { MediaModule } from './modules/media/media.module';
import { AIModule } from './modules/ai/ai.module';
import { SearchModule } from './modules/search/search.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { HealthController } from './health.controller';

@Module({
  imports: [
    // 环境变量配置
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // 基础设施
    PrismaModule,
    RedisModule,

    // 业务模块
    AuthModule,
    UserModule,
    FriendModule,
    ChatModule,
    MessageModule,
    GroupModule,
    WebSocketModule,
    MediaModule,
    AIModule,
    SearchModule,
  ],
  controllers: [HealthController],
  providers: [
    // 全局 JWT 鉴权守卫
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
