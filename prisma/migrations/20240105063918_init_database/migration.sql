-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('COIN_TRANSFER', 'CONTRACT_CREATION', 'CONTRACT_TRANSFER');

-- CreateTable
CREATE TABLE "Users" (
    "id" SERIAL NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "balance" TEXT NOT NULL DEFAULT '0',
    "txn" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Blocks" (
    "id" SERIAL NOT NULL,
    "blocknumber" BIGINT NOT NULL,
    "blockhash" VARCHAR(255) NOT NULL,
    "stateRoot" VARCHAR(255) NOT NULL,
    "parentHash" VARCHAR(255) NOT NULL,
    "transactionsRoot" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "transactionCount" BIGINT NOT NULL DEFAULT 0,
    "nonce" BIGINT NOT NULL,
    "miner" VARCHAR(255) NOT NULL,
    "baseFeePerGas" BIGINT NOT NULL,
    "receiptsRoot" VARCHAR(255) NOT NULL,
    "sha3Uncles" VARCHAR(255) NOT NULL,
    "transfer" TEXT NOT NULL DEFAULT '0',
    "deposit" TEXT NOT NULL DEFAULT '0',
    "size" BIGINT NOT NULL,
    "gasLimit" BIGINT NOT NULL,
    "gasUsed" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transactions" (
    "id" SERIAL NOT NULL,
    "blockhash" VARCHAR(255) NOT NULL,
    "blocknumber" BIGINT NOT NULL,
    "txhash" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL DEFAULT 'N/A',
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "type" "TransactionType" NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "fromAddress" VARCHAR(255) NOT NULL,
    "toAddress" VARCHAR(255) NOT NULL,
    "gasPrice" BIGINT NOT NULL DEFAULT 0,
    "gas" BIGINT NOT NULL DEFAULT 0,
    "txFee" VARCHAR(255) NOT NULL DEFAULT '0',
    "value" TEXT NOT NULL DEFAULT '0',
    "token" TEXT NOT NULL DEFAULT '0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinTransaferTx" (
    "id" SERIAL NOT NULL,
    "blockhash" VARCHAR(255) NOT NULL,
    "blocknumber" BIGINT NOT NULL,
    "txhash" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "fromAddress" VARCHAR(255) NOT NULL,
    "toAddress" VARCHAR(255) NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "gasPrice" BIGINT NOT NULL DEFAULT 0,
    "gas" BIGINT NOT NULL DEFAULT 0,
    "value" TEXT NOT NULL DEFAULT '0',
    "txFee" VARCHAR(255) NOT NULL DEFAULT '0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinTransaferTx_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contracts" (
    "id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "blockHash" VARCHAR(255) NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "bytecode" TEXT NOT NULL DEFAULT '',
    "txHash" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "contractName" TEXT NOT NULL,
    "contractType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tokens" (
    "id" SERIAL NOT NULL,
    "creator" TEXT NOT NULL,
    "decimal" DECIMAL(65,30) NOT NULL,
    "totalSupply" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "tokenName" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "blockHash" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holders" (
    "id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "tokenBalance" TEXT NOT NULL,

    CONSTRAINT "Holders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractLogs" (
    "id" SERIAL NOT NULL,
    "txHash" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "blockHash" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "topics" JSONB NOT NULL DEFAULT '[]',
    "methodSignature" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'N/A',
    "gasFee" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractLogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinmarketInfo" (
    "id" SERIAL NOT NULL,
    "price" TEXT NOT NULL,
    "volume24h" TEXT NOT NULL,
    "volumeChange24h" TEXT NOT NULL,
    "percentChange1h" TEXT NOT NULL,
    "percentChange24h" TEXT NOT NULL,
    "percentChange7d" TEXT NOT NULL,
    "percentChange30d" TEXT NOT NULL,
    "symbol" VARCHAR(255) NOT NULL DEFAULT '',
    "currency" VARCHAR(255) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoinmarketInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TxFee" (
    "id" SERIAL NOT NULL,
    "fee" TEXT NOT NULL DEFAULT '0',

    CONSTRAINT "TxFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Validator" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT '',
    "votingPower" BIGINT NOT NULL DEFAULT 0,
    "selfStake" TEXT NOT NULL DEFAULT '',
    "commission" TEXT NOT NULL DEFAULT '',
    "delegatorCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Validator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Users_address_key" ON "Users"("address");

-- CreateIndex
CREATE UNIQUE INDEX "Blocks_blocknumber_key" ON "Blocks"("blocknumber");

-- CreateIndex
CREATE UNIQUE INDEX "Blocks_blockhash_key" ON "Blocks"("blockhash");

-- CreateIndex
CREATE INDEX "Blocks_blocknumber_blockhash_idx" ON "Blocks"("blocknumber", "blockhash");

-- CreateIndex
CREATE UNIQUE INDEX "Transactions_txhash_key" ON "Transactions"("txhash");

-- CreateIndex
CREATE INDEX "Transactions_type_txhash_contractAddress_fromAddress_toAddr_idx" ON "Transactions"("type", "txhash", "contractAddress", "fromAddress", "toAddress");

-- CreateIndex
CREATE UNIQUE INDEX "CoinTransaferTx_txhash_key" ON "CoinTransaferTx"("txhash");

-- CreateIndex
CREATE INDEX "CoinTransaferTx_txhash_fromAddress_toAddress_idx" ON "CoinTransaferTx"("txhash", "fromAddress", "toAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Contracts_address_key" ON "Contracts"("address");

-- CreateIndex
CREATE UNIQUE INDEX "Tokens_contractAddress_key" ON "Tokens"("contractAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Holders_address_key" ON "Holders"("address");

-- CreateIndex
CREATE INDEX "TxFee_fee_idx" ON "TxFee"("fee");

-- CreateIndex
CREATE UNIQUE INDEX "Validator_address_key" ON "Validator"("address");

-- CreateIndex
CREATE INDEX "Validator_selfStake_createdAt_updatedAt_idx" ON "Validator"("selfStake", "createdAt", "updatedAt");

-- AddForeignKey
ALTER TABLE "Tokens" ADD CONSTRAINT "Tokens_contractAddress_fkey" FOREIGN KEY ("contractAddress") REFERENCES "Contracts"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holders" ADD CONSTRAINT "Holders_contractAddress_fkey" FOREIGN KEY ("contractAddress") REFERENCES "Contracts"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractLogs" ADD CONSTRAINT "ContractLogs_contractAddress_fkey" FOREIGN KEY ("contractAddress") REFERENCES "Contracts"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
