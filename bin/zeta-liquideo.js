#!/usr/bin/env node

const path = require('path');
const yargs = require('yargs');
const isDocker = require('is-docker');
const pkg = require('../package.json');

const DEFAULT_PORT = 8000;
const DEFAULT_NODE_ENDPOINT = 'https://ssc-dao.genesysgo.net/';

const argv = yargs
  .scriptName('zeta-liquideo')
  .env('ZL_')
  .strict()

  .option('port', {
    type: 'number',
    describe: 'Port to bind server on',
    default: DEFAULT_PORT
  })

  .option('endpoint', {
    type: 'string',
    describe: 'Solana RPC node endpoint that zeta-liquideo uses as a data source',
    default: DEFAULT_NODE_ENDPOINT
  })

  .option('ws-endpoint-port', {
    type: 'number',
    describe:
      'Optional Solana RPC WS node endpoint port that zeta-liquideo uses as a data source (if different than REST endpoint port)',
    default: undefined
  })

  .option('log-level', {
    type: 'string',
    describe: 'Log level',
    choices: ['debug', 'info', 'warn', 'error'],
    default: 'info'
  })
  .option('minions-count', {
    type: 'number',
    describe:
      'Minions worker threads count that are responsible for broadcasting normalized WS messages to connected clients',
    default: 1
  })

  .option('commitment', {
    type: 'string',
    describe: 'Solana commitment level to use when communicating with RPC node',
    choices: ['processed', 'confirmed', 'finalized'],
    default: 'confirmed'
  })

  .option('boot-delay', {
    type: 'string',
    describe: 'Staggered boot delay in milliseconds so public RPC nodes do not rate limit zeta-liquideo',
    default: 500
  })

  .option('cluster', {
    type: 'string',
    describe: 'Solana cluster to connect to',
    choices: ['devnet', 'mainnet-beta'],
    default: 'mainnet-beta'
  })

  .option('throttle-ms', {
    type: 'string',
    describe: 'Throttle delay if running into rate-limiting issues loading zeta exchange on start-up',
    default: 1000
  })

  .help()
  .version()
  .usage('$0 [options]')
  .example(`$0 --endpoint ${DEFAULT_NODE_ENDPOINT}`)
  .epilogue('See https://github.com/Merstab/zeta-liquideo for more information.')
  .detectLocale(false).argv;

// if port ENV is defined use it otherwise use provided options
const port = process.env.PORT ? +process.env.PORT : argv['port'];
process.env.LOG_LEVEL = argv['log-level'];

const { bootServer, logger, getZetaPerpMarkets } = require('../dist');

async function start() {
  let markets = await getZetaPerpMarkets(argv['cluster'], argv['endpoint'], argv['throttle-ms']);

  const options = {
    port,
    nodeEndpoint: argv['endpoint'],
    wsEndpointPort: argv['ws-endpoint-port'],
    minionsCount: argv['minions-count'],
    commitment: argv['commitment'],
    bootDelay: argv['boot-delay']
  };

  logger.log('info', 'Starting zeta-liquideo server with options', options);

  const startTimestamp = new Date().valueOf();
  await bootServer({
    ...options,
    markets
  });

  const bootTimeSeconds = Math.ceil((new Date().valueOf() - startTimestamp) / 1000);

  if (isDocker()) {
    logger.log('info', `Zeta-liquideo v${pkg.version} is running inside Docker container.`, { bootTimeSeconds });
  } else {
    logger.log('info', `Zeta-liquideo server v${pkg.version} is running on port ${port}.`, { bootTimeSeconds });
  }

  logger.log('info', `See https://github.com/Merstab/zeta-liquideo for more information.`);
}

start();

process
  .on('unhandledRejection', (reason, p) => {
    console.error('Unhandled Rejection at Promise', reason, p);
    process.exit(1);
  })
  .on('uncaughtException', (err) => {
    console.error('Uncaught Exception thrown', err);
    process.exit(1);
  });
