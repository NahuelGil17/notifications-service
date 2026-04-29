import { Model } from 'mongoose';
import { AuthenticationState, AuthenticationCreds, BufferJSON, initAuthCreds, proto, SignalDataTypeMap } from 'baileys';
import { WhatsAppSessionDocument } from './wa-session.schema';
import { WhatsAppKeyDocument } from './wa-key.schema';

export const useMongoAuthState = async (
  sessionModel: Model<WhatsAppSessionDocument>,
  keyModel: Model<WhatsAppKeyDocument>
): Promise<{ state: AuthenticationState, saveCreds: () => Promise<void> }> => {
  
  const session = await sessionModel.findOne({ id: 'default' }).exec();
  const creds: AuthenticationCreds = session?.creds 
    ? JSON.parse(JSON.stringify(session.creds), BufferJSON.reviver) 
    : initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: { [id: string]: SignalDataTypeMap[typeof type] } = {};
          
          const keyMap: { [mongoKey: string]: string } = {};
          const mongoKeys = ids.map(id => {
            const mongoKey = `default:${type}:${id}`.replace(/\:/g, '-');
            keyMap[mongoKey] = id;
            return mongoKey;
          });

          const foundKeys = await keyModel.find({ keyId: { $in: mongoKeys } }).exec();

          for (const doc of foundKeys) {
            const originalId = keyMap[doc.keyId];
            if (originalId) {
              let value = JSON.parse(JSON.stringify(doc.data), BufferJSON.reviver);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[originalId] = value;
            }
          }
          
          return data;
        },
        set: async (data) => {
          try {
            const bulkOps: any[] = [];

            for (const category in data) {
              for (const id in data[category]) {
                const value = (data as any)[category][id];
                const keyId = `default:${category}:${id}`.replace(/:/g, '-');

                if (value != null) {
                  const serialized = JSON.parse(JSON.stringify(value, BufferJSON.replacer));
                  bulkOps.push({
                    updateOne: {
                      filter: { keyId },
                      update: { $set: { data: serialized } },
                      upsert: true,
                    },
                  });
                } else {
                  bulkOps.push({ deleteOne: { filter: { keyId } } });
                }
              }
            }

            if (bulkOps.length > 0) {
              await keyModel.bulkWrite(bulkOps);
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const stack = err instanceof Error ? err.stack : undefined;
            console.error('❌ Failed to write WhatsApp keys:', message, stack);
            throw err;
          }
        }
      }
    },
    saveCreds: async () => {
      try {
        await sessionModel.findOneAndUpdate(
          { id: 'default' },
          { $set: { creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)) } },
          { upsert: true }
        );
      } catch (err) {
        console.error('❌ Failed to save WhatsApp creds to Mongo:', err);
      }
    }
  };
};
