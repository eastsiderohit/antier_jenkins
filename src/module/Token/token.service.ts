import prisma from '../../lib/db';
import { RES_MSG } from '../../constant/response';
import { IESResponse } from '../../interfaces/index';
import { convertBigIntToNumber } from '../../helper/common.helper';

class TokenService {

	/**
	 * get all tokens
	 * @param data 
	 * @returns 
	 */
	async getAllTokens(data: {
		page: number;
		limit: number;
	}): Promise<IESResponse> {
		try {
			const [tokens, tokensCount] = await prisma.$transaction([
				prisma.tokens.findMany({
					skip: data.page * data.limit,
					take: data.limit,
					orderBy: {
						createdAt: 'desc',
					},
				}),
				prisma.tokens.count(),
			]);			
			if (!tokens?.length) throw new Error(RES_MSG.NOT_FOUND);

			return {
				error: false,
				message: RES_MSG.SUCCESS,
				data: {
					count: tokensCount,
					tokens: convertBigIntToNumber(tokens),
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

	/**
	 * get token by address
	 * @param contractAddress 
	 * @returns 
	 */
	async getTokenByAddress(contractAddress: string): Promise<IESResponse> {
		try {
			const tokenData = await prisma.tokens.findUnique({
				where: { contractAddress: contractAddress },
			});
			if (!tokenData) {
				throw new Error(RES_MSG.NOT_FOUND);
			}
			return {
				error: false,
				message: RES_MSG.SUCCESS,
				data: {
					token: convertBigIntToNumber([tokenData])[0]
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

export default new TokenService();
