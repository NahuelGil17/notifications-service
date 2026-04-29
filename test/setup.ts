import { MongoMemoryServer } from 'mongodb-memory-server';

export default async function () {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  process.env.API_KEY_PEPPER = 'test_pepper_1234567890_at_least_16_chars';
  process.env.NODE_ENV = 'test';
  
  // Store the mongod instance globally to stop it later
  (global as any).__MONGOD__ = mongod;
}
