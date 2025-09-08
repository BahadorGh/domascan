-- CreateTable
CREATE TABLE "Name" (
    "id" VARCHAR(255) NOT NULL,
    "sld" TEXT NOT NULL,
    "tld" TEXT NOT NULL,
    "registrarId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Name_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "id" VARCHAR(255) NOT NULL,
    "nameId" TEXT NOT NULL,
    "owner" VARCHAR(64) NOT NULL,
    "chainId" VARCHAR(32) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "lockStatus" BOOLEAN NOT NULL DEFAULT false,
    "royaltyBps" INTEGER NOT NULL DEFAULT 0,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "synthetic" BOOLEAN NOT NULL DEFAULT false,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" VARCHAR(255) NOT NULL,
    "tokenId" TEXT NOT NULL,
    "orderbook" TEXT NOT NULL,
    "chainId" VARCHAR(32) NOT NULL,
    "price" DECIMAL(78,0) NOT NULL,
    "currency" VARCHAR(64) NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" VARCHAR(255) NOT NULL,
    "tokenId" TEXT NOT NULL,
    "orderbook" TEXT NOT NULL,
    "chainId" VARCHAR(32) NOT NULL,
    "price" DECIMAL(78,0) NOT NULL,
    "currency" VARCHAR(64) NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" VARCHAR(255) NOT NULL,
    "tokenId" TEXT NOT NULL,
    "scopeType" VARCHAR(32) NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "txHash" VARCHAR(80),
    "blockNumber" BIGINT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Command" (
    "id" VARCHAR(255) NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Command_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventCursor" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastId" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "number" BIGINT NOT NULL,
    "hash" VARCHAR(66) NOT NULL,
    "parentHash" VARCHAR(66) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "txCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("number")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "hash" VARCHAR(66) NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "from" VARCHAR(64) NOT NULL,
    "to" VARCHAR(64),
    "value" DECIMAL(78,0) NOT NULL,
    "success" BOOLEAN NOT NULL,
    "methodSig" VARCHAR(10),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "SmtSnapshot" (
    "id" SERIAL NOT NULL,
    "root" VARCHAR(66) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmtSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmtLeaf" (
    "key" VARCHAR(255) NOT NULL,
    "valueHash" VARCHAR(66) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmtLeaf_pkey" PRIMARY KEY ("key")
);

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_nameId_fkey" FOREIGN KEY ("nameId") REFERENCES "Name"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_blockNumber_fkey" FOREIGN KEY ("blockNumber") REFERENCES "Block"("number") ON DELETE RESTRICT ON UPDATE CASCADE;
