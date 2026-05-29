import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { validate as isUUID } from 'uuid';

@Injectable()
export class ParseUUIDPipe implements PipeTransform<string> {
  transform(value: string): string {
    if (!isUUID(value)) {
      throw new BadRequestException(`"${value}" 不是有效的 UUID`);
    }
    return value;
  }
}
