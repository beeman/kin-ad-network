import fetch from 'node-fetch';
import crypto from 'crypto';
import { ExchangeAsk } from '../../constants';

const MIN_BUY_ORDER = 1e6;

// eslint-disable-next-line import/prefer-default-export
export const getAsks = async (): Promise<ExchangeAsk[]> => {
    const url = 'https://global-openapi.bithumb.pro/openapi/v1/spot/orderBook?symbol=KIN-USDT';
    const rawResult = await fetch(url);
    const result = await rawResult.json();
    const asks = result.data.s;
    return asks.map((ask) => ({ price: parseFloat(ask[0]), volume: parseFloat(ask[1]) }));
};

// Returns orderId
export const getMarketBuy = async (USDAmount: number): Promise<string> => {
    const msgNo = Math.random().toString().split('.')[1];
    const timestamp = Date.now();
    const url = 'https://global-openapi.bithumb.pro/openapi/v1/spot/placeOrder';

    const signature = crypto
        .createHmac('sha256', process.env.BITHUMB_SECRET)
        .update(`apiKey=${process.env.BITHUMB_KEY}&msgNo=${msgNo}&price=-1&quantity=${USDAmount}&side=buy&symbol=KIN-USDT&timestamp=${timestamp}&type=market`)
        .digest('hex')
        .toLowerCase();

    const rawResult = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({
            apiKey: process.env.BITHUMB_KEY,
            msgNo,
            price: -1,
            quantity: USDAmount,
            side: 'buy',
            symbol: 'KIN-USDT',
            timestamp,
            type: 'market',
            signature,
        }),
        headers: {
            'Content-Type': 'application/json',
        },
    });
    const result = await rawResult.json();

    return result.data.orderId;
};

export const getKinBought = async (
    orderId: string,
): Promise<{ totalBought: number; averagePriceBought: number} > => {
    const msgNo = Math.random().toString().split('.')[1];
    const timestamp = Date.now();
    const url = 'https://global-openapi.bithumb.pro/openapi/v1/spot/orderDetail';

    const signature = crypto
        .createHmac('sha256', process.env.BITHUMB_SECRET)
        .update(`apiKey=${process.env.BITHUMB_KEY}&count=100&msgNo=${msgNo}&orderId=${orderId}&page=1&symbol=KIN-USDT&timestamp=${timestamp}`)
        .digest('hex')
        .toLowerCase();
    const rawResult = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({
            apiKey: process.env.BITHUMB_KEY,
            count: 100,
            msgNo,
            orderId,
            page: 1,
            symbol: 'KIN-USDT',
            timestamp,
            signature,
        }),
        headers: {
            'Content-Type': 'application/json',
        },
    });
    const result = await rawResult.json();

    // Substract fee because bithumb doesn't do that
    const totalBought = result.data.list.reduce(
        (acc, { getCount, fee }) => acc + parseFloat(getCount) - parseFloat(fee),
        0,
    );
    const averagePriceBought = result.data.list.reduce(
        (acc, { getCount, fee, price }) => (
            acc + ((parseFloat(getCount) - parseFloat(fee)) * parseFloat(price))
        ),
        0,
    ) / totalBought;
    return { totalBought, averagePriceBought };
};

export const determinePriceFromOrderBook = async (dollarAmount: number): Promise<number> => {
    const asks = await getAsks();
    let parsedVolume = 0;
    let priceSum = 0;
    let i = 0;
    do {
        parsedVolume += asks[i].volume;
        priceSum += asks[i].price * asks[i].volume;
        i += 1;
    } while (priceSum < dollarAmount);
    return priceSum / parsedVolume;
};

export const getMinDollarAmount = async (): Promise<number> => {
    const asks = await getAsks();
    let parsedVolume = 0;
    let priceSum = 0;
    let i = 0;
    do {
        parsedVolume += asks[i].volume;
        priceSum += asks[i].price * asks[i].volume;
        i += 1;
    } while (parsedVolume < MIN_BUY_ORDER);
    return Math.ceil(1000 * MIN_BUY_ORDER * priceSum / parsedVolume) / 1000;
};
