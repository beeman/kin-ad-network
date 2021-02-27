import fetch from 'node-fetch';
import { ExchangeAsk } from '../../constants';

// eslint-disable-next-line import/prefer-default-export
export const getAsks = async (): Promise<ExchangeAsk[]> => {
    const url = `https://api.cointiger.com/exchange/trading/api/market/depth?api_key=${process.env.COINTIGER_KEY!}&symbol=kinusdt&type=step0`;
    const rawResult = await fetch(url);
    const result = await rawResult.json();
    const { asks } = result.data.depth_data.tick;
    return asks.map((ask) => ({ price: parseFloat(ask[0]), volume: ask[1] }));
};
