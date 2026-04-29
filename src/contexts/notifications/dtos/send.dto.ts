import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, Matches, MaxLength } from 'class-validator';

export class SendNotificationDto {
  @ApiProperty({ 
    example: 'whatsapp', 
    description: 'The delivery channel for the notification',
    enum: ['whatsapp']
  })
  @IsEnum(['whatsapp'])
  channel!: string;

  @ApiProperty({ 
    example: '+5491112345678', 
    description: 'Recipient phone number in E.164 format' 
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+[1-9]\d{1,14}$/, { message: 'Recipient must be in E.164 format (e.g., +549...)' })
  to!: string;

  @ApiProperty({ 
    example: 'Hello from Plus Fit!', 
    description: 'The text message to be sent (max 1000 characters)',
    maxLength: 1000
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string;
}
