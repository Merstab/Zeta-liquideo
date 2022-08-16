import { Connection, PublicKey } from '@solana/web3.js';
import { assets, constants, Exchange, Network, utils } from '@zetamarkets/sdk';
import { assetToName } from '@zetamarkets/sdk/dist/assets';
import fetch from 'node-fetch';
import WebSocket from 'ws';
import { bootServer, stopServer, DataMessage, ZetaListMarketItem, SubRequest, SuccessResponse } from '../dist';
import { wait } from '../dist/helpers';

const PORT = 8989;
const TIMEOUT = 180 * 1000;
const WS_ENDPOINT = `ws://localhost:${PORT}/v1/ws`;

async function fetchMarkets() {
  const response = await fetch(`http://localhost:${PORT}/v1/markets`);

  return (await response.json()) as ZetaListMarketItem[];
}
async function getSolMarket() {
  const customEndpoint = 'https://ssc-dao.genesysgo.net/';
  const mainnet: 'mainnet' | 'devnet' = 'mainnet';

  const programId =
    mainnet == 'mainnet'
      ? new PublicKey('ZETAxsqBRek56DhiGXrn75yj2NHU3aYUnxvHXpkf3aD')
      : new PublicKey('BG3oRikW8d16YjUEmX3ZxHm9SiJzrGtMhsSR8aCw1Cd7');

  const defaultUrl = mainnet == 'mainnet' ? constants.CLUSTER_URLS.mainnet : constants.CLUSTER_URLS.devnet;

  const networkUrl = customEndpoint || defaultUrl;

  const network = mainnet == 'mainnet' ? Network.MAINNET : Network.DEVNET;

  const connection = new Connection(networkUrl, utils.defaultCommitment());

  await Exchange.load(
    [assets.Asset.SOL], // Can be one or more depending on what you wish to trade
    // PROGRAM_ID,
    programId,
    // Network.DEVNET,
    network,
    connection,
    utils.defaultCommitment(),
    undefined, // Exchange wallet can be ignored for normal clients.
    10000, // ThrottleMs - increase if you are running into rate limit issues on startup.
    undefined // Callback - See below for more details.
  );

  // const allEx = Exchange.getAllSubExchanges()
  const sol22 = Exchange.getMarket(assets.Asset.SOL, 22);

  await Exchange.close();

  return {
    name: assetToName(sol22.asset) + '-' + sol22.marketIndex,
    alias: [assetToName(sol22.asset) + '-' + sol22.marketIndex, assetToName(sol22.asset) + '/' + sol22.expiryIndex],
    asset: sol22.asset,
    expiryIndex: sol22.expiryIndex,
    marketIndex: sol22.marketIndex,
    address: sol22.address.toBase58(),
    dexPId: sol22.serumMarket.programId.toBase58()
  };
}

describe('zeta-liquideo', () => {
  beforeAll(async () => {
    const sol22 = await getSolMarket();
    await bootServer({
      port: PORT,
      commitment: 'confirmed',
      markets: [sol22],
      minionsCount: 1,
      nodeEndpoint: 'https://ssc-dao.genesysgo.net/',
      wsEndpointPort: undefined,
      bootDelay: 0
    });
  }, TIMEOUT);

  afterAll(async () => {
    await stopServer();
  }, TIMEOUT);

  test(
    'HTTP GET /markets',
    async () => {
      const markets = await fetchMarkets();

      expect(markets).toMatchSnapshot();
    },
    TIMEOUT
  );

  test(
    'WS trades data stream',
    async () => {
      const wsClient = new SimpleWebsocketClient(WS_ENDPOINT);
      const markets = await fetchMarkets();

      const subscribeRequest: SubRequest = {
        op: 'subscribe',
        channel: 'trades',
        markets: markets.map((m) => m.name)
      };

      let receivedSubscribed = false;
      let receivedRecentTrades = false;

      await wsClient.send(subscribeRequest);
      let messagesCount = 0;

      for await (const message of wsClient.stream()) {
        if (message.type === 'subscribed') {
          receivedSubscribed = true;
        }

        if (message.type === 'recent_trades') {
          receivedRecentTrades = true;
        }

        messagesCount++;
        if (messagesCount == 2) {
          break;
        }
      }

      expect(messagesCount).toBe(2);
      expect(receivedSubscribed).toBe(true);
      expect(receivedRecentTrades).toBe(true);
    },
    TIMEOUT
  );

  test(
    'WS level1 data stream',
    async () => {
      const wsClient = new SimpleWebsocketClient(WS_ENDPOINT);
      const markets = await fetchMarkets();

      const subscribeRequest: SubRequest = {
        op: 'subscribe',
        channel: 'level1',
        markets: markets.map((m) => m.name)
      };

      await wsClient.send(subscribeRequest);
      let l1MessagesCount = 0;
      let receivedSubscribed = false;
      let receivedQuoteMessage = false;

      for await (const message of wsClient.stream()) {
        if (message.type === 'subscribed') {
          receivedSubscribed = true;
        }

        if (message.type === 'quote') {
          receivedQuoteMessage = true;
        }

        l1MessagesCount++;
        if (l1MessagesCount == 2) {
          break;
        }
      }

      expect(l1MessagesCount).toBe(2);
      expect(receivedSubscribed).toBe(true);
      expect(receivedQuoteMessage).toBe(true);
    },
    TIMEOUT
  );

  test(
    'WS level2 data stream',
    async () => {
      const wsClient = new SimpleWebsocketClient(WS_ENDPOINT);
      const markets = await fetchMarkets();
      let receivedSubscribed = false;
      let receivedSnapshot = false;

      const subscribeRequest: SubRequest = {
        op: 'subscribe',
        channel: 'level2',
        markets: markets.map((m) => m.name)
      };

      await wsClient.send(subscribeRequest);
      let l2MessagesCount = 0;

      for await (const message of wsClient.stream()) {
        if (message.type === 'subscribed') {
          receivedSubscribed = true;
        }

        if (message.type === 'l2snapshot') {
          receivedSnapshot = true;
        }

        l2MessagesCount++;
        if (l2MessagesCount == 5) {
          break;
        }
      }

      expect(l2MessagesCount).toBe(5);
      expect(receivedSnapshot).toBe(true);
      expect(receivedSubscribed).toBe(true);
    },
    TIMEOUT
  );

  test(
    'WS level3 data stream',
    async () => {
      const wsClient = new SimpleWebsocketClient(WS_ENDPOINT);
      const markets = await fetchMarkets();

      const subscribeRequest: SubRequest = {
        op: 'subscribe',
        channel: 'level3',
        markets: markets.map((m) => m.name)
      };

      let receivedSubscribed = false;
      let receivedSnapshot = false;

      await wsClient.send(subscribeRequest);
      let l3MessagesCount = 0;

      for await (const message of wsClient.stream()) {
        if (message.type === 'subscribed') {
          receivedSubscribed = true;
        }

        if (message.type === 'l3snapshot') {
          receivedSnapshot = true;
        }

        l3MessagesCount++;
        if (l3MessagesCount == 5) {
          break;
        }
      }

      expect(l3MessagesCount).toBe(5);
      expect(receivedSubscribed).toBe(true);
      expect(receivedSnapshot).toBe(true);
    },
    TIMEOUT
  );

  class SimpleWebsocketClient {
    private readonly _socket: WebSocket;

    constructor(url: string) {
      this._socket = new WebSocket(url);
    }

    public async send(payload: any) {
      while (this._socket.readyState !== WebSocket.OPEN) {
        await wait(100);
      }
      this._socket.send(JSON.stringify(payload));
    }

    public async *stream() {
      const realtimeMessagesStream = (WebSocket as any).createWebSocketStream(this._socket, {
        readableObjectMode: true
      }) as AsyncIterableIterator<Buffer>;

      for await (let messageBuffer of realtimeMessagesStream) {
        const message = JSON.parse(messageBuffer as any);
        yield message as DataMessage | SuccessResponse;
      }
    }
  }
});
