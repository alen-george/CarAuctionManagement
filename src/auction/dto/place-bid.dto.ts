import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class PlaceBidDto {
  @ApiProperty({ example: 1500, description: 'Bid amount' })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  bidAmount: number;
}
