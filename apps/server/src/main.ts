import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    },
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('SERVER_PORT', 3001);
  const host = configService.get<string>('SERVER_HOST', '0.0.0.0');

  // 全局前缀
  app.setGlobalPrefix('api', {
    exclude: ['/health', '/socket.io', '/uploads/(.*)'],
  });

  // 静态文件服务（上传文件访问）
  const expressInstance = app.getHttpAdapter().getInstance();
  const uploadsPath = join(__dirname, '..', 'uploads');
  expressInstance.use('/uploads', require('express').static(uploadsPath));

  // 全局管道 - 请求验证
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 全局异常过滤器
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 全局响应拦截器
  app.useGlobalInterceptors(new TransformInterceptor());

  // 信任代理（用于获取真实 IP）
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  await app.listen(port, host);

  logger.log(`==========================================`);
  logger.log(` 灵讯（LingXun）服务端已启动`);
  logger.log(` 地址: http://${host}:${port}`);
  logger.log(` API:  http://${host}:${port}/api`);
  logger.log(` 环境: ${configService.get('NODE_ENV', 'development')}`);
  logger.log(`==========================================`);
}

bootstrap();
