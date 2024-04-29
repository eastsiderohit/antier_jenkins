import {
	RES_MSG,
	REDIS_KEY,
	QUEUE_NAME,
	CONST_NAME,
	TRANSACTION_TYPE,
	TRANSACTION_STATUS,
} from '../../constant/response';
import { convertBigIntToNumber } from '../../helper/common.helper';
import web3Helper from '../../helper/web3.helper';
import { IESResponse } from '../../interfaces/index';
import prisma from '../../lib/db';
import { exp, txType } from '../../lib/utilities.helper';
import { RabbitMqService } from '../../service';

class TransactionService {
	async getAllTransaction(data: {
		page: number;
		limit: number;
	}): Promise<IESResponse> {
		try {
			const [transactions, transactionCount, txFee] =
				await prisma.$transaction([
					prisma.transactions.findMany({
						orderBy: {
							createdAt: 'desc',
						},
						skip: data.page * data.limit,
						take: data.limit,
					}),
					prisma.transactions.count(),

					prisma.txFee.findMany({}),
				]);

			const fee = !txFee?.length ? '0' : txFee[0].fee;
			if (!transactions.length)
				throw new Error(RES_MSG.TRANSACTION_NOT_FOUND);
			// const transactionCount = await RedisService.getString(
			// 	REDIS_KEY.TOTAL_TX,
			// );
			return {
				error: false,
				message: RES_MSG.TRANSACTION_FETCH_SUCCESS,
				data: {
					fee,
					count: transactionCount,
					transactions: convertBigIntToNumber(transactions),
				},
			};
		} catch (err) {
			if (err instanceof Error) {
				if (err.message.includes('prisma')) {
					return { error: true, message: RES_MSG.SERVER_ERROR };
				}
				return { error: true, message: err.message };
			} else {
				return { error: true, message: RES_MSG.ERROR };
			}
		}
	}

	async getTransactionByHash(txHash: string): Promise<IESResponse> {
		try {
			let transactionData = await prisma.transactions.findUnique({
				where: { txhash: txHash },
			});
			transactionData = convertBigIntToNumber([transactionData])[0];

			if (!transactionData) {
				try {
					const txData = await web3Helper.getTxByHash(txHash);
					if (txData) {
						RabbitMqService.inQueueData(
							QUEUE_NAME.MISSING_BLOCK,
							JSON.stringify(Number(txData?.blockNumber)),
						);
						const txReceipt =
							await web3Helper.getTransactionReceipt(txHash);
						const amount =
							Number(`${txData?.value}`) / CONST_NAME.ETH_EXP;
						const gasPrice = txData?.gasPrice
							? Number(txData?.gasPrice)
							: CONST_NAME.ZERO;

						const fee =
							(Number(txData?.gas) * gasPrice) /
							CONST_NAME.ETH_EXP;

						let transactionDetail = {
							blocknumber: Number(txData?.blockNumber),
							blockhash: txData?.blockHash,
							txhash: txData?.hash,
							type: txType(`${txData.to}`, txData.input),
							status: txReceipt?.status
								? TRANSACTION_STATUS.SUCCESS
								: TRANSACTION_STATUS.FAILED,

							fromAddress: <string>txData?.from,
							toAddress: <string>txData?.to ?? CONST_NAME.NA,
							contractAddress:
								txReceipt?.contractAddress ?? CONST_NAME.NA,
							timestamp: new Date().getTime(),
							token: CONST_NAME.ZERO.toString(),
							createdAt: new Date(),
							gasPrice,
							gas: txReceipt?.gasUsed
								? Number(txReceipt?.gasUsed)
								: Number(txData?.gas) || 0,
							value: exp(`${amount}`),
							txFee: exp(`${fee}`),
						};
						transactionData = convertBigIntToNumber([
							transactionDetail,
						])[0];
					}
				} catch (error) {
					throw new Error(RES_MSG.NOT_FOUND);
				}
			}
			return {
				error: false,
				message: RES_MSG.TRANSACTION_FETCH_SUCCESS,
				data: {
					transaction: transactionData,
				},
			};
		} catch (err) {
			if (err instanceof Error) {
				return { error: true, message: err.message };
			} else {
				return { error: true, message: RES_MSG.ERROR };
			}
		}
	}

	async getTransactionByAddress(payloads: {
		page: number;
		limit: number;
		address: string;
	}): Promise<IESResponse> {
		try {
			const address = payloads.address;
			const [transactions, transactionCount] = await prisma.$transaction([
				prisma.transactions.findMany({
					where: {
						OR: [
							{ fromAddress: address },
							{ toAddress: address },
							{ contractAddress: address },
						],
					},
					skip: payloads.page * payloads.limit,
					take: payloads.limit,
					orderBy: {
						createdAt: 'desc',
					},
				}),
				prisma.transactions.count({
					where: {
						OR: [
							{ fromAddress: address },
							{ toAddress: address },
							{ contractAddress: address },
						],
					},
				}),
			]);
			if (!transactionCount)
				throw new Error(RES_MSG.TRANSACTION_NOT_FOUND);

			return {
				error: false,
				message: RES_MSG.TRANSACTION_FETCH_SUCCESS,
				data: {
					count: transactionCount,
					transactions: convertBigIntToNumber(transactions),
				},
			};
		} catch (err) {
			if (err instanceof Error) {
				if (err.message.includes('prisma')) {
					return { error: true, message: RES_MSG.SERVER_ERROR };
				}
				return { error: true, message: err.message };
			} else {
				return { error: true, message: RES_MSG.ERROR };
			}
		}
	}

	async getTransactionByBlock(payloads: {
		page: number;
		limit: number;
		value: string;
	}): Promise<IESResponse> {
		try {
			if (!payloads.value || isNaN(Number(payloads.value))) {
				return {
					error: true,
					message: RES_MSG.NOT_VALID_QUERY,
				};
			}

			let transactionData;
			//check if there is blockhash or blocknumber for checking the block details
			if (payloads.value.startsWith('0x')) {
				transactionData = await prisma.transactions.findMany({
					where: { blockhash: payloads.value },
					orderBy: {
						createdAt: 'desc',
					},
					skip: payloads.page * payloads.limit,
					take: payloads.limit,
				});
			} else {
				transactionData = await prisma.transactions.findMany({
					where: { blocknumber: +payloads.value },
					orderBy: {
						createdAt: 'desc',
					},
					skip: payloads.page * payloads.limit,
					take: payloads.limit,
				});
			}

			if (!transactionData.length)
				throw new Error(RES_MSG.TRANSACTION_NOT_FOUND);

			let txCount;

			if (payloads.value.startsWith('0x')) {
				txCount = await prisma.blocks.findUnique({
					select: {
						transactionCount: true,
					},
					where: { blockhash: payloads.value },
				});
			} else {
				txCount = await prisma.blocks.findUnique({
					select: {
						transactionCount: true,
					},
					where: { blocknumber: +payloads.value },
				});
			}

			return {
				message: RES_MSG.BLOCK_TRANSACTION_FETCH,
				error: false,
				data: {
					transaction: convertBigIntToNumber(transactionData),
					count: txCount
						? convertBigIntToNumber([txCount])[0].transactionCount
						: 0,
				},
			};
		} catch (err) {
			if (err instanceof Error) {
				if (err.message.includes('prisma')) {
					return { error: true, message: RES_MSG.SERVER_ERROR };
				}
				return { error: true, message: err.message };
			} else {
				return { error: true, message: RES_MSG.ERROR };
			}
		}
	}
}

export default new TransactionService();
