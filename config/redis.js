import { createClient } from 'redis';

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = createClient({
        username: process.env.REDIS_USERNAME || 'default',
        password: process.env.REDIS_PASSWORD || '8HvTbpfZsUhsy0imfdqjSHionn4Dhey3',
        socket: {
          host: process.env.REDIS_HOST || 'redis-17550.c10.us-east-1-4.ec2.redns.redis-cloud.com',
          port: parseInt(process.env.REDIS_PORT) || 17550
        }
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('Redis client connected');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        console.log('Redis client disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
      console.log('Successfully connected to Redis');
      return true;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      this.isConnected = false;
      return false;
    }
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      console.log('Redis client disconnected');
    }
  }

  // Token blacklist operations
  async blacklistToken(token, expirationSeconds = 24 * 60 * 60) {
    try {
      if (!this.isConnected || !this.client) {
        console.warn('Redis not connected, cannot blacklist token');
        return false;
      }

      const key = `blacklisted_token:${token}`;
      await this.client.setEx(key, expirationSeconds, 'blacklisted');
      return true;
    } catch (error) {
      console.error('Error blacklisting token:', error);
      return false;
    }
  }

  async isTokenBlacklisted(token) {
    try {
      if (!this.isConnected || !this.client) {
        console.warn('Redis not connected, assuming token is valid');
        return false;
      }

      const key = `blacklisted_token:${token}`;
      const result = await this.client.get(key);
      return result === 'blacklisted';
    } catch (error) {
      console.error('Error checking token blacklist:', error);
      // If Redis fails, assume token is valid to avoid blocking users
      return false;
    }
  }

  // General Redis operations
  async set(key, value, expirationSeconds = null) {
    try {
      if (!this.isConnected) return false;
      
      if (expirationSeconds) {
        await this.client.setEx(key, expirationSeconds, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      console.error('Redis SET error:', error);
      return false;
    }
  }

  async get(key) {
    try {
      if (!this.isConnected) return null;
      return await this.client.get(key);
    } catch (error) {
      console.error('Redis GET error:', error);
      return null;
    }
  }

  async del(key) {
    try {
      if (!this.isConnected) return false;
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('Redis DEL error:', error);
      return false;
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      client: !!this.client
    };
  }
}

// Create singleton instance
const redisClient = new RedisClient();

export default redisClient;