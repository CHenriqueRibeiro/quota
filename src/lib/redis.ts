import Redis from 'ioredis';

type PingResult = string;

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
  reconnectOnError(err) {
    if (!err) return true;
    const message = (err as Error).message || '';
    return /ECONNREFUSED|EPIPE|ETIMEDOUT|ECONNRESET/.test(message);
  }
});

redis.on('connect', () => console.info('✅ Redis connected successfully!'));
redis.on('error', (err: Error) => console.error('❌ Redis connection error:', err));
redis.on('ready', () => console.info('🚀 Redis is ready to use!'));

redis.ping().then((result: PingResult) => console.info('Ping Result:', result)).catch((err: Error) => console.error('Ping Error:', err));

export { redis };