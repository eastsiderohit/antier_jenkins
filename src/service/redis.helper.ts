import { RedisClientType, createClient } from 'redis';
import logger from '../lib/logger';

class RedisService {
	client: RedisClientType;

	constructor() {
		this.startRedis();
	}

	public async startRedis() {
		this.client = createClient({
			url: `redis://${environment.redisHost}:${environment.redisPort}`,
		});

		await this.client.connect();

		this.client.on('connect', () => {
			logger.info('Connect');
		});
		this.client.on('ready', () => {
			logger.info('Ready');
		});
		this.client.on('reconnecting', () => {
			logger.info('Reconnecting');
		});

		this.client.on('end', () => {
			logger.info('End');
		});
		this.client.on('error', (err: Error) =>
			logger.error(
				'\x1b[31m%s\x1b[0m',
				'Error while connecting redis server: ',
				err.message,
			),
		);
	}

	public async setString<T>(key: string, data: T) {
		try {
			const res = await this.client.setEx(
				key,
				environment.redisExpiry,
				JSON.stringify(data),
			);
			logger.info('Redis Data Saving Response: ', res);
		} catch (err) {
			logger.error('Error while setting the data into redis: ', err);
		}
	}

	// get the string data from redis
	public async getString(key: string) {
		try {
			const res = (await this.client.get(key)) as string;
			return JSON.parse(res);
		} catch (err) {
			logger.error('Error while getting the data from redis: ', err);
			return [];
		}
	}
}
export default new RedisService();
