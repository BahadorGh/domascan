import axios, { AxiosInstance } from 'axios';
import { Injectable } from '@nestjs/common';
import { GraphQLClient, gql } from 'graphql-request';

@Injectable()
export class DomaClient {
    private rest: AxiosInstance;
    private gql: GraphQLClient;

    constructor() {
        const baseURL = process.env.DOMA_API_BASE ?? 'https://api-testnet.doma.xyz';
        const apiKey = process.env.DOMA_API_KEY ?? '';
        const gqlEndpoint = process.env.DOMA_GRAPHQL_ENDPOINT ?? 'https://api-testnet.doma.xyz/graphql';

        this.rest = axios.create({ baseURL, headers: { 'Api-Key': apiKey } });
        this.gql = new GraphQLClient(gqlEndpoint, { headers: { 'Api-Key': apiKey } as any });
    }

    // Poll API
    async poll(params?: { eventTypes?: string[]; limit?: number; finalizedOnly?: boolean }) {
        const search = new URLSearchParams();
        if (params?.eventTypes) params.eventTypes.forEach((t) => search.append('eventTypes', t));
        if (params?.limit) search.append('limit', String(params.limit));
        if (params?.finalizedOnly !== undefined) search.append('finalizedOnly', String(params.finalizedOnly));
        const url = `/v1/poll${search.toString() ? `?${search.toString()}` : ''}`;
        const { data } = await this.rest.get(url);
        return data as { events: any[]; lastId: number; hasMoreEvents: boolean };
    }

    async pollAck(lastEventId: number) {
        await this.rest.post(`/v1/poll/ack/${lastEventId}`);
    }

    async pollReset(eventId: number) {
        await this.rest.post(`/v1/poll/reset/${eventId}`);
    }

    // Orderbook API
    async getOrderbookFees(orderbook: string, chainId: string, contractAddress: string) {
        const { data } = await this.rest.get(`/v1/orderbook/fee/${orderbook}/${chainId}/${contractAddress}`);
        return data;
    }

    async getSupportedCurrencies(chainId: string, contractAddress: string, orderbook: string) {
        const { data } = await this.rest.get(`/v1/orderbook/currencies/${chainId}/${contractAddress}/${orderbook}`);
        return data as { currencies: any[] };
    }

    async getListingFulfillment(orderId: string, buyer: string) {
        const { data } = await this.rest.get(`/v1/orderbook/listing/${orderId}/${buyer}`);
        return data;
    }

    async getOfferFulfillment(orderId: string, fulfiller: string) {
        const { data } = await this.rest.get(`/v1/orderbook/offer/${orderId}/${fulfiller}`);
        return data;
    }

    async createListing(payload: any) {
        const { data } = await this.rest.post(`/v1/orderbook/list`, payload);
        return data as { orderId: string };
    }

    async createOffer(payload: any) {
        const { data } = await this.rest.post(`/v1/orderbook/offer`, payload);
        return data as { orderId: string };
    }

    async cancelListing(orderId: string, signature: string) {
        const { data } = await this.rest.post(`/v1/orderbook/listing/cancel`, { orderId, signature });
        return data as { orderId: string };
    }

    async cancelOffer(orderId: string, signature: string) {
        const { data } = await this.rest.post(`/v1/orderbook/offer/cancel`, { orderId, signature });
        return data as { orderId: string };
    }

    // Subgraph queries (minimal set)
    async queryNames(variables: { limit?: number; offset?: number; tld?: string }) {
        const query = gql`
      query Names($limit: Int, $offset: Int, $tld: String) {
        names(limit: $limit, offset: $offset, tld: $tld) { items { id sld tld } pageInfo { total } }
      }
    `;
        return this.gql.request(query, variables);
    }

    async queryTokens(variables: { limit?: number; offset?: number; owner?: string }) {
        const query = gql`
      query Tokens($limit: Int, $offset: Int, $owner: String) {
        tokens(limit: $limit, offset: $offset, owner: $owner) { items { id owner chainId expiresAt name { id sld tld } } pageInfo { total } }
      }
    `;
        return this.gql.request(query, variables);
    }
}
