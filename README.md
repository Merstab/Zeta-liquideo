<!-- <img src="/logo.svg"> -->

# Zeta-liquideo: real-time WS market data API for Zeta Markets

<br/>

\*\*_Collects Zeta Futures Markets Data Only_
<br/>

## Getting started

Select market by **market index** using [**assetName**]-[**marketIndex**] e.g SOL-22

Select market by **expiry index** using [**assetName**]/[**expiryIndex**] e.g SOL/1

Run the code snippet below in the browser Dev Tools directly or in Node.js

```js
// connect to zeta-liquideo server running locally
const ws = new WebSocket('ws://localhost:8000/v1/ws');

ws.onmessage = (message) => {
  console.log(JSON.parse(message.data));
};

ws.onopen = () => {
  // subscribe both to trades and level2 real-time channels
  const subscribeL3 = {
    op: 'subscribe',
    channel: 'trades',
    markets: ['SOL-22']
  };

  const subscribeL2 = {
    op: 'subscribe',
    channel: 'level2',
    markets: ['SOL/1']
  };

  ws.send(JSON.stringify(subscribeL3));
  ws.send(JSON.stringify(subscribeL2));
};
```

<br/>

# Installation

### npx <sub>(requires Node.js >= 15 && Node.js < 17 and git installed on host machine)</sub>

Installs and starts zeta-liquideo server running on port `8000`.

```sh
npx ynpx zeta-liquideo
```

or

```sh
npx zeta-liquideo
```

If you'd like to switch to different Solana RPC node endpoint like for example devnet one, change port or run with debug logs enabled, just add one of the available CLI options.

```sh
npx ynpx zeta-liquideo --cluster devnet --endpoint default --ws-endpoint-port 8899 --log-level debug --port 8900
```

Alternatively you can install zeta-liquideo globally.

```sh
yarn global add zeta-liquideo
zeta-liquideo
```

<br/>

#### CLI options

| &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; name &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;&nbsp; &nbsp; &nbsp; &nbsp; &nbsp;&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; | default                        | description                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `port`                                                                                                                                                                                                                                                                                                  | 8000                           | Port to bind server on                                                                                                                                                                             |
| `endpoint`                                                                                                                                                                                                                                                                                              | https://ssc-dao.genesysgo.net/ | Solana RPC node endpoint that zeta-liquideo uses as a data source. To use default public api, set `default`                                                                                        |
| `ws-endpoint-port`                                                                                                                                                                                                                                                                                      | -                              | Optional Solana RPC WS node endpoint port that zeta-liquideo uses as a data source (if different than REST endpoint port) source                                                                   |
| `log-level`                                                                                                                                                                                                                                                                                             | info                           | Log level, available options: debug, info, warn and error                                                                                                                                          |
| `minions-count`                                                                                                                                                                                                                                                                                         | 1                              | [Minions worker threads](#architecture) count that are responsible for broadcasting normalized WS messages to connected clients                                                                    |
| `boot-delay`                                                                                                                                                                                                                                                                                            | 500                            | Staggered boot delay in milliseconds so public RPC nodes do not rate limit 01-flask                                                                                                                |
| `commitment`                                                                                                                                                                                                                                                                                            | confirmed                      | [Solana commitment level](https://docs.solana.com/developing/clients/jsonrpc-api#configuring-state-commitment) to use when communicating with RPC node, available options: confirmed and processed |
| `cluster`                                                                                                                                                                                                                                                                                               | `mainnet-beta`                 | Solana cluster to connect to                                                                                                                                                                       |
| `throttle-ms`                                                                                                                                                                                                                                                                                           | 1000                           | Throttle delay if running into rate-limiting issues loading zeta exchange on start-up                                                                                                              |

<br/>

Run `npx zeta-liquideo --help` or `npx ynpx zeta-liquideo --help` to see all available startup options.

<br/>
<br/>

#### Subscribe/unsubscribe message format

- see [supported channels & corresponding data messages types](#supported-channels--corresponding-message-types)
- see [supported markets](#supported-markets)

```ts
{
  "op": "subscribe" | "unsubscribe",
  "channel": "level3" | "level2" | "level1" | "trades",
  "markets": string[]
}
```

##### sample `subscribe` message

```json
{
  "op": "subscribe",
  "channel": "level2",
  "markets": ["SOL-22"]
}
```

<br/>

#### Subscription confirmation message format

Once a subscription (or unsubscription) request is processed by the server, it will push `subscribed` (or `unsubscribed`) confirmation message or `error` if received request message was invalid.

```ts
{
"type": "subscribed" | "unsubscribed",
"channel": "level3" | "level2" | "level1" | "trades",
"markets": string[],
"timestamp": string
}
```

##### sample `subscribed` confirmation message

```json
{
  "type": "subscribed",
  "channel": "level2",
  "markets": ["SOL-22"],
  "timestamp": "2022-05-03T06:23:26.465Z"
}
```

<br/>

#### Error message format

Error message is pushed for invalid subscribe/unsubscribe messages - non existing market, invalid channel name etc.

```ts
{
  "type": "error",
  "message": "string",
  "timestamp": "string"
}
```

##### sample `error` message

```json
{
  "type": "error",
  "message": "Invalid channel provided: 'levels1'.",
  "timestamp": "2021-03-23T17:13:31.010Z"
}
```

<br/>
<br/>

### Supported channels & corresponding message types

When subscribed to the channel, server will push the data messages as specified below.

- `trades`

  - [`recent_trades`](#recent_trades)
  - [`trade`](#trade)

- `level1`

  - [`quote`](#quote)

- `level2`

  - [`l2snapshot`](#l2snapshot)
  - [`l2update`](#l2update)

- `level3`

  - [`l3snapshot`](#l3snapshot)
  - [`open`](#open)
  - [`fill`](#fill)
  - [`change`](#change)
  - [`done`](#done)

<br/>
<br/>

### Supported markets

Markets supported by zeta-liquideo server can be queried via [`GET /markets`](#get-markets) HTTP endpoint (`[].alias` field).

<br/>
<br/>

### Data messages

- `type` is determining message's data type so it can be handled appropriately

- `timestamp` when message has been received from node RPC API in [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) format with milliseconds, for example: "2021-03-23T17:03:03.994Z"

- `slot` is a [Solana's slot](https://docs.solana.com/terminology#slot) number for which message has produced

- `version` of Serum DEX program layout (DEX version)

- `price` and `size` are provided as strings to preserve precision

<br/>

#### `recent_trades`

Up to 100 recent trades pushed immediately after successful subscription confirmation.

- every trade in `trades` array has the same format as [`trade`](#trade) message
- trades are ordered from oldest to newest

```ts
{
  "type": "recent_trades",
  "market": string,
  "trades": Trade[],
  "timestamp": string
}
```

#### sample `recent_trades` message

```json
{
  "type": "recent_trades",
  "market": "SOL-22",
  "timestamp": "2021-03-24T07:05:27.377Z",
  "trades": [
    {
      "type": "trade",
      "market": "SOL-22",
      "timestamp": "2021-12-23T14:31:16.733Z",
      "slot": 112915164,
      "version": 3,
      "id": "3313016788894161792503559|3313035235638235438412464",
      "side": "sell",
      "price": "40.599",
      "size": "125.4",
      "takerAccount": "AAddgLu9reZCUWW1bNQFaXrCMAtwQpMRvmeusgk4pCM6",
      "makerAccount": "EpAdzaqV13Es3x4dukfjFoCrKVXnZ7y9Y76whgMHo5qx",
      "takerOrderId": "3313016788894161792503559",
      "makerOrderId": "3313035235638235438412464",
      "takerClientId": "875345",
      "makerClientId": "875345",
      "takerFeeCost": -3.2,
      "makerFeeCost": 15.4
    }
  ]
}
```

<br/>

#### `trade`

Pushed real-time for each trade as it happens on a DEX (decoded from the `eventQueue` account).

- `side` describes a liquidity taker side

- `id` field is an unique id constructed by joining fill taker and fill maker order id

```ts
{
  "type": "trade",
  "market": string,
  "timestamp": string,
  "slot": number,
  "version": number,
  "id": string,
  "side": "buy" | "sell",
  "price": string,
  "size": string,
  "takerAccount": string,
  "makerAccount": string,
  "takerOrderId": string,
  "makerOrderId": string,
  "takerClientId": string,
  "makerClientId": string,
  "takerFeeCost": number,
  "makerFeeCost": number
}
```

#### sample `trade` message

```
{
  "type": "trade",
  "market": "SOL-22",
  "timestamp": "2021-12-23T14:31:16.733Z",
  "slot": 112915164,
  "version": 3,
  "id": "3313016788894161792503559|3313035235638235438412464",
  "side": "sell",
  "price": "40.599",
  "size": "125.4",
  "takerAccount": "AAddgLu9reZCUWW1bNQFaXrCMAtwQpMRvmeusgk4pCM6",
  "makerAccount": "EpAdzaqV13Es3x4dukfjFoCrKVXnZ7y9Y76whgMHo5qx",
  "takerOrderId": "3313016788894161792503559",
  "makerOrderId": "3313035235638235438412464",
  "takerClientId": "875345",
  "makerClientId": "875345",
  "takerFeeCost": -3.2,
  "makerFeeCost": 15.4
}
```

<br/>

### `quote`

Pushed real-time for any change in best bid/ask price or size for a given market (decoded from the `bids` and `asks` accounts).

- `bestAsk` and `bestBid` are tuples where first item is a price and second is a size of the best bid/ask level

```ts
{
  "type": "quote",
  "market": string,
  "timestamp": string,
  "slot": number,
  "version": number,
  "bestAsk": [price: string, size: string] | undefined,
  "bestBid": [price: string, size: string] | undefined
}
```

#### sample `quote` message

```json
{
  "type": "quote",
  "market": "SOL-22",
  "timestamp": "2021-03-24T07:11:57.186Z",
  "slot": 70544253,
  "version": 3,
  "bestAsk": ["41.1", "5.0960"],
  "bestBid": ["40.6", "7.5000"]
}
```

<br/>

### `l2snapshot`

Entire up-to-date order book snapshot with orders aggregated by price level pushed immediately after successful subscription confirmation.

- `asks` and `bids` arrays contain tuples where first item of a tuple is a price level and second one is a size of the resting orders at that price level

- it can be pushed for an active connection as well when underlying server connection to the RPC node has been restarted, in such scenario locally maintained order book should be re-initialized with a new snapshot

- together with [`l2update`](#l2update) messages it can be used to maintain local up-to-date full order book state

```ts
{
  "type": "l2snapshot",
  "market": string,
  "timestamp": string,
  "slot": number,
  "version": number,
  "asks": [price: string, size: string][],
  "bids": [price: string, size: string][]
}
```

#### sample `l2snapshot` message

```json
{
  "type": "l2snapshot",
  "market": "SOL-22",
  "timestamp": "2021-03-24T09:00:53.087Z",
  "slot": 70555623,
  "version": 3,
  "asks": [
    ["40.4633", "8.6208"],
    ["40.4743", "5.8632"],
    ["40.4964", "3.7627"]
  ],
  "bids": [
    ["40.3860", "4.8541"],
    ["40.3701", "6.8054"],
    ["40.2863", "8.6631"]
  ]
}
```

<br/>

### `l2update`

Pushed real-time for any change to the order book for a given market with updated price levels and sizes since the previous update (decoded from the `bids` and `asks` accounts).

- together with [`l2snapshot`](#l2snapshot), `l2update` messages can be used to maintain local up-to-date full order book state

- `asks` and `bids` arrays contain updates which are provided as a tuples where first item is an updated price level and second one is an updated size of the resting orders at that price level (absolute value, not delta)

- if size is set to `0` it means that such price level does not exist anymore and shall be removed from locally maintained order book

```ts
{
  "type": "l2update",
  "market": string,
  "timestamp": string,
  "slot": number,
  "version": number,
  "asks": [price: string, size: string][],
  "bids": [price: string, size: string][]
}
```

#### sample `l2update` message

```json
{
  "type": "l2update",
  "market": "SOL-22",
  "timestamp": "2021-03-24T09:00:55.586Z",
  "slot": 70555627,
  "version": 3,
  "asks": [["40.5115", "7.5000"]],
  "bids": [
    ["40.4216", "0.0000"],
    ["40.4336", "5.9475"]
  ]
}
```

<br/>

### `l3snapshot`

Entire up-to-date order book snapshot with **all individual orders** pushed immediately after successful subscription confirmation.

- `clientId` is an client provided order id for an order

- `account` is an open orders account address

- `accountSlot` is a an open orders account slot number

- together with [`open`](#open), [`change`](#change), [`fill`](#fill) and [`done`](#done) messages it can be used to maintain local up to date Level 3 order book state

- it can be pushed for an active connection as well when underlying server connection to the RPC node has been restarted, in such scenario locally maintained L3 order book should be re-initialized with a new snapshot

```ts
{
  "type": "l3snapshot",
  "market": string,
  "timestamp": string,
  "slot": number,
  "version": number,
  "asks": {
    "price": string,
    "size": string,
    "side": "sell",
    "orderId": string,
    "clientId": string,
    "account": string,
    "accountSlot": number,
    "feeTier": number
  }[],
  "bids": {
    "price": string,
    "size": string,
    "side": "buy",
    "orderId": string,
    "clientId": string,
    "account": string,
    "accountSlot": number,
    "feeTier": number
  }[]
}
```

#### sample `l3snapshot` message

```json
{
  "type": "l3snapshot",
  "market": "SOL-22",
  "timestamp": "2021-03-24T09:49:51.070Z",
  "slot": 70560748,
  "version": 3,
  "asks": [
    {
      "orderId": "10430028906948338708824594",
      "clientId": "13065347387987527730",
      "side": "sell",
      "price": "40.5413",
      "size": "4.9049",
      "account": "EXkXcPkqFwqJPXpJdTHMdvmLE282PRShqwMTteWcfz85",
      "accountSlot": 8,
      "feeTier": 3
    }
  ],
  "bids": [
    {
      "orderId": "10414533641926422683532775",
      "clientId": "1616579378239885365",
      "side": "buy",
      "price": "40.4572",
      "size": "7.5000",
      "account": "6Yqus2UYf1wSaKBE4GSLeE2Ge225THeyPcgWBaoGzx3e",
      "accountSlot": 10,
      "feeTier": 6
    }
  ]
}
```

### `open`

Pushed real-time for every new order opened on the limit order book (decoded from the `bids` and `asks` accounts).

- **no** `open` messages are pushed for order that are filled or canceled immediately, for example - `ImmediateOrCancel` orders

```ts
{
  "type": "open",
  "market": string,
  "timestamp": string,
  "slot": number,
  "version": number,
  "orderId": string,
  "clientId": string,
  "side": "buy" | "sell",
  "price": string,
  "size": string,
  "account": string,
  "accountSlot": number,
  "feeTier": number
}
```

#### sample `open` message

```json
{
  "type": "open",
  "market": "SOL-22",
  "timestamp": "2021-03-24T10:14:33.967Z",
  "slot": 70563387,
  "version": 3,
  "orderId": "10395754856459386361922812",
  "clientId": "1616580865182472471",
  "side": "sell",
  "price": "40.3555",
  "size": "7.5000",
  "account": "6Yqus2UYf1wSaKBE4GSLeE2Ge225THeyPcgWBaoGzx3e",
  "accountSlot": 6,
  "feeTier": 6
}
```

<br/>

### `change`

Pushed real-time anytime order size changes as a result of self-trade prevention (decoded from the `bids` and `asks` accounts).

- `size` field contains updated order size

```ts
{
  "type": "change",
  "market": string,
  "timestamp": string,
  "slot": number,
  "version": number,
  "orderId": string,
  "clientId": string,
  "side": "buy" | "sell",
  "price": string,
  "size": string,
  "account": string,
  "accountSlot": number,
  "feeTier": number
}
```

#### sample `change` message

```json
{
  "type": "change",
  "market": "SOL-22",
  "timestamp": "2021-03-24T10:25:21.739Z",
  "slot": 70564525,
  "version": 3,
  "orderId": "10352165200213210691454558",
  "clientId": "15125925100673159264",
  "side": "sell",
  "price": "40.1192",
  "size": "8.4494",
  "account": "EXkXcPkqFwqJPXpJdTHMdvmLE282PRShqwMTteWcfz85",
  "accountSlot": 6,
  "feeTier": 3
}
```

<br/>

### `fill`

Pushed real-time anytime trade happens (decoded from the `eventQueue` accounts).

- there are always two `fill` messages for a trade, one for a maker and one for a taker order

- `feeCost` is provided in a quote currency

```ts
{
  "type": "fill",
  "market": string,
  "timestamp": string,
  "slot": number,
  "version": number,
  "orderId": string,
  "clientId": string,
  "side": "buy" | "sell",
  "price": string,
  "size": string,
  "maker" boolean,
  "feeCost" number,
  "account": string,
  "accountSlot": number,
  "feeTier": number
}
```

#### sample `fill` message

```json
{
  "type": "fill",
  "market": "SOL-22",
  "timestamp": "2021-03-24T11:27:21.739Z",
  "slot": 70564527,
  "version": 3,
  "orderId": "1035216520046710691454558",
  "clientId": "151259251006473159264",
  "side": "sell",
  "price": "40.1192",
  "size": "8.4494",
  "maker": false,
  "feeCost": 15.6,
  "account": "EXkXcPkqFwqJPXpJdTHMdvmLE282PRShqwMTteWcfz85",
  "accountSlot": 6,
  "feeTier": 3
}
```

<br/>

### `done`

Pushed real-time when the order is no longer on the order book (decoded from the `eventQueue` accounts).

- this message can result from an order being canceled or filled (`reason` field)

- there will be no more messages for this `orderId` after a `done` message

- it can be pushed for orders that were never `open` in the order book in the first place (`ImmediateOrCancel` orders for example)

- `sizeRemaining` field is available only since v1.3.2 and only for canceled orders (`reason="canceled"`)

```ts
{
  "type": "done",
  "market": string,
  "timestamp": string,
  "slot": number,
  "version": number,
  "orderId": string,
  "clientId": string,
  "side": "buy" | "sell",
  "reason" : "canceled" | "filled",
  "sizeRemaining": string | undefined
  "account": string,
  "accountSlot": number
}
```

### sample `done` message

```json
{
  "type": "done",
  "market": "SOL-22",
  "timestamp": "2021-11-16T12:29:12.180Z",
  "slot": 107165458,
  "version": 3,
  "orderId": "117413526029161279193704",
  "clientId": "4796015225289787768",
  "side": "buy",
  "reason": "canceled",
  "account": "AqeHe31ZUDgEUSidkh3gEhkf7iPn8bSTJ6c8L9ymp8Vj",
  "accountSlot": 0,
  "sizeRemaining": "508.5"
}
```

###

<br/>
<br/>

## HTTP API

### GET `/markets`

Returns Zeta markets list supported by zeta-liquideo instance (it can be updated by providing custom markets.json file).

<br/>

### Endpoint URL

- [http://localhost:8000/v1/markets](http://localhost:8000/v1/markets) - assuming zeta-liquideo runs locally on default port without SSL enabled

<br/>

### Response format

```ts
{
  "name": string,
  "alias": string[];
  "asset": number;
  "marketIndex": number;
  "expiryIndex": number;
  "baseMintAddress": string,
  "quoteMintAddress": string,
  "version": number,
  "address": string,
  "programId": string,
  "baseCurrency": string,
  "quoteCurrency": string,
  "tickSize": number,
  "minOrderSize": number,
}[]
```

#### sample response

```json
[
  {
    "name": "SOL-22",
    "alias": ["SOL-22", "SOL/0"],
    "asset": 0,
    "marketIndex": 22,
    "expiryIndex": 0,
    "version": 3,
    "address": "652F3eya36Lk9qLa5gMNGQYT1mEKdcLGkiUbxUztSJAh",
    "programId": "zDEXqXEG7gAyxb1Kg9mK5fPnUdENCGKzWrM21RMdWRq",
    "baseMintAddress": "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E",
    "quoteMintAddress": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "tickSize": 0.000001,
    "minOrderSize": 1
  }
]
```

<br/>
<br/>

## References

- tardis-dev [Mango-bowl](https://github.com/tardis-dev/mango-bowl)
- tardis-dev [Serum-vial](https://github.com/tardis-dev/serum-vial)
