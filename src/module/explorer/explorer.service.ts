import Web3Helper from '../../helper/web3.helper';
import {
	RES_MSG,
	CONST_NAME,
	REDIS_KEY,
	nodeIpDetail,
	TRANSACTION_TYPE,
	TRANSACTION_STATUS,
	QUEUE_NAME,
} from '../../constant/response';
import { txType } from '../../lib/utilities.helper';
import logger from '../../lib/logger';
import { RedisService, RabbitMqService } from '../../service/index';
import BlockService from '../block/block.service';
import TransactionService from '../transaction/transaction.service';
import {
	GraphData,
	IESResponse,
	IGraphResponse,
	IPeerData,
	IUsers,
	ITransactionData,
} from '../../interfaces/index';
import prisma from '../../lib/db';
import {
	fillMissingDatesWithZeroByhr,
	fillMissingDatesWithZeroByDay,
	formatDate,
	formatDateForDay,
	formatDateByMin,
	fillMissingMinutes,
	formatDateBySec,
	fillMissingSeconds,
	exp,
} from '../../lib/utilities.helper';
import { calculateData } from '../../helper/calculateAPR.helper';
import axios from 'axios';
import { convertBigIntToNumber } from '../../helper/common.helper';
import Web3 from 'web3';
class ExplorerService {
	async calculateAndUpdateFee(gasfee: string) {
		try {
			let txfee;

			const data = await prisma.txFee.findMany({
				select: {
					fee: true,
					id: true,
				},
			});

			if (!data.length) {
				await prisma.txFee.create({
					data: { fee: gasfee },
				});
			} else {
				txfee = !data.length ? 0 : Number(data[0]?.fee);

				const updatedFee = txfee + Number(gasfee);

				await prisma.txFee.update({
					where: {
						id: data[0].id,
					},
					data: {
						fee: exp(`${updatedFee}`),
					},
				});
			}
			logger.info('Fee calculation and update successfull');
			return true;
		} catch (error) {
			logger.error('Fee calculation and update unsuccessfull');
			logger.error(error);
			return false;
		}
	}
	processUserData = async (data: { address: string }) => {
		const existingUser = await prisma.users.findUnique({
			where: { address: data.address },
		});

		if (existingUser) {
			await prisma.users.update({
				where: { id: existingUser.id },
				data: {
					txn: Number(existingUser.txn) + CONST_NAME.ONE,
				},
			});
		} else {
			await prisma.users.create({
				data: {
					address: data.address,
					txn: CONST_NAME.ONE,
				},
			});
		}
		return true;
	};

	userSave = async (
		userData: Array<{ address: string }>,
	): Promise<IESResponse> => {
		try {
			userData.map(this.processUserData);

			return {
				error: false,
				message: RES_MSG.USER_ADDED,
				data: { isAdded: true },
			};
		} catch (err) {
			return {
				error: true,
				message: RES_MSG.SERVER_ERROR,
				data: { isAdded: false },
			};
		}
	};

	async searching(payload: string): Promise<IESResponse> {
		try {
			let txData;
			/*check if the string is not hex and call the getBlockDetails Routine
			  using the block number for getting block details
			*/
			if (!payload.startsWith('0x') && isNaN(Number(payload))) {
				throw new Error(RES_MSG.NOT_VALID_QUERY);
			} else if (!payload.startsWith('0x') && !isNaN(Number(payload))) {
				const result = await BlockService.getBlockByNumber(
					Number(payload),
				);
				return result;
			} else if (payload?.startsWith('0x') && payload?.length === 66) {
				const txData = await TransactionService.getTransactionByHash(
					payload?.toLowerCase(),
				);

				if (txData?.error) {
					const result = await BlockService.getBlockByHash(
						payload?.toLowerCase(),
					);
					if (result?.error) result.message = RES_MSG.NOT_FOUND;
					return result;
				}

				return txData;
			} else if (payload.startsWith('0x') && payload.length === 42) {
				/* here we search for all transaction specfic to a wallet address*/
				txData = await TransactionService.getTransactionByAddress({
					address: payload,
					limit: 10,
					page: 0,
				});

				return txData;
			} else {
				throw new Error(RES_MSG.NOT_FOUND);
			}
		} catch (err) {
			if (err instanceof Error) {
				return { error: true, message: RES_MSG.BLOCK_NOT_FOUND };
			}
			return { error: true, message: RES_MSG.ERROR };
		}
	}

	async getAllPeers(): Promise<IESResponse> {
		return new Promise(async (resolve, reject) => {
			try {
				let globeLocDetail: IPeerData[] = [];
				const peerCount = await Web3Helper.getPeerCount();

				const radisCountPeer = await RedisService.getString(
					CONST_NAME.TOTAL_NODE,
				);
				if (radisCountPeer?.length === Number(peerCount)) {
					globeLocDetail = radisCountPeer;
				} else {
					const url = environment.nodeInfoUrl;

					const response = await axios.get(url);
					response.data.result.peers.push(nodeIpDetail);

					for (
						let peer = 0;
						peer < response.data.result.peers.length;
						peer++
					) {
						const result = response.data.result.peers[peer];
						const ipResponse = await axios.get(
							`${environment.locationApiUrl}${result.remote_ip}`,
						);
						const { status } = ipResponse.data;
						if (status === CONST_NAME.SUCCESS_STATUS) {
							const ipDataRes = {
								peerId: result.node_info.id,
								roles: '',
								protocolVersion:
									result.node_info.protocol_version,
								bestHash: '',
								bestNumber: '',
								version: result.node_info.version,
								// nodeName: `${result.node_info.moniker}${
								// 	peer + 1
								// }`,
								nodeName: result.node_info.moniker,
								software: {
									full: '',
									version: '',
									networkId: '',
								},
								location: ipResponse.data,
							};

							globeLocDetail.push(ipDataRes);
						}
					}

					RedisService.setString(
						CONST_NAME.TOTAL_NODE,
						globeLocDetail,
					);
				}

				resolve({
					error: false,
					message: RES_MSG.PEER_FETCH,
					data: {
						total: Number(peerCount) + 1,
						globeLocDetail,
					},
				});
			} catch (error) {
				reject(error);
			}
		});
	}

	async summary(): Promise<IESResponse> {
		try {
			const [userCount] = await prisma.$transaction([
				prisma.users.count({
					take: 1,
					orderBy: {
						id: 'desc',
					},
				}),
			]);

			if (!userCount) throw new Error(RES_MSG.USER_NOT_FOUND);

			return {
				message: RES_MSG.DATA_FETCH,
				error: false,
				data: {
					totalAccounts: userCount,
					totalToken: await prisma.tokens.count(),
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

	async tpsHistory(payloads: {
		time: string;
		interval: number;
	}): Promise<IGraphResponse> {
		try {
			let graphData;
			let finalData;
			let startDate = '';

			if (payloads.time === 'h') {
				const currentDate = new Date();

				const oneHourAgo = new Date();
				oneHourAgo.setHours(oneHourAgo.getHours() - 7);
				startDate = formatDate(oneHourAgo);
				graphData = (await prisma.$queryRaw`
			SELECT DATE_TRUNC('hour', "createdAt") AS "hour", COUNT(*)::int AS "count"
			FROM "Transactions"
			WHERE "createdAt" >= ${new Date(startDate)}
				AND "createdAt" <= ${currentDate}
				
			GROUP BY "hour"
			ORDER BY "hour";
			`) as Array<{ hour: Date; count: number }>;

				finalData = await fillMissingDatesWithZeroByhr(
					graphData,
					new Date(startDate),
				);
			} else if (payloads.time === 'm') {
				const currentDate = new Date();
				const currentDateModi = formatDateByMin(new Date());

				const oneMinuteAgo = new Date();
				oneMinuteAgo.setMinutes(
					oneMinuteAgo.getMinutes() - payloads.interval,
				);
				startDate = formatDateByMin(oneMinuteAgo);

				graphData = (await prisma.$queryRaw`
				SELECT DATE_TRUNC('minute', "createdAt") AS "hour", COUNT(*)::int AS "count"
				FROM "Transactions"
				WHERE "createdAt" >= ${new Date(startDate)}
					AND "createdAt" <= ${currentDate}
					
				GROUP BY "hour"
				ORDER BY "hour";
				`) as Array<{ hour: Date; count: number }>;
				finalData = await fillMissingMinutes(
					graphData,
					new Date(startDate),
					new Date(currentDateModi),
				);
			} else if (payloads.time === 's') {
				const currentDate = new Date();
				const currentDateModi = formatDateBySec(new Date());

				const oneSecondAgo = new Date();
				oneSecondAgo.setSeconds(
					oneSecondAgo.getSeconds() - (payloads.interval - 1),
				);
				startDate = formatDateBySec(oneSecondAgo);

				graphData = (await prisma.$queryRaw`
				SELECT DATE_TRUNC('second', "createdAt") AS "second", COUNT(*)::int AS "count"
				FROM "Transactions"
				WHERE "createdAt" >= ${new Date(startDate)}
					AND "createdAt" <= ${currentDate}
				GROUP BY "second"
				ORDER BY "second";
			`) as Array<{ second: Date; count: number }>;
				finalData = await fillMissingSeconds(
					graphData,
					new Date(startDate),
					new Date(currentDateModi),
				);
			}

			const totalTx = await RedisService.getString(REDIS_KEY.TOTAL_TX);
			return {
				error: false,
				message: RES_MSG.TRANSACTION_HISTORY_SUCCESS,
				data: {
					finalData: finalData as Array<GraphData>,
					count: await prisma.transactions.count(),
				},
			};
		} catch (err) {
			return { error: true, message: RES_MSG.ERROR };
		}
	}

	async fetchHistoricalData(symbol: string) {
		try {
			const response = await axios.get(environment.coinMarketApi, {
				params: {
					symbol: symbol,
					time_start: Math.floor(
						(Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000,
					), // 7 days ago in seconds
					time_end: Math.floor(Date.now() / 1000), // Current time in seconds
					convert: 'USD',
					apiKey: environment.coinMarketKey,
				},
			});

			const historicalData = response.data.data;
			return historicalData;
		} catch (error) {
			console.error(
				'Error fetching historical data from Coin Market Cap API:',
				error,
			);
			throw error;
		}
	}

	// Function to calculate average token price, percentage change, and loss percentage for 7 days
	// async calculateMetrics(historicalData) {
	// 	const prices = historicalData.map(entry => entry.quote.USD.close);

	// 	// Calculate percentage change
	// 	const percentageChange = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;

	// 	// Calculate loss percentage (if percentageChange is negative)
	// 	const lossPercentage = percentageChange < 0 ? Math.abs(percentageChange) : 0;

	// 	return { percentageChange, lossPercentage };
	//  }
	async tokenPriceDetail(payloads: {
		time: string;
		interval: number;
	}): Promise<IESResponse> {
		try {
			const currentDate = new Date();
			const today = new Date();

			if (payloads.time === 'd') {
				if (payloads.interval === 1) {
					currentDate.setDate(currentDate.getDate() - 1); // Subtract 1 day
					const hourlyPrices = (await prisma.coinmarketInfo.findMany({
						where: {
							createdAt: {
								gte: formatDate(currentDate),
								lte: formatDate(today),
							},
						},
						orderBy: {
							createdAt: 'asc',
						},
						select: {
							createdAt: true,
							price: true,
							volume24h: true,
							volumeChange24h: true,
							percentChange1h: true,
							percentChange24h: true,
							percentChange7d: true,
							percentChange30d: true,
						},
					})) as Array<{ createdAt: Date; price: string }>;

					const result: Array<{ createdAt: Date; price: string }> =
						[];
					let lastHour: Date | null = null;
					for (const record of hourlyPrices) {
						if (
							!lastHour ||
							(+record.createdAt - +lastHour) / 36e5 >= 1
						) {
							result.push(record);
							lastHour = record.createdAt;
						}

						if (result.length >= 24) {
							break;
						}
					}

					const latestEntry = await prisma.coinmarketInfo.findFirst({
						orderBy: {
							createdAt: 'desc', // Order by date in descending order
						},
						select: {
							price: true,
						},
					});
					const currentPrice = latestEntry?.price ?? 0;

					const groupedData: Record<
						string,
						Array<{ createdAt: Date; price: string }>
					> = {};

					result.forEach((entry) => {
						const date = entry.createdAt.toLocaleDateString();

						if (!groupedData[date]) {
							groupedData[date] = [];
						}
						groupedData[date].push(entry);
					});

					const results = Object.entries(groupedData).map(
						([date, entries]) => ({
							[date]: entries,
						}),
					);

					return {
						error: false,
						message: RES_MSG.TOKEN_HISTORY_SUCCESS,
						data: {
							finalData: results,
							currentPrice: currentPrice,
						},
					};
				}
				const daysAgo = payloads.interval;
				const fromDate = new Date(currentDate);
				fromDate.setDate(fromDate.getDate() - daysAgo);
				const startDate = formatDate(fromDate);

				const hourlyPrices = await prisma.coinmarketInfo.findMany({
					where: {
						createdAt: {
							gte: new Date(startDate),
						},
					},
					orderBy: {
						createdAt: 'asc',
					},
					select: {
						createdAt: true,
						price: true,
						volume24h: true,
						volumeChange24h: true,
						percentChange1h: true,
						percentChange24h: true,
						percentChange7d: true,
						percentChange30d: true,
					},
				});

				const latestEntry = await prisma.coinmarketInfo.findFirst({
					orderBy: {
						createdAt: 'desc', // Order by date in descending order
					},
					select: {
						price: true,
					},
				});
				const currentPrice = latestEntry?.price ?? 0;

				const groupedData: Record<
					string,
					Array<{ createdAt: Date; price: string }>
				> = {};

				hourlyPrices.forEach((entry) => {
					const date = entry.createdAt.toLocaleDateString();
					if (!groupedData[date]) {
						groupedData[date] = [];
					}
					groupedData[date].push(entry);
				});

				const result = Object.entries(groupedData).map(
					([date, entries]) => ({
						[date]: entries,
					}),
				);

				return {
					error: false,
					message: RES_MSG.TOKEN_HISTORY_SUCCESS,
					//data: result,
					data: { finalData: result, currentPrice: currentPrice },
				};
			}

			return {
				error: true,
				message: 'Invalid time interval',
			};
		} catch (error) {
			console.error('Error retrieving graph data:', error);
			throw error;
		}
	}
	getRedisValue = async (): Promise<
		| {
				supply: number;
				marketCap: number;
		  }
		| false
	> => {
		try {
			let supply;
			supply = await RedisService.getString(REDIS_KEY.CIRCULATING_SUPPLY);
			supply = supply === null ? 0 : supply;

			let marketCap;
			marketCap = await RedisService.getString(REDIS_KEY.MARKET_CAP);
			marketCap = marketCap === null ? 0 : marketCap;

			return {
				supply,
				marketCap,
			};
		} catch (err) {
			logger.error('Error while getting value  from redis ');
			return false;
		}
	};
	async getMarketCapHistory() {
		try {
			const obj: { supply: number; marketCap: number } = {
				supply: 0,
				marketCap: 0,
			};

			const data = await this.getRedisValue();
			if (data === false) {
				obj.supply = CONST_NAME.ZERO;
				obj.marketCap = CONST_NAME.ZERO;
			} else {
				obj.supply = data?.supply;
				obj.marketCap = data?.marketCap;
			}
			// let marketCapPrice;
			// let price;
			// marketCapPrice = await RedisService.getString(
			// 	CONST_NAME.MARKET_CAP_PRICE,
			// );

			// if (marketCapPrice === null) {
			// 	const latestEntry = await prisma.coinmarketInfo.findFirst({
			// 		orderBy: {
			// 			id: 'desc',
			// 		},
			// 		select: {
			// 			price: true,
			// 		},
			// 	});

			// 	price = latestEntry != null ? Number(latestEntry.price) : 0;
			// } else {
			// 	marketCapPrice = JSON.parse(marketCapPrice);

			// 	price = Number(marketCapPrice.price);
			// }

			return {
				error: false,
				message: RES_MSG.MARKET_CAP_SUCCESS,
				data: { obj },
			};
		} catch (err) {
			if (err instanceof Error) {
				return { error: true, message: err.message };
			} else {
				return {
					error: true,
					message: RES_MSG.MARKET_CAP_HISTORY_ERROR,
				};
			}
		}
	}

	async getAccountCounts(payloads: {
		time: string;
		interval: number;
	}): Promise<IGraphResponse> {
		try {
			let graphData;
			let finalData;

			let startDate = '';

			if (payloads.time === 'd') {
				if (payloads.interval === 1) {
					const currentDate = new Date();

					const oneDayAgo = new Date();
					oneDayAgo.setDate(oneDayAgo.getDate() - 1); // Subtract 1 day
					startDate = formatDate(oneDayAgo);
					graphData = (await prisma.$queryRaw`
					SELECT DATE_TRUNC('hour', "createdAt") AS "hour", COUNT(*)::int AS "count"
					FROM "Users"
					WHERE "createdAt" >= ${new Date(startDate)}
					AND "createdAt" <= ${currentDate}
			
					GROUP BY "hour"
					ORDER BY "hour";
					`) as Array<{ hour: Date; count: number }>;

					finalData = await fillMissingDatesWithZeroByhr(
						graphData,
						new Date(startDate),
					);
				} else {
					const currentDate = new Date();

					const daysAgo = payloads.interval;
					const fromDate = new Date(currentDate);
					fromDate.setDate(fromDate.getDate() - daysAgo);
					startDate = formatDateForDay(fromDate);

					graphData = (await prisma.$queryRaw`
				  SELECT DATE_TRUNC('day', "createdAt") AS "day", COUNT(*)::int AS "count"
				  FROM "Users"
				  WHERE "createdAt" >= ${new Date(startDate)}
					AND "createdAt" <= ${currentDate}
					
				  GROUP BY "day"
				  ORDER BY "day";
				`) as Array<{ day: Date; count: number }>;

					finalData = await fillMissingDatesWithZeroByDay(
						graphData,
						new Date(startDate),
						currentDate,
					);
				}
			} else if (payloads.time === 'h') {
				const currentDate = formatDateByMin(new Date());

				const oneHourAgo = new Date();
				oneHourAgo.setHours(oneHourAgo.getHours() - payloads.interval);
				startDate = formatDateByMin(oneHourAgo);
				const graphData = (await prisma.$queryRaw`
				SELECT DATE_TRUNC('minute', "createdAt") AS "hour", COUNT(*)::int AS "count"
				FROM "Users"
				WHERE "createdAt" >= ${new Date(startDate)}
					AND "createdAt" <= ${new Date(currentDate)}
				
				GROUP BY "hour"
				ORDER BY "hour";
				`) as Array<{ hour: Date; count: number }>;

				finalData = await fillMissingMinutes(
					graphData,
					new Date(startDate),
					new Date(currentDate),
				);
			}
			const totalAccount = await RedisService.getString(
				REDIS_KEY.TOTAL_ACCOUNTS,
			);

			return {
				error: false,
				message: RES_MSG.ACCOUNT_HISTORY_SUCCESS,
				data: {
					finalData: finalData as Array<GraphData>,
					count: await prisma.users.count(),
				},
			};
		} catch (err) {
			return { error: true, message: RES_MSG.ERROR };
		}
	}

	async getCoinTransferCount(payloads: {
		time: string;
		interval: number;
	}): Promise<IGraphResponse> {
		try {
			let graphData;
			let finalData;
			let startDate = '';
			if (payloads.time === 'd') {
				if (payloads.interval === 1) {
					const currentDate = new Date();

					const oneDayAgo = new Date();
					oneDayAgo.setDate(oneDayAgo.getDate() - 1); // Subtract 1 day
					startDate = formatDate(oneDayAgo);

					graphData = (await prisma.$queryRaw`
					SELECT DATE_TRUNC('hour', "createdAt") AS "hour", COUNT(*)::int AS "count"
					FROM "Transactions"
					WHERE "createdAt" >= ${new Date(startDate)}
					AND "createdAt" <= ${currentDate}
					AND "type" = 'COIN_TRANSFER'
					GROUP BY "hour"
					ORDER BY "hour";
					`) as Array<{ hour: Date; count: number }>;
					finalData = await fillMissingDatesWithZeroByhr(
						graphData,
						new Date(startDate),
					);
				} else {
					const currentDate = new Date();

					const daysAgo = payloads.interval;
					const fromDate = new Date(currentDate);
					fromDate.setDate(fromDate.getDate() - daysAgo);
					startDate = formatDateForDay(fromDate);

					graphData = (await prisma.$queryRaw`
				   SELECT DATE_TRUNC('day', "createdAt") AS "day", COUNT(*)::int AS "count"
				   FROM "Transactions"
				   WHERE "createdAt" >= ${new Date(startDate)}
					AND "createdAt" <= ${currentDate}
					AND "type" = 'COIN_TRANSFER'
				   GROUP BY "day"
				   ORDER BY "day";
				`) as Array<{ day: Date; count: number }>;

					finalData = await fillMissingDatesWithZeroByDay(
						graphData,
						new Date(startDate),
						currentDate,
					);
				}
			} else if (payloads.time === 'h') {
				const currentDate = new Date();
				const currentDateModi = formatDateByMin(new Date());

				const oneHourAgo = new Date();
				oneHourAgo.setHours(oneHourAgo.getHours() - payloads.interval);
				startDate = formatDateByMin(oneHourAgo);
				const graphData = (await prisma.$queryRaw`
			   SELECT DATE_TRUNC('minute', "createdAt") AS "hour", COUNT(*)::int AS "count"
			   FROM "Transactions"
			   WHERE "createdAt" >= ${new Date(startDate)}
				AND "createdAt" <= ${currentDate}
				AND "type" = 'COIN_TRANSFER'
			   GROUP BY "hour"
			   ORDER BY "hour";
			`) as Array<{ hour: Date; count: number }>;
				finalData = await fillMissingMinutes(
					graphData,
					new Date(startDate),
					new Date(currentDateModi),
				);
			}
			const totalCoinTx = await RedisService.getString(
				REDIS_KEY.TOTAL_COIN_TRANSFER_TX,
			);
			const count = await prisma.transactions.count({
				where: {
					type: TRANSACTION_TYPE.COIN_TRANSFER,
				},
			});
			return {
				error: false,
				message: RES_MSG.TRANSACTION_HISTORY_SUCCESS,
				data: {
					finalData: finalData as Array<GraphData>,
					count: count,
				},
			};
		} catch (err) {
			return { error: true, message: RES_MSG.ERROR };
		}
	}

	async getContractDeployedCount(payloads: {
		time: string;
		interval: number;
	}): Promise<IGraphResponse> {
		try {
			let graphData;
			let finalData;
			let startDate = '';

			if (payloads.time === 'd') {
				if (payloads.interval === 1) {
					const currentDate = new Date();

					const oneDayAgo = new Date();
					oneDayAgo.setDate(oneDayAgo.getDate() - 1); // Subtract 1 day
					startDate = formatDate(oneDayAgo);

					graphData = (await prisma.$queryRaw`
				   SELECT DATE_TRUNC('hour', "createdAt") AS "hour", COUNT(*)::int AS "count"
				   FROM "Transactions"
				   WHERE "createdAt" >= ${new Date(startDate)}
					AND "createdAt" <= ${currentDate}
					AND "type" = 'CONTRACT_CREATION'
				   GROUP BY "hour"
				   ORDER BY "hour";
				`) as Array<{ hour: Date; count: number }>;
					finalData = await fillMissingDatesWithZeroByhr(
						graphData,
						new Date(startDate),
					);
				} else {
					const currentDate = new Date();

					const daysAgo = payloads.interval;
					const fromDate = new Date(currentDate);
					fromDate.setDate(fromDate.getDate() - daysAgo);
					startDate = formatDateForDay(fromDate);

					graphData = (await prisma.$queryRaw`
				   SELECT DATE_TRUNC('day', "createdAt") AS "day", COUNT(*)::int AS "count"
				   FROM "Transactions"
				   WHERE "createdAt" >= ${new Date(startDate)}
					AND "createdAt" <= ${currentDate}
					AND "type" = 'CONTRACT_CREATION'
				   GROUP BY "day"
				   ORDER BY "day";
				`) as Array<{ day: Date; count: number }>;

					finalData = await fillMissingDatesWithZeroByDay(
						graphData,
						new Date(startDate),
						currentDate,
					);
				}
			} else if (payloads.time === 'h') {
				const currentDate = new Date();
				const currentDateModi = formatDateByMin(new Date());
				const oneHourAgo = new Date();
				oneHourAgo.setHours(oneHourAgo.getHours() - payloads.interval);
				startDate = formatDateByMin(oneHourAgo);
				graphData = (await prisma.$queryRaw`
				SELECT DATE_TRUNC('minute', "createdAt") AS "hour", COUNT(*)::int AS "count"
				FROM "Transactions"
				WHERE "createdAt" >= ${new Date(startDate)}
					AND "createdAt" <= ${currentDate}
					AND "type" = 'CONTRACT_CREATION'
				GROUP BY "hour"
				ORDER BY "hour";
				`) as Array<{ hour: Date; count: number }>;
				finalData = await fillMissingMinutes(
					graphData,
					new Date(startDate),
					new Date(currentDateModi),
				);
			}

			const totalContractDeployedTx = await RedisService.getString(
				REDIS_KEY.TOTAL_CONTRACT_DEPLOYED_TX,
			);

			return {
				error: false,
				message: RES_MSG.TRANSACTION_HISTORY_SUCCESS,
				data: {
					finalData: finalData as Array<GraphData>,
					count: await prisma.contracts.count(),
				},
			};
		} catch (err) {
			return { error: true, message: RES_MSG.ERROR };
		}
	}

	async dashboard(): Promise<IESResponse> {
		try {
			const data = await calculateData();

			if ('apr' in data && 'validator' in data) {
				return {
					error: false,
					message: RES_MSG.APR_VALUE_SUCCESS,
					data: {
						apr: data.apr,
						validators: data.validator,
					},
				};
			} else {
				return { error: true, message: RES_MSG.APR_VALUE_ERROR };
			}
		} catch (err) {
			return { error: true, message: RES_MSG.APR_VALUE_ERROR };
		}
	}
	async getTopValidator(): Promise<IESResponse> {
		try {
			const oneDayAgo = new Date();
			oneDayAgo.setDate(oneDayAgo.getDate() - 1);
			const result = await prisma.blocks.groupBy({
				by: ['miner'],
				_count: {
					blocknumber: true,
				},
				where: {
					createdAt: {
						gte: oneDayAgo,
					},
				},
				orderBy: {
					_count: {
						blocknumber: 'desc',
					},
				},
				take: 1,
			});
			if (result?.length == 0)
				throw new Error("'No data found for the last 24 hours.'");

			const topMiner = result[0].miner;
			const blockCount = result[0]._count.blocknumber;

			return {
				error: false,
				message: 'top validator fetch successfully',
				data: {
					topMiner,
					blockCount,
				},
			};
		} catch (err) {
			return { error: true, message: RES_MSG.APR_VALUE_ERROR };
		}
	}
	async getAddressDetail(address: string): Promise<IESResponse> {
		try {
			const [user, count] = await Promise.all([
				prisma.users.findFirst({
					where: {
						address: address,
					},
					select: {
						txn: true,
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

			if (user === null) {
				throw new Error(RES_MSG.USER_NOT_FOUND);
			}
			let txnCount = user != null ? count : 0;
			let actualBalance = 0 as number;

			const userBalance = await Web3Helper.getBalance(
				Web3.utils.toChecksumAddress(address),
			);

			actualBalance = Number(userBalance) / Math.pow(10, 18);

			let marketCapPrice;
			marketCapPrice = await RedisService.getString(
				CONST_NAME.MARKET_CAP_PRICE,
			);

			let value;
			if (marketCapPrice === null) {
				const latestEntry = await prisma.coinmarketInfo.findFirst({
					orderBy: {
						id: 'desc',
					},
					select: {
						price: true,
					},
				});

				let price = latestEntry != null ? latestEntry.price : 0;
				value = Number(price) * Number(actualBalance);
			} else {
				marketCapPrice = JSON.parse(marketCapPrice);
				value = Number(marketCapPrice.price) * Number(actualBalance);
			}

			return {
				error: false,
				message: RES_MSG.SUCCESS,
				data: {
					coinBalance: exp(actualBalance.toString()),
					value: exp(value.toString()),
					transactionCount: Number(txnCount),
				},
			};
		} catch (err) {
			return {
				error: true,
				message: err instanceof Error ? err.message : RES_MSG.ERROR,
			};
		}
	}
}

export default new ExplorerService();
