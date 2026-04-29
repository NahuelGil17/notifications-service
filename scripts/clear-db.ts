import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env
dotenv.config({ path: resolve(__dirname, '../.env') });

async function clearDb() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/notifications';
  console.log(`Connecting to: ${uri}`);
  
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();
    
    console.log('Cleaning up WhatsApp session and keys...');
    
    // Drop collections if they exist
    const collections = await db.listCollections().toArray();
    const names = collections.map(c => c.name);

    if (names.includes('whatsapp_sessions')) {
      await db.collection('whatsapp_sessions').drop();
      console.log('✅ Dropped whatsapp_sessions');
    }

    if (names.includes('whatsapp_keys')) {
      await db.collection('whatsapp_keys').drop();
      console.log('✅ Dropped whatsapp_keys');
    }

    console.log('Done! Your database is clean and ready for a fresh login.');
  } catch (error) {
    console.error('❌ Error clearing database:', error);
  } finally {
    await client.close();
  }
}

clearDb();
