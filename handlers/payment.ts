/* eslint-disable @typescript-eslint/explicit-function-return-type */
import moment from 'moment-es6';
import {
    Client, Environment, kinToQuarks, PrivateKey, PublicKey, TransactionType,
} from '@kinecosystem/kin-sdk-v2';
import {
    getAllUsers,
    getReportForUserAndDay,
    savePayout,
    isPayoutAlreadyDone,
} from '../helpers/dynamodb';
import * as bithumb from '../helpers/exchanges/bithumb';
import * as payoutReserve from '../helpers/payoutReserve';

const FEE = 5;
const DAY_DELAY = 3;

const calculateRevenue = async (userId: string, date: string): Promise<number> => {
    const reports = await getReportForUserAndDay(userId, date);
    return reports.reduce((acc, val) => acc + val.revenue, 0);
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const getAllAppRevenue = async (date: string) => {
    const allApps = await getAllUsers();
    const apps = [];

    // Only consider apps which have a wallet
    for (let i = 0; i < allApps.length; i += 1) {
        if (allApps[i].wallet) {
            apps.push(allApps[i]);
        }
    }

    const revenueArray = await Promise.all(
        apps.map(({ userId }) => calculateRevenue(userId, date)),
    );
    return apps.map(
        (app, i) => ({ ...app, revenue: revenueArray[i] * (1 - (FEE / 100)) }),
    );
};

interface TransactionRequest {
    appId?: string;
    wallet?: string;
    userId: string;
    revenue: number;
    kin: number;
}

const sendAndSaveTransaction = async (
    date: string,
    request: TransactionRequest,
    kinPrice: number,
) => {
    if (!request.appId || !request.wallet || request.kin <= 0) {
        return true;
    }

    const isPayoutDone = await isPayoutAlreadyDone(request.userId, date);
    if (isPayoutDone) {
        return true;
    }

    // Only send Kin in production env
    let txId: string;
    if (process.env.STAGE === 'production') {
        const client = new Client(Environment.Prod, {
            appIndex: 159,
            whitelistKey: PrivateKey.fromString(process.env.HOT_WALLET_SECRET),
            kinVersion: 4,
        });
        const txHash = await client.submitPayment({
            sender: PrivateKey.fromString(process.env.HOT_WALLET_SECRET),
            destination: PublicKey.fromString(request.wallet),
            memo: `1-KAD1-${request.appId}`,
            type: TransactionType.Earn,
            quarks: kinToQuarks(request.kin.toString()),
        });
        txId = txHash.toString('hex');
        return savePayout(request.userId, date, txId, request.kin, request.revenue, kinPrice);
    }

    txId = Math.random().toString();
    console.log(request.userId, date, txId, request.kin, request.revenue, kinPrice);

    return true;
};

const payment = async (): Promise<boolean> => {
    let needMarketBuy = false;
    const date = moment().subtract(DAY_DELAY, 'days').format('YYYYMMDD');

    // Get app revenue in $
    const appRevenue = await getAllAppRevenue(date);
    const totalPayout = appRevenue.reduce((acc, val) => acc + val.revenue, 0);

    // Check if we can pay from the reserve
    const currentReserve = await payoutReserve.getCurrentReserve();
    if (currentReserve < totalPayout) {
        needMarketBuy = true;
    }

    // Get kin price of first $ dollars of volume (1M Kin min buy)
    const minDollarAmount = await bithumb.getMinDollarAmount();
    let kinPrice;

    if (process.env.STAGE === 'production' && needMarketBuy) {
        // Do a market order to bithumb
        // If amount to buy < 25, send 25 (because that is the minimum)
        // and then update the kin amount linearly
        // (so if $10 should have been bought, send 10/25 to the apps)
        const amountToBuy = Math.max(minDollarAmount, totalPayout);

        const orderId = await bithumb.getMarketBuy(amountToBuy);

        // Wait a second to fill the order
        await new Promise((r) => setTimeout(r, 1000));

        ({ averagePriceBought: kinPrice } = await bithumb.getKinBought(orderId));

        await payoutReserve.updateReserve(currentReserve + amountToBuy - totalPayout);
    } else if (process.env.STAGE === 'production' && !needMarketBuy) {
        kinPrice = await bithumb.determinePriceFromOrderBook(totalPayout);
        await payoutReserve.updateReserve(currentReserve - totalPayout);
    } else {
        kinPrice = 0.01;
    }

    // Get app revenue in Kin
    const appRevenueKin = appRevenue.map(
        (app) => ({ ...app, kin: Math.floor(app.revenue / kinPrice) }),
    );

    // Sequential until Solana
    for (let i = 0; i < appRevenueKin.length; i += 1) {
        const request = appRevenueKin[i];
        // eslint-disable-next-line no-await-in-loop
        await sendAndSaveTransaction(date, request, kinPrice);
    }

    // await Promise.all(
    //     appRevenueKin.map((request) => sendAndSaveTransaction(date, request, kinPrice)),
    // );
    return true;
};

export default payment;
