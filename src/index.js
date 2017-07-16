"use strict";
const AWS = require("aws-sdk");
const SqsLocalPlugin = require("./plugin");

class ServerlessPluginInterface {
  constructor(serverless, options) {
    this.delegate = new SqsLocalPlugin(serverless, options, AWS);
    this.commands = this.delegate.getCommands();
    this.hooks = this.delegate.getHooks();
    this.provider = "aws";
  }
}

module.exports = ServerlessPluginInterface;
