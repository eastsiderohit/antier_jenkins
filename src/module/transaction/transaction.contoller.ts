import * as express from 'express';
import { Request, Response } from 'express';
import * as Helpers from '../../service/index';
import TransactionService from './transaction.service';
import { Controller } from '../../interfaces/index';
import {
	getTxValidation,
	getTxByHashValidation,
	getTxByAddressValidation,
	getTxByBlock,
} from './transaction.validation';
const setResponse = Helpers.ResponseHelper;

class ExplorerController implements Controller {
	public router = express.Router();

	constructor() {
		this.initializeRoutes();
	}

	private initializeRoutes() {
		this.router
			.get(
				'/get-all-transactions',
				getTxValidation,
				this.getAllTransaction,
			)
			// .get(
			// 	'/get-transaction-by-hash/:transactionHash',
			// 	getTxByHashValidation,
			// 	this.getTransactionByHash,
			// )
			.get(
				'/get-transaction-by-address',
				getTxByAddressValidation,
				this.getTransactionByAddress,
			)
			.get(
				'/get-transaction-by-block',
				getTxByBlock,
				this.getTransactionByBlock,
			);
	}

	private getAllTransaction = async (
		request: Request,
		response: Response,
	) => {
		const data = {
			page: !request.query?.page ? 0 : Number(request.query.page) - 1,
			limit: !request.query?.limit ? 10 : Number(request.query.limit),
		};

		const res = await TransactionService.getAllTransaction(data);

		if (res.error) {
			return setResponse.error(response, res);
		}
		return setResponse.success(response, res);
	};

	private getTransactionByHash = async (
		request: Request,
		response: Response,
	) => {
		const transactionByHash = await TransactionService.getTransactionByHash(
			request.params?.transactionHash,
		);

		if (transactionByHash.error) {
			return setResponse.error(response, transactionByHash);
		}
		return setResponse.success(response, transactionByHash);
	};

	private getTransactionByAddress = async (
		request: Request,
		response: Response,
	) => {
		const data = {
			page: !request.query?.page ? 0 : Number(request.query.page) - 1,
			limit: !request.query?.limit ? 10 : Number(request.query.limit),
			address: <string>request.query.address,
		};
		const transactionByAddress =
			await TransactionService.getTransactionByAddress(data);
		if (transactionByAddress.error) {
			return setResponse.error(response, transactionByAddress);
		}
		return setResponse.success(response, transactionByAddress);
	};

	private getTransactionByBlock = async (
		request: Request,
		response: Response,
	) => {
		const data = {
			page: !request.query?.page ? 0 : Number(request.query.page) - 1,
			limit: !request.query?.limit ? 10 : Number(request.query.limit),
			value: !request.query.value ? '' : <string>request.query.value,
		};
		const transactionByBlock =
			await TransactionService.getTransactionByBlock(data);

		if (transactionByBlock.error) {
			return setResponse.error(response, transactionByBlock);
		}
		return setResponse.success(response, transactionByBlock);
	};
}

export default ExplorerController;
