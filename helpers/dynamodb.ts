/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DynamoDB } from 'aws-sdk';
import { Client, User, IronSourceReportAppData } from '../constants';

export const getAllUsers = async (): Promise<User[]> => {
    const ddb = new DynamoDB({ region: process.env.REGION });
    const { Items } = await ddb.scan({
        TableName: process.env.APPS_TABLE_NAME!,
        ExpressionAttributeNames: { '#dataIdx': 'dataIdx' },
        ExpressionAttributeValues: { ':username': { S: 'username' } },
        FilterExpression: 'begins_with(#dataIdx, :username)',
        ProjectionExpression: 'userId, appId, wallet',
    }).promise();

    return Items.map((item) => DynamoDB.Converter.unmarshall(item) as User);
};

export const getReportForUserAndDay = async (
    userId: string,
    date: string,
): Promise<IronSourceReportAppData[]> => {
    const ddb = new DynamoDB({ region: process.env.REGION });
    const { Items } = await ddb.query({
        ExpressionAttributeNames: { '#userId': 'userId', '#dateMedationId': 'dateMedationId' },
        ExpressionAttributeValues: { ':userId': { S: userId }, ':date': { S: date } },
        TableName: process.env.REPORTING_TABLE_NAME!,
        KeyConditionExpression: '#userId = :userId AND begins_with(#dateMedationId, :date)',
        ProjectionExpression: 'revenue',
    }).promise();

    return Items.map((item) => DynamoDB.Converter.unmarshall(item) as IronSourceReportAppData);
};

// GLOBAL!
const userCache = {};
export const getUser = async (userId: string): Promise<User> => {
    if (userCache[userId] && userCache[userId].expires > Date.now()) {
        return userCache[userId].data;
    }
    const ddb = new DynamoDB({ region: process.env.REGION });
    const { Items } = await ddb.query({
        ExpressionAttributeNames: { '#userId': 'userId', '#dataIdx': 'dataIdx' },
        ExpressionAttributeValues: { ':userId': { S: userId }, ':username': { S: 'username' } },
        TableName: process.env.APPS_TABLE_NAME!,
        KeyConditionExpression: '#userId = :userId AND begins_with(#dataIdx, :username)',
    }).promise();

    if (!Items || Items.length === 0) {
        throw Error(`Could not find user with ID: ${userId}`);
    }
    const user = DynamoDB.Converter.unmarshall(Items[0]) as User;
    userCache[userId] = { data: user, expires: Date.now() + (60 * 1000) };
    return user;
};

// GLOBAL!
const clientCache = {};
export const getClient = async (network: string, clientId: string): Promise<Client> => {
    if (clientCache[clientId] && clientCache[clientId].expires > Date.now()) {
        return clientCache[clientId].data;
    }

    const ddb = new DynamoDB({ region: process.env.REGION });
    const { Items } = await ddb.query({
        ExpressionAttributeNames: { '#dataIdx': 'dataIdx' },
        ExpressionAttributeValues: { ':dataIdx': { S: `callback#${network}#${clientId}` } },
        TableName: process.env.APPS_TABLE_NAME!,
        IndexName: 'dataIndex',
        KeyConditionExpression: '#dataIdx = :dataIdx',
    }).promise();

    if (!Items || Items.length === 0) {
        throw Error(`Could not find client with ID: ${clientId}`);
    }

    const client = DynamoDB.Converter.unmarshall(Items[0]) as Client;
    clientCache[clientId] = { data: client, expires: Date.now() + (60 * 1000) };
    return client;
};

export const getClientByUsername = async (username: string): Promise<Client> => {
    const ddb = new DynamoDB({ region: process.env.REGION });
    const { Items } = await ddb.query({
        ExpressionAttributeNames: { '#dataIdx': 'dataIdx' },
        ExpressionAttributeValues: { ':dataIdx': { S: `username#${username}` } },
        TableName: process.env.APPS_TABLE_NAME!,
        IndexName: 'dataIndex',
        KeyConditionExpression: '#dataIdx = :dataIdx',
    }).promise();

    if (!Items || Items.length === 0) {
        throw Error(`Could not find client with ID: ${username}`);
    }
    return DynamoDB.Converter.unmarshall(Items[0]) as Client;
};

export const saveEvent = (
    userId: string,
    eventId: string,
    appUserId: string,
    ipAddress: string,
): Promise<unknown> => {
    const ddb = new DynamoDB({ region: process.env.REGION });
    const expires = Math.floor(Date.now() / 1000) + 86400; // Expire after a day

    return ddb.updateItem({
        Key: {
            userId: { S: userId },
            eventId: { S: `${appUserId}#${eventId}` },
        },
        TableName: process.env.APP_EVENTS_TABLE_NAME!,
        UpdateExpression: 'SET #expires = :expires, #ipAddress = :ipAddress',
        ExpressionAttributeNames: {
            '#expires': 'expires',
            '#ipAddress': 'ipAddress',
        },
        ExpressionAttributeValues: DynamoDB.Converter.marshall({
            ':expires': expires,
            ':ipAddress': ipAddress,
        }),
    }).promise();
};

export const savePayout = (
    userId: string,
    date: string,
    txId: string,
    kin: number,
    revenue: number,
    kinPrice: number,
): Promise<unknown> => {
    const ddb = new DynamoDB({ region: process.env.REGION });

    return ddb.updateItem({
        Key: {
            userId: { S: userId },
            date: { S: date },
        },
        TableName: process.env.PAYOUTS_TABLE_NAME!,
        UpdateExpression: 'SET #txId = :txId, #kin = :kin, #revenue = :revenue, #kinPrice = :kinPrice',
        ExpressionAttributeNames: {
            '#txId': 'txId',
            '#kin': 'kin',
            '#revenue': 'revenue',
            '#kinPrice': 'kinPrice',
        },
        ExpressionAttributeValues: DynamoDB.Converter.marshall({
            ':txId': txId,
            ':kin': kin,
            ':revenue': revenue,
            ':kinPrice': kinPrice,
        }),
    }).promise();
};

export const isPayoutAlreadyDone = async (userId: string, date: string): Promise<boolean> => {
    const ddb = new DynamoDB({ region: process.env.REGION });
    const { Items } = await ddb.query({
        ExpressionAttributeNames: { '#userId': 'userId', '#date': 'date' },
        ExpressionAttributeValues: { ':userId': { S: userId }, ':date': { S: date } },
        TableName: process.env.PAYOUTS_TABLE_NAME!,
        KeyConditionExpression: '#userId = :userId AND #date = :date',
    }).promise();

    if (!Items || Items.length === 0) {
        return false;
    }
    return true;
};
