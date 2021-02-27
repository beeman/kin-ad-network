/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import moment from 'moment-es6';
import { google, admob_v1 } from 'googleapis';
import { GaxiosResponse } from 'gaxios';

const setCredentials = async () => {
    const oauth2Client = new google.auth.OAuth2(
        process.env.ADMOB_CLIENT_ID,
        process.env.ADMOB_CLIENT_SECRET,
    );
    oauth2Client.setCredentials({
        refresh_token: process.env.ADMOB_REFRESH_TOKEN,
    });
    return oauth2Client;
};

const parseReport = (rawReport: GaxiosResponse<admob_v1.Schema$GenerateNetworkReportResponse>) => {
    const { data } = rawReport;
    const report = {};

    // Bug in typing (missing array)
    (data as unknown[]).forEach((record: admob_v1.Schema$GenerateNetworkReportResponse) => {
        if (record.row) {
            const appKey = record.row.dimensionValues.APP.value;
            report[appKey] = {};
            report[appKey].ADMOB = {
                appFillRate: Math.round(100 * record.row.metricValues.SHOW_RATE.doubleValue),
                clicks: parseInt(record.row.metricValues.CLICKS.integerValue, 10),
                impressions: parseInt(record.row.metricValues.IMPRESSIONS.integerValue, 10),
                revenue: parseInt(record.row.metricValues.ESTIMATED_EARNINGS.microsValue, 10) / 1e6,
            };
        }
    });

    return report;
};

const reporting = async (date: moment.Moment) => {
    const auth = await setCredentials();
    const admob = google.admob({ version: 'v1' });
    const report = await admob.accounts.networkReport.generate({
        auth,
        parent: `accounts/${process.env.ADMOB_PUB_ID}`,
        requestBody: {
            reportSpec: {
                dateRange: {
                    startDate: { year: date.year(), month: date.month() + 1, day: date.date() },
                    endDate: { year: date.year(), month: date.month() + 1, day: date.date() },
                },
                dimensions: ['DATE', 'APP'],
                metrics: ['CLICKS', 'ESTIMATED_EARNINGS', 'IMPRESSIONS', 'SHOW_RATE'],
                localizationSettings: {
                    currencyCode: 'USD',
                    languageCode: 'en-US',
                },
            },
        },
    });

    return parseReport(report);
};

export default reporting;
