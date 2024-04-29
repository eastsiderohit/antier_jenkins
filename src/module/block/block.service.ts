import { convertBigIntToNumber } from '../../helper/common.helper';
import Web3Helper from '../../helper/web3.helper';
import { RES_MSG, QUEUE_NAME, CONST_NAME } from '../../constant/response';
import { IESResponse } from '../../interfaces/index';
import { RabbitMqService } from '../../service/index';
import prisma from '../../lib/db';

class BlockService {
	async getAllLatestBlock(data: {
		page: number;
		limit: number;
	}): Promise<IESResponse> {
		try {
			const [blocks, blockCount] = await prisma.$transaction([
				prisma.blocks.findMany({
					orderBy: {
						blocknumber: 'desc',
					},
					skip: data.page * data.limit,
					take: data.limit,
				}),
				prisma.blocks.count(),
			]);
			if (!blocks?.length) throw new Error(RES_MSG.BLOCK_NOT_FOUND);

			return {
				error: false,
				message: RES_MSG.ALL_BLOCK_FETCH,
				data: {
					count: blockCount,
					blocks: convertBigIntToNumber(blocks),
				},
			};
		} catch (err) {
			if (err instanceof Error) {
				if (err.message.includes('prisma')) {
					return { error: true, message: RES_MSG.SERVER_ERROR };
				}
				return { error: true, message: err.message };
			}
			return { error: true, message: RES_MSG.ERROR };
		}
	}

	async getBlockByHash(hash: string): Promise<IESResponse> {
		try {
			let blockDetailsByHash = await prisma.blocks.findUnique({
				where: {
					blockhash: hash,
				},
			});

			if (!blockDetailsByHash) {
				const blockData = await Web3Helper.getDetailByBlockNumber(hash);

				if (blockData) {
					RabbitMqService.inQueueData(
						QUEUE_NAME.MISSING_BLOCK,
						JSON.stringify(Number(blockData?.number)),
					);
				} else {
					throw new Error(RES_MSG.BLOCK_NOT_FOUND);
				}
			}

			let attempts = 0;
			while (attempts < 7) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
				blockDetailsByHash = await prisma.blocks.findUnique({
					where: {
						blockhash: hash,
					},
				});
				if (blockDetailsByHash) break;
				attempts++;
			}
			await this.getTxByBlock(
				Number(blockDetailsByHash?.blocknumber),
				Number(blockDetailsByHash?.transactionCount),
			);

			//if (!blockDetailsByHash) throw new Error(RES_MSG.BLOCK_NOT_FOUND);
			return {
				error: false,
				message: RES_MSG.ALL_BLOCK_FETCH,
				data: {
					block: convertBigIntToNumber([blockDetailsByHash])[0],
				},
			};
		} catch (err) {
			if (err instanceof Error) {
				return { error: true, message: err.message };
			}
			return { error: true, message: RES_MSG.ERROR };
		}
	}

	async getTxByBlock(blockNumber: number, txCount: number) {
		try {
			const count = await prisma.transactions.count({
				where: {
					blocknumber: blockNumber,
				},
			});

			if (count !== txCount) {
				RabbitMqService.inQueueData(
					QUEUE_NAME.MISSING_BLOCK,
					JSON.stringify(blockNumber),
				);
			}
			return false;
		} catch (err) {
			return true;
		}
	}

	async getBlockByNumber(blockNumber: number): Promise<IESResponse> {
		try {
			let blockDetail: any = await prisma.blocks.findUnique({
				where: {
					blocknumber: blockNumber,
				},
			});

			console.log('blockDetail from db : ', blockDetail);

			if (!blockDetail) {
				const blockData =
					await Web3Helper.getDetailByBlockNumber(blockNumber);
				console.log('blockData by blockchain : ', blockData);

				if (blockData) {
					RabbitMqService.inQueueData(
						QUEUE_NAME.MISSING_BLOCK,
						JSON.stringify(blockNumber),
					);

					blockDetail = {
						blocknumber: Number(blockData.number),
						gasLimit: Number(blockData.gasLimit),
						gasUsed: Number(blockData.gasUsed),
						nonce: Number(blockData.nonce),
						blockhash: blockData.hash,
						parentHash: blockData.parentHash,
						stateRoot: blockData.stateRoot,
						timestamp:
							Number(blockData.timestamp) * CONST_NAME.THOUSAND,
						transactionCount: blockData.transactions?.length
							? Number(blockData.transactions.length)
							: CONST_NAME.ZERO,
						miner: blockData.miner,
						transactionsRoot: blockData.transactionsRoot,
						baseFeePerGas: Number(blockData.baseFeePerGas),
						deposit: blockData.gasUsed.toString(),
						transfer: CONST_NAME.ZERO.toString(),
						receiptsRoot: blockData.receiptsRoot,
						sha3Uncles: blockData.sha3Uncles,
						size: Number(blockData.size),
						createdAt: new Date(),
					};
				} else {
					throw new Error(RES_MSG.BLOCK_NOT_FOUND);
				}
			}

			return {
				error: false,
				message: RES_MSG.ALL_BLOCK_FETCH,
				data: { block: convertBigIntToNumber([blockDetail])[0] },
			};
		} catch (err) {
			if (err instanceof Error) {
				if (err.message.includes('prisma')) {
					return { error: true, message: RES_MSG.SERVER_ERROR };
				}
				return { error: true, message: err.message };
			}
			return { error: true, message: RES_MSG.ERROR };
		}
	}

	async getBlockDetails(blockIdentity: string): Promise<IESResponse> {
		try {
			let blockDetail;

			if (blockIdentity.startsWith('0x')) {
				blockDetail = await prisma.blocks.findUnique({
					where: {
						blockhash: <string>blockIdentity.toLowerCase(),
					},
				});
			} else {
				blockDetail = await prisma.blocks.findUnique({
					where: {
						blocknumber: Number(blockIdentity),
					},
				});
			}
			if (!blockDetail) throw new Error(RES_MSG.BLOCK_NOT_FOUND);

			return {
				error: false,
				message: RES_MSG.ALL_BLOCK_FETCH,
				data: { block: convertBigIntToNumber([blockDetail])[0] },
			};
		} catch (err) {
			if (err instanceof Error) {
				if (err.message.includes('prisma')) {
					return { error: true, message: RES_MSG.SERVER_ERROR };
				}
				return { error: true, message: err.message };
			}
			return { error: true, message: RES_MSG.ERROR };
		}
	}

	async getLatestBlock(): Promise<IESResponse> {
		try {
			const lastHeader = await Web3Helper.getBlockNumber();
			return {
				error: false,
				message: RES_MSG.BLOCK_FETCH,
				data: { blockNumber: lastHeader?.toString() },
			};
		} catch (err) {
			if (err instanceof Error) {
				return { error: true, message: err.message };
			}
			return { error: true, message: RES_MSG.ERROR };
		}
	}
}

export default new BlockService();
