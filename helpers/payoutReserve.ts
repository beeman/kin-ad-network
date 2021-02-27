/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DynamoDB } from 'aws-sdk';

const CURRENT_RESERVE_KEY = 'currentReserve';

export const updateReserve = async (amount: number): Promise<unknown> => {
    const ddb = new DynamoDB({ region: process.env.REGION });

    return ddb.updateItem({
        Key: {
            name: { S: CURRENT_RESERVE_KEY },
        },
        UpdateExpression: 'SET #value = :value',
        ExpressionAttributeNames: {
            '#value': 'value',
        },
        ExpressionAttributeValues: DynamoDB.Converter.marshall({
            ':value': amount,
        }),
        TableName: process.env.SETTINGS_TABLE_NAME!,
    }).promise();
};

export const getCurrentReserve = async (): Promise<number> => {
    const ddb = new DynamoDB({ region: process.env.REGION });
    const { Items } = await ddb.query({
        ExpressionAttributeNames: { '#name': 'name' },
        ExpressionAttributeValues: { ':name': { S: CURRENT_RESERVE_KEY } },
        TableName: process.env.SETTINGS_TABLE_NAME!,
        KeyConditionExpression: '#name = :name',
    }).promise();

    if (!Items || Items.length === 0) {
        throw Error('Could not find reserve');
    }
    return parseFloat(DynamoDB.Converter.unmarshall(Items[0]).value) as number;
};
