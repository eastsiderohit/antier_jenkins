import {
	RES_MSG,
	CONST_NAME,
	GET_CONTRACT,
	ASC,
} from '../../constant/response';
import { convertBigIntToNumber } from '../../helper/common.helper';
import {
	IContractLog,
	IESResponse,
	IPopularContractAddress,
} from '../../interfaces/index';
import prisma from '../../lib/db';

class ContractService {
	async getAllContract(data: {
		page: number;
		limit: number;
	}): Promise<IESResponse> {
		try {
			const [contracts, contractCount] = await prisma.$transaction([
				prisma.contracts.findMany({
					skip: data.page * data.limit,
					take: data.limit,
					orderBy: {
						createdAt: 'desc',
					},
				}),
				prisma.contracts.count(),
			]);
			if (!contracts?.length) throw new Error(RES_MSG.CONTRACT_NOT_FOUND);
			return {
				error: false,
				message: RES_MSG.CONTRACT,
				data: {
					count: contractCount,
					contracts: convertBigIntToNumber(contracts),
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
	};

	async getContractByAddress(contractAddress: string): Promise<IESResponse> {
		try {
			const tokenData = await prisma.tokens.findFirst({
				where: { contractAddress: contractAddress },
			});
			if (!tokenData) {
				throw new Error(RES_MSG.CONTRACT_NOT_FOUND);
			}
			const contractData = await prisma.contracts.findFirst({
				where: {
					address: contractAddress
				},
				select: {
					txHash: true
				}
			});
			const contractLogs = await prisma.contractLogs.count({
				where: { contractAddress: contractAddress },
			});
			const contract = convertBigIntToNumber([tokenData])[0];
			contract.txHash = contractData?.txHash;
			contract.txCount = contractLogs;

			return {
				error: false,
				message: RES_MSG.CONTRACT,
				data: {
					contracts: contract,
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

	async getContractTransaction(data: {
		page: number;
		limit: number;
		contractAddress: string;
	}): Promise<IESResponse> {
		try {
			const [contractLogs, contractLogsCount] = await prisma.$transaction(
				[
					prisma.contractLogs.findMany({
						skip: data.page * data.limit,
						take: data.limit,
						orderBy: {
							createdAt: 'desc',
						},
						where: {
							contractAddress: data.contractAddress,
						},
					}),
					prisma.contractLogs.count({
						where: {
							contractAddress: data.contractAddress,
						},
					}),
				],
			);
			if (!contractLogs?.length)
				throw new Error(RES_MSG.CONTRACT_TX_NOT_FOUND);
			return {
				error: false,
				message: RES_MSG.CONTRACT_TX,
				data: {
					count: contractLogsCount,
					contracts: convertBigIntToNumber(contractLogs),
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

	async getInternalTx(data: {
		page: number;
		limit: number;
		contractAddress: string;
	}): Promise<IESResponse> {
		try {
			const [contractLogs, contractLogsCount] = await prisma.$transaction(
				[
					prisma.contractLogs.findMany({
						skip: data.page * data.limit,
						take: data.limit,
						orderBy: {
							createdAt: 'desc',
						},
						where: {
							contractAddress: data.contractAddress,
						},
					}),
					prisma.contractLogs.count({
						where: {
							contractAddress: data.contractAddress,
						},
					}),
				],
			);
			if (!contractLogs?.length)
				throw new Error(RES_MSG.CONTRACT_TX_NOT_FOUND);
			return {
				error: false,
				message: RES_MSG.CONTRACT_TX,
				data: {
					count: contractLogsCount,
					contracts: convertBigIntToNumber(contractLogs),
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

	async getPopularTx(data: {
		page: number;
		limit: number;
	}): Promise<IESResponse> {
		try {
			const contractAddressesWithCounts: Array<IContractLog> =
				await prisma.contractLogs.findMany({
					select: GET_CONTRACT,
					orderBy: {
						contractAddress: ASC,
					},
				});

			if (!contractAddressesWithCounts?.length)
				throw new Error(RES_MSG.CONTRACT_TX_NOT_FOUND);

			const contractAddressCounts: Record<string, number> = {};
			for (const log of contractAddressesWithCounts) {
				const address = log.contractAddress;
				contractAddressCounts[address] =
					(contractAddressCounts[address] || 0) + 1;
			}

			const popularContractAddresses: Array<IPopularContractAddress> =
				Object.entries(contractAddressCounts).map(
					([contractAddress, count]) => {
						const matchingLog = contractAddressesWithCounts.find(
							(log: IContractLog) =>
								log.contractAddress === contractAddress,
						);
						return {
							contractAddress,
							count,
							creator: matchingLog?.creator,
							contractName: matchingLog?.contractName,
							contractType: matchingLog?.contractType,
							createdAt: matchingLog?.createdAt,
							blocknumber: Number(matchingLog?.blocknumber),
						};
					},
				);

			popularContractAddresses.sort((a, b) => b.count - a.count);
			const startIndex = data.page * data.limit;
			const endIndex = startIndex + data.limit;
			const paginatedResults = popularContractAddresses.slice(
				startIndex,
				endIndex,
			);

			if (!paginatedResults?.length) {
				throw new Error(RES_MSG.NOT_FOUND);
			}
			return {
				error: false,
				message: RES_MSG.POPULAR_TX_SUCCESS,
				data: {
					totalCount: popularContractAddresses.length,
					contracts: paginatedResults,
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

export default new ContractService();
