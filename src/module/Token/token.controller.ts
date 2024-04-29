import * as express from 'express';
import tokenService from './token.service';
import { Request, Response } from 'express';
import * as Helpers from '../../service/index';
import { Controller } from '../../interfaces/index';
import { getTokenValidation } from './token.validation';
import { getContractByAddressValidation } from '../contract/contract.validation';


const setResponse = Helpers.ResponseHelper;

class TokenController implements Controller {
	public router = express.Router();

	constructor() {
		this.initializeRoutes();
	}

	private initializeRoutes() {
		this.router
			.get(
				`/all-tokens`,
				getTokenValidation,
				this.getAllTokens,
			)
			.get(
				'/token-by-contractAddress/:contractAddress'
				, getContractByAddressValidation, this.getTokenByAddress);
	}

	/**
	 * fetch all tokens data
	 * @param request 
	 * @param response 
	 * @returns 
	 */
	private getAllTokens = async (request: Request, response: Response) => {
		const data = {
			page: !request.query?.page ? 0 : Number(request.query.page) - 1,
			limit: !request.query?.limit ? 10 : Number(request.query.limit),
		};

		const contracts = await tokenService.getAllTokens(data);

		if (contracts.error) {
			return setResponse.error(response, contracts);
		}
		return setResponse.success(response, contracts);
	};

	/**
	 * get token by contract address
	 * @param request 
	 * @param response 
	 * @returns 
	 */
	private getTokenByAddress = async (
		request: Request,
		response: Response,
	) => {
		const tokenByAddress = await tokenService.getTokenByAddress(
			request.params?.contractAddress,
		);

		if (tokenByAddress.error) {
			return setResponse.error(response, tokenByAddress);
		}
		return setResponse.success(response, tokenByAddress);
	};
}

export default TokenController;
