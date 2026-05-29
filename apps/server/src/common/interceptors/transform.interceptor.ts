import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import type { ApiResponse } from '@lingxun/types';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse> {
    return next.handle().pipe(
      map((data) => ({
        code: 200,
        data: data ?? null,
        message: 'success',
        timestamp: Date.now(),
      })),
    );
  }
}
