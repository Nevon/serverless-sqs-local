Serverless SQS Local
====================

A Serverless plugin for using ElasticMQ for local development with SQS.

It allows you to create and remove queues defined in your serverless.yml in a locally running ElasticMQ instance, so that you do not have to rely on AWS SQS while developing.

# Usage

1. Run ElasticMQ locally. Either directly or using docker. See the ElasticMQ docs for more information.
2. `yarn add -D serverless-sqs-local` / `npm install --save-dev serverless-sqs-local`
3. Add `serverless-sqs-local` to the `Plugins` section of your `serverless.yml`
4. Run `SQS_ENDPOINT=<url_to_elasticmq> sls sqs migrate` to create the queues.
5. Run `SQS_ENDPOINT=<url_to_elasticmq> sls sqs remove` to remove the queues.

The plugin will output the URLs to the queues. They typically have the form `<SQS_ENDPOINT>/queue/queue-name`.

# Notes

* This plugin currently does not expose a way to install, start and stop ElasticMQ. My current thinking is that this is something that should be solved outside of `serverless`. If you disagree, open an issue and make your case. I am potentially open to contributions to add support for this.
* If you have ideas for how to expose the queue urls to the application, please open an issue and explain your idea.

# Contributions

If you want to add a new feature, please first open an issue and discuss it with me. If you open a PR directly, it's possible that it might be rejected and your efforts wasted.