import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * File-less bulk send: a JSON list of already-normalized phones plus one
 * message. Replaces the CSV download/upload round trip — the caller (gym
 * backend) owns the client data, so there is no file to parse.
 */
export class BulkDirectDto {
  @ApiProperty({
    example: ['+59891234567', '+59891234568'],
    description: 'Recipient phone numbers in E.164 format',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  // Hard sanity ceiling; the configurable BULK_MAX_ROWS limit lives in BulkService.
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  @Matches(/^\+[1-9]\d{1,14}$/, {
    each: true,
    message: 'each recipient must be in E.164 format (e.g., +598...)',
  })
  to!: string[];

  @ApiProperty({
    example: 'Hello from Plus Fit!',
    description: 'Message sent to every recipient; line breaks are preserved',
    maxLength: 4096,
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'message must not be blank' })
  @MaxLength(4096)
  message!: string;
}
