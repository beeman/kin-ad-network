/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import fetch from 'node-fetch';
import moment from 'moment-es6';

interface AdgemResult {
    app_id: number;
    app_name: string;
    offer_wall_loads: number;
    gross_clicks: number;
    distinct_clicks: number;
    conversions: number;
    impressions: number;
    instruction_views: number;
    payout: number;
    count: number;
    ctr: string | number;
    cver: number;
    ecpm: string | number;
}

const ENDPOINT = 'https://dashboard.adgem.com/v1/report';

const getData = async (date: moment.Moment) => {
    const res = await fetch(
        `${ENDPOINT}?group_by[]=app_id&date_range[start_date]=${date.startOf('day').format('YYYY-MM-DD HH:mm:ss')}&date_range[end_date]=${date.endOf('day').format('YYYY-MM-DD HH:mm:ss')}`,
        {
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${process.env.ADGEM_SECRET_KEY!}`,
            },
        },
    );

    return res.json();
};

const parseData = (data: AdgemResult[]) => {
    const report = {};
    data.forEach((item) => {
        report[item.app_id] = {
            ADGEM: {
                clicks: item.gross_clicks,
                impressions: item.impressions,
                revenue: item.payout,
            },
        };
    });
    return report;
};

const reporting = async (date: moment.Moment) => {
    const data: AdgemResult[] = await getData(date);
    return parseData(data);
};

export default reporting;
