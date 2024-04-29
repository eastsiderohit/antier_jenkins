import * as express from 'express';
import { Request, Response } from 'express';
import { Controller } from '../../interfaces/index';
import * as Helpers from '../../service/index';
import BlockService from './block.service';
import {
	getBlocksValidation,
	getBlockByHashValidation,
	getBlockDetailsValidation,
} from './block.validation';

const setResponse = Helpers.ResponseHelper;

class ExplorerController implements Controller {
	public router = express.Router();

	constructor() {
		this.initializeRoutes();
	}

	private initializeRoutes() {
		this.router
			.get('/get-all-blocks', getBlocksValidation, this.getAllBlock)
			// .get(
			// 	'/get-block-by-hash/:blockHash',
			// 	getBlockByHashValidation,
			// 	this.getBlockByHash,
			// )
			// .get(
			// 	'/get-block-details',
			// 	getBlockDetailsValidation,
			// 	this.getBlockDetails,
			// )
			.get('/get-latest-block', this.getLatestBlock);
	}

	private getAllBlock = async (request: Request, response: Response) => {
		const data = {
			page: !request.query?.page ? 0 : Number(request.query?.page) - 1,
			limit: !request.query?.limit ? 10 : Number(request.query?.limit),
		};

		const res = await BlockService.getAllLatestBlock(data);

		if (res.error) {
			return setResponse.error(response, res);
		}
		return setResponse.success(response, res);
	};

	private getBlockByHash = async (request: Request, response: Response) => {
		const blockByHash = await BlockService.getBlockByHash(
			request.params?.blockHash?.toLowerCase(),
		);

		if (blockByHash.error) {
			return setResponse.error(response, blockByHash);
		}
		return setResponse.success(response, blockByHash);
	};

	private getBlockDetails = async (request: Request, response: Response) => {
		// const blockNumber = Number(request.query.blockNumber);
		const blockDetails = await BlockService.getBlockDetails(
			request.query?.blockIdentity as string,
		);
		if (blockDetails.error) {
			return setResponse.error(response, blockDetails);
		}
		return setResponse.success(response, blockDetails);
	};

	private getLatestBlock = async (request: Request, response: Response) => {
		const blocks = await BlockService.getLatestBlock();

		if (blocks.error) {
			return setResponse.error(response, blocks);
		}

		return setResponse.success(response, blocks);
	};
}

export default ExplorerController;
