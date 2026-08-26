import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

/** One personalized recipient: their phone and the message built for them. */
export class BulkDirectItemDto {
  @ApiProperty({ example: '+59891234567' })
  @IsString()
  @Matches(E164_REGEX, {
    message: 'each recipient must be in E.164 format (e.g., +598...)',
  })
  to!: string;

  @ApiProperty({ example: 'Hola Ana!' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'message must not be blank' })
  @MaxLength(4096)
  message!: string;
}

/**
 * The two shapes are mutually exclusive: a body carrying both would leave the
 * question "which message wins for a phone in both lists?" unanswered.
 */
@ValidatorConstraint({ name: 'bulkDirectSingleShape', async: false })
class SingleShapeConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const dto = args.object as BulkDirectDto;
    return dto.to === undefined && dto.message === undefined;
  }

  defaultMessage(): string {
    return 'send either items or to+message, not both shapes at once';
  }
}

/**
 * File-less bulk send. Two accepted shapes:
 *
 * - `to` + `message`: one shared message for every phone (original contract).
 * - `items`: one message per recipient, used by the gym backend when the
 *   campaign template carries variables like {nombre}.
 */
export class BulkDirectDto {
  @ApiPropertyOptional({
    example: ['+59891234567', '+59891234568'],
    description: 'Recipient phone numbers in E.164 format (shared-message shape)',
    type: [String],
  })
  @ValidateIf((dto: BulkDirectDto) => dto.items === undefined)
  @IsArray()
  @ArrayNotEmpty()
  // Hard sanity ceiling; the configurable BULK_MAX_ROWS limit lives in BulkService.
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  @Matches(E164_REGEX, {
    each: true,
    message: 'each recipient must be in E.164 format (e.g., +598...)',
  })
  to?: string[];

  @ApiPropertyOptional({
    example: 'Hello from Plus Fit!',
    description: 'Message sent to every recipient; line breaks are preserved',
    maxLength: 4096,
  })
  @ValidateIf((dto: BulkDirectDto) => dto.items === undefined)
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'message must not be blank' })
  @MaxLength(4096)
  message?: string;

  @ApiPropertyOptional({
    description: 'Per-recipient messages (personalized shape); excludes to+message',
    type: [BulkDirectItemDto],
  })
  @ValidateIf((dto: BulkDirectDto) => dto.items !== undefined)
  @Validate(SingleShapeConstraint)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => BulkDirectItemDto)
  items?: BulkDirectItemDto[];
}
