const _ = require("lodash");

const SQS_ENDPOINT = process.env.SQS_ENDPOINT || "http://localhost:9324";

class SqsLocalPlugin {
  constructor(serverless, options, aws) {
    this.serverless = serverless;
    this.service = serverless.service;
    this.log = message =>
      serverless.cli.log.bind(serverless.cli)(`SQS - ${message}`);
    this.options = options;
    this.aws = aws;
    this.sqs = new aws.SQS({
      endpoint: new aws.Endpoint(SQS_ENDPOINT),
      accessKeyId: "na",
      secretAccessKey: "na",
      region: "eu-west-1"
    });
  }

  getCommands() {
    return {
      sqs: {
        commands: {
          migrate: {
            lifecycleEvents: ["migrateHandler"],
            usage: "Creates queues from the current Serverless configuration."
          },
          remove: {
            lifecycleEvents: ["removeHandler"],
            usage:
              "Removes all queues listed in the current Serverless configuration."
          }
        }
      }
    };
  }

  getHooks() {
    return {
      "sqs:migrate:migrateHandler": this.migrateHandler.bind(this),
      "sqs:remove:removeHandler": this.removeHandler.bind(this)
    };
  }

  migrateHandler() {
    this.log("Migrating...");
    const queues = this.getQueues();

    return this.createQueues(queues).then(created => {
      created.forEach(x => this.log(`Created queue at ${x}`));
    });
  }

  removeHandler() {
    this.log("Removing queues...");
    const queuesInConfiguration = this.getQueues();

    return this.removeQueues(queuesInConfiguration)
      .then(removed => {
        removed
          .filter(n => n)
          .forEach(removedQueue => this.log(`Deleted ${removedQueue}`));
      })
      .catch(err => this.log(err));
  }

  getQueues() {
    let stacks = [];

    const defaultStack = this.getDefaultStack();
    if (defaultStack) {
      stacks.push(defaultStack);
    }

    if (this.hasAdditionalStacksPlugin()) {
      stacks = stacks.concat(this.getAdditionalStacks());
    }

    return stacks
      .map(stack => this.getQueueDefinitionsFromStack(stack))
      .reduce((queues, queuesInStack) => queues.concat(queuesInStack), []);
  }

  createQueues(queues = []) {
    return Promise.all(queues.map(queue => this.createQueue(queue)));
  }

  resolveDeadLetterTargetArn(redrivePolicy) {
    return this.resolve(redrivePolicy.deadLetterTargetArn);
  }

  createQueue({
    QueueName,
    ContentBasedDeduplication,
    DelaySeconds,
    FifoQueue,
    MaximumMessageSize,
    MessageRetentionPeriod,
    ReceiveMessageWaitTimeSeconds,
    RedrivePolicy,
    VisibilityTimeout
  }) {
    let attributes = {
      ContentBasedDeduplication,
      DelaySeconds,
      FifoQueue,
      MaximumMessageSize,
      MessageRetentionPeriod,
      ReceiveMessageWaitTimeSeconds,
      RedrivePolicy,
      VisibilityTimeout
    };

    const deadLetterTargetArn = _.get(
      attributes,
      "RedrivePolicy.deadLetterTargetArn",
      ""
    );
    if (_.isObject(deadLetterTargetArn)) {
      this.log(
        `Omitting RedrivePolicy for ${QueueName} as the serverless-sqs-local plugin is not able to resolve ${Object.keys(
          deadLetterTargetArn
        )[0]} 😞\nSee https://github.com/Nevon/serverless-sqs-local/issues/1`
      );
      attributes = _.omit(attributes, "RedrivePolicy");
    }

    attributes = _.reduce(
      attributes,
      (acc, key, val) => {
        if (val !== undefined) {
          acc[key] = `${JSON.stringify(val)}`;
          return acc;
        }
      },
      {}
    );

    return new Promise((resolve, reject) =>
      this.sqs.createQueue(
        { QueueName, Attributes: attributes },
        (err, data) => (err ? reject(err) : resolve(data.QueueUrl))
      )
    );
  }

  removeQueues(queues = []) {
    return Promise.all(queues.map(queue => this.removeQueue(queue)));
  }

  removeQueue(queue) {
    return this.getQueueUrl(queue.QueueName)
      .then(url => {
        return new Promise((resolve, reject) => {
          this.sqs.deleteQueue(
            {
              QueueUrl: url
            },
            err => {
              if (err) {
                reject(err);
              } else {
                resolve(queue.QueueName);
              }
            }
          );
        });
      })
      .catch(err => {
        if (err.code === "AWS.SimpleQueueService.NonExistentQueue") {
          this.log(`Queue ${queue.QueueName} does not exist. Skipping.`);
        }
      });
  }

  getQueueUrl(queueName) {
    return new Promise((resolve, reject) => {
      this.sqs.getQueueUrl(
        {
          QueueName: queueName,
          QueueOwnerAWSAccountId: "na"
        },
        (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data.QueueUrl);
          }
        }
      );
    });
  }

  getDefaultStack() {
    return _.get(this.service, "resources");
  }

  getAdditionalStacks() {
    return _.values(_.get(this.service, "custom.additionalStacks", {}));
  }

  hasAdditionalStacksPlugin() {
    return _.get(this.service, "plugins", []).includes(
      "serverless-plugin-additional-stacks"
    );
  }

  getQueueDefinitionsFromStack(stack) {
    const resources = _.get(stack, "Resources", []);
    return Object.keys(resources)
      .map(key => {
        if (resources[key].Type === "AWS::SQS::Queue") {
          return resources[key].Properties;
        }
      })
      .filter(n => n);
  }
}

module.exports = SqsLocalPlugin;
