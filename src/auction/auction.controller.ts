import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuctionService } from './auction.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { PlaceBidDto } from './dto/place-bid.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('auctions')
@ApiBearerAuth('JWT')
@Controller('auctions')
export class AuctionController {
  constructor(private readonly auctionService: AuctionService) {}

  @Post()
  async createAuction(@Body() createAuctionDto: CreateAuctionDto) {
    return this.auctionService.createAuction(createAuctionDto);
  }

  @Get()
  async getAllAuctions() {
    return this.auctionService.getAllAuctions();
  }

  @Get(':id')
  async getAuction(@Param('id', ParseIntPipe) id: number) {
    return this.auctionService.getAuction(id);
  }

  @Post(':id/bids')
  @UseGuards(JwtAuthGuard)
  async placeBid(
    @Param('id', ParseIntPipe) auctionId: number,
    @Body() placeBidDto: PlaceBidDto,
    @Req() req: any,
  ) {
    const userId = (req as unknown as { user: { sub: number } }).user.sub;
    return this.auctionService.placeBid(
      auctionId,
      userId,
      placeBidDto.bidAmount,
    );
  }

  @Put(':id/activate')
  @UseGuards(JwtAuthGuard)
  async activate(@Param('id', ParseIntPipe) id: number) {
    return this.auctionService.activateAuction(id);
  }

  @Put(':id/end')
  @UseGuards(JwtAuthGuard)
  async endAuction(@Param('id', ParseIntPipe) id: number) {
    return this.auctionService.endAuction(id);
  }

  @Get(':id/bids')
  async getAuctionBids(@Param('id', ParseIntPipe) id: number) {
    return this.auctionService.getAuctionBids(id);
  }
}
