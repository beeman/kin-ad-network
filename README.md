# Kin Ads Network

This repository contains the infrastructure and the codebase for the Kin Ads Network. There are three
main functionalities in this repository:

1.  A daily cron job that saves revenue per app and per ad network, so apps can be
    compensated correctly.
2.  An API that returns the information of an app (like average eCPM) for a specific day.

## How to use this as an app developer

Very simple! Integrate the IronSource SDK in your app per the instruction. Then, notify us with your
app ID and we will do the rest.

## How to run this as a developer

- Clone the script
- Run `yarn install`
- Run `yarn lint` for linting or `yarn coverage` for unit test coverage

To deploy the app, run `serverless deploy`. It will create an application in your linked AWS account on the
development stage. Refer to serverless docs for more information on deploying.

