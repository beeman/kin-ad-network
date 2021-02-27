import {
    Client, Environment, PrivateKey, quarksToKin,
} from '@kinecosystem/kin-sdk-v2';
import { LambdaResponse } from '../constants';

const returnMessage = (data: unknown): LambdaResponse => ({
    headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
    },
    statusCode: 200,
    body: JSON.stringify(data),
});

const hotWalletStatus = async (): Promise<LambdaResponse> => {
    let client = new Client(Environment.Test, {
        appIndex: 159,
        whitelistKey: PrivateKey.fromString(process.env.HOT_WALLET_SECRET),
        kinVersion: 4,
    });
    if (process.env.STAGE === 'production') {
        client = new Client(Environment.Prod, {
            appIndex: 159,
            whitelistKey: PrivateKey.fromString(process.env.HOT_WALLET_SECRET),
            kinVersion: 4,
        });
    }
    const publicKey = PrivateKey.fromString(process.env.HOT_WALLET_SECRET).publicKey();
    const balance = quarksToKin((await client.getBalance(publicKey)).toString());

    return returnMessage({
        balance,
        // eslint-disable-next-line @typescript-eslint/camelcase
        public_address: publicKey.stellarAddress(),
    });
};

export default hotWalletStatus;
