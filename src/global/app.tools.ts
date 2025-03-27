//ideas from https://attacomsian.com/blog/nodejs-encrypt-decrypt-data but modified for async using promisify (see https://stackoverflow.com/questions/63125747/how-to-use-async-await-using-crypto-randombytes-in-nodejs)
import * as crypto from 'crypto';
import { parsedEnv } from './app.settings';

export class CryptoTools {

    static algorithm = 'aes-256-ctr';
    static secretKey = parsedEnv.SECRET_KEY_FOR_CRYPTO_ENCRYPTION;

    /**
     * Pass text to encrypt. It returns the encrypted text and the associated initiation value (iv)
     * @param text 
     * @returns 
     */
    public static encrypt = async (text: string): Promise<{ iv: string, content: string }> => {
        //promisify to make asynchronous
        return new Promise((resolve, reject) => {
            try {
                const iv = crypto.randomBytes(16);
                const cipher = crypto.createCipheriv(CryptoTools.algorithm, CryptoTools.secretKey, iv);
                const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
                resolve({
                    iv: iv.toString('hex'),
                    content: encrypted.toString('hex')
                });
            } catch (error) {
                reject(error);
            }
        });

    }

    public static decrypt = async (encryptedInfo: { iv: string, content: string }): Promise<string> => {

        return new Promise((resolve, reject) => {
            try {
                const decipher = crypto.createDecipheriv(CryptoTools.algorithm, CryptoTools.secretKey, Buffer.from(encryptedInfo.iv, 'hex'));
                const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedInfo.content, 'hex')), decipher.final()]);
                resolve(decrypted.toString());
            } catch (error) {
                reject(error);
            }
        })

    }

    public static generatePassword = async (): Promise<string> => {
        return new Promise((resolve, reject) => {
            try {
                resolve(crypto.randomBytes(12).toString('hex'));
            } catch (error) {
                reject(error);
            }
        })
    }

    /**
     * Non async version for call from entities
     * @param text 
     */
    public static encryptSync = (text: string) => {
        const encrypt = (text: string): { iv: string, content: string } => {

            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv(CryptoTools.algorithm, CryptoTools.secretKey, iv);
            const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
            return {
                iv: iv.toString('hex'),
                content: encrypted.toString('hex')
            };
        }
    }
}