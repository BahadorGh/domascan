import { Controller, Get, Param, Post, Body, Query } from '@nestjs/common';
import { DomaClient } from '../services/doma.client.js';

@Controller('marketplace')
export class MarketplaceController {
    constructor(private readonly doma: DomaClient) { }

    @Get('fees')
    fees(@Query('orderbook') orderbook: string, @Query('chainId') chainId: string, @Query('contract') contract: string) {
        return this.doma.getOrderbookFees(orderbook, chainId, contract);
    }

    @Get('currencies')
    currencies(@Query('chainId') chainId: string, @Query('contract') contract: string, @Query('orderbook') orderbook: string) {
        return this.doma.getSupportedCurrencies(chainId, contract, orderbook);
    }

    @Get('listing/:orderId/:buyer')
    listingFulfillment(@Param('orderId') orderId: string, @Param('buyer') buyer: string) {
        return this.doma.getListingFulfillment(orderId, buyer);
    }

    @Get('offer/:orderId/:fulfiller')
    offerFulfillment(@Param('orderId') orderId: string, @Param('fulfiller') fulfiller: string) {
        return this.doma.getOfferFulfillment(orderId, fulfiller);
    }

    @Post('list')
    createListing(@Body() payload: any) {
        return this.doma.createListing(payload);
    }

    @Post('offer')
    createOffer(@Body() payload: any) {
        return this.doma.createOffer(payload);
    }

    @Post('listing/cancel')
    cancelListing(@Body() body: { orderId: string; signature: string }) {
        return this.doma.cancelListing(body.orderId, body.signature);
    }

    @Post('offer/cancel')
    cancelOffer(@Body() body: { orderId: string; signature: string }) {
        return this.doma.cancelOffer(body.orderId, body.signature);
    }
}
