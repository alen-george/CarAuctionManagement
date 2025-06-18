import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsDateString,
  Min,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAuctionDto {
  @ApiProperty({ example: 'Al CyberTruck', description: 'Name of the car' })
  @IsNotEmpty()
  @IsString()
  carName: string;

  @ApiProperty({ example: 1000, description: 'Starting bid amount' })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  startingBid: number;

  @ApiProperty({
    example: '2025-07-01T10:00:00Z',
    description: 'Auction start time (ISO string)',
  })
  @IsNotEmpty()
  @IsDateString()
  startTime: string;

  @ApiProperty({
    example: '2025-08-01T10:00:00Z',
    description: 'Auction end time (ISO string)',
  })
  @IsNotEmpty()
  @IsDateString()
  endTime: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(['PENDING', 'ACTIVE', 'ENDED'])
  status?: string = 'ACTIVE'; // using active for now
}
