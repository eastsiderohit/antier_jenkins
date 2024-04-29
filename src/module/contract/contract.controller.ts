import * as express from 'express';
import { Request, Response } from 'express';
import * as Helpers from '../../service/index';
import ContractService from './contract.service';
import { Controller } from '../../interfaces/index';
import {
	getContractValidation,
	getContractByAddressValidation,
	getContractTxValidation,
} from './contract.validation';

const setResponse = Helpers.ResponseHelper;

class ContractController implements Controller {
	public router = express.Router();

	constructor() {
		this.initializeRoutes();
	}

	private initializeRoutes() {
		this.router
			.get(
				`/all-contracts`,
				getContractValidation,
				this.getAllContract,
			)
			.get(
				`/contract-detail-by-address/:contractAddress`,
				getContractByAddressValidation,
				this.getContractByAddress,
			)
			.get(
				`/all-transaction`,
				getContractTxValidation,
				this.getContractTransaction,
			)
			.get(
				`/get-internal-tx`,
				getContractTxValidation,
				this.getInternalTx,
			)
			.get(`/popular`, getContractValidation, this.getPopularTx)
	}


	private getAllContract = async (request: Request, response: Response) => {
		const data = {
			page: !request.query?.page ? 0 : Number(request.query.page) - 1,
			limit: !request.query?.limit ? 10 : Number(request.query.limit),
		};

		const contracts = await ContractService.getAllContract(data);

		if (contracts.error) {
			return setResponse.error(response, contracts);
		}
		return setResponse.success(response, contracts);
	};

	private getContractByAddress = async (
		request: Request,
		response: Response,
	) => {
		const contractByAddress = await ContractService.getContractByAddress(
			request.params?.contractAddress,
		);

		if (contractByAddress.error) {
			return setResponse.error(response, contractByAddress);
		}
		return setResponse.success(response, contractByAddress);
	};

	private getContractTransaction = async (
		request: Request,
		response: Response,
	) => {
		const data = {
			page: !request.query?.page ? 0 : Number(request.query.page) - 1,
			limit: !request.query?.limit ? 10 : Number(request.query.limit),
			contractAddress: <string>request.query?.contractAddress,
		};
		const contractTx = await ContractService.getContractTransaction(data);
		if (contractTx.error) {
			return setResponse.error(response, contractTx);
		}
		return setResponse.success(response, contractTx);
	};

	private getInternalTx = async (request: Request, response: Response) => {
		const data = {
			page: !request.query?.page ? 0 : Number(request.query.page) - 1,
			limit: !request.query?.limit ? 10 : Number(request.query.limit),
			contractAddress: <string>request.query.contractAddress,
		};
		const internalTx = await ContractService.getInternalTx(data);

		if (internalTx.error) {
			return setResponse.error(response, internalTx);
		}
		return setResponse.success(response, internalTx);
	};

	private getPopularTx = async (request: Request, response: Response) => {
		const data = {
			page: !request.query?.page ? 0 : Number(request.query.page) - 1,
			limit: !request.query?.limit ? 10 : Number(request.query.limit),
		};

		const popularTx = await ContractService.getPopularTx(data);

		if (popularTx.error) {
			return setResponse.error(response, popularTx);
		}
		return setResponse.success(response, popularTx);
	};
}

export default ContractController;
