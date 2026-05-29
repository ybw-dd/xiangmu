import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let error: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.name;
      } else {
        const res = exceptionResponse as Record<string, unknown>;
        message = (res.message as string) || exception.message;
        error = (res.error as string) || exception.name;

        // 处理验证错误数组
        if (Array.isArray(res.message)) {
          message = res.message.join('; ');
        }
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = '服务器内部错误';
      error = exception.message;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = '未知错误';
      error = 'Unknown Error';
    }

    // 记录错误日志
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${status} - ${error}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} ${status} - ${message}`);
    }

    response.status(status).json({
      code: status,
      data: null,
      message,
      timestamp: Date.now(),
      path: request.url,
    });
  }
}
