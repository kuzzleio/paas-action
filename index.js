import * as core from '@actions/core';
import fs from 'fs';
import fetch from 'node-fetch';

function sleep(s) {
  return new Promise(resolve => setTimeout(resolve, s * 1000));
}

class Action {
  constructor() {
    const trim = { trimWhitespace: true };
    this.inputs = {
      username: core.getInput('username', { required: true, ...trim }),
      password: core.getInput('password', { required: true, ...trim }),
      project: `paas-project-${core.getInput('project', { required: false, ...trim })}`,
      environment: core.getInput('environment', { required: false, ...trim }),
      application: core.getInput('application', { required: false, ...trim }),
      image: core.getInput('image', { required: false, ...trim }),
      login_only: core.getBooleanInput('login_only', { required: false, ...trim }),
      npmrc_output_dir: core.getInput('npmrc_output_dir', { required: false, ...trim }),
      paas_api: core.getInput('paas_api', { required: false, ...trim }),
      rollback: core.getBooleanInput('rollback', { required: false, ...trim }),
      timeout: parseInt(core.getInput('timeout', { required: false, ...trim }))
    };
  }

  async waitForApplication() {
    let status = undefined;
    let tryCount = 0;
    while (status !== 'Healthy' || tryCount < this.inputs.timeout) {
      const currentAppInfo = await this.getApplicationInfo();
      status = currentAppInfo.status;
      tryCount++;

      await sleep(1);
    }

    if (tryCount === this.inputs.timeout) {
      throw new Error(`Deployment failed for application ${this.inputs.application}: Timeout`);
    }

    return status;
  }

  async run() {
    await this.login();

    if (this.inputs.login_only) {
      return;
    }

    if (!this.inputs.image) {
      throw new Error(`You're attempting to deploy but you didn't provide a Docker image name to do so.`)
    }

    if (!this.inputs.project) {
      throw new Error(`Project name required for deployment operations.`)
    }

    const previousAppInfo = await this.getApplicationInfo();

    await this.deploy();

    const status = await this.waitForApplication();

    if (status !== 'Healthy') {
      if (!this.inputs.rollback) {
        throw new Error(`Application deployment errored with final status ${status}`);
      }

      await this.deploy({ tag: previousAppInfo.spec.source.helm.values.kuzzle.image.tag });
    }
  }

  async login() {
    const { username, password } = this.inputs;

    /**
     * Login to the Kuzzle PaaS API
     */
    try {
      const response = await fetch(`${this.inputs.paas_api}/_login/local`, {
        method: 'post',
        body: JSON.stringify({
          username,
          password
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const { result } = await response.json();

      this.jwt = result.jwt;
    } catch (error) {
      throw new Error(`Cannot login to the Kuzzle PaaS services: ${error}`);
    }

    /**
     * Login to the Kuzzle PaaS private NPM registry
     */
    try {
      const options = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
        },
        body: JSON.stringify({
          name: username,
          password,
        })
      };

      const response = await fetch(`https://packages.paas.kuzzle.io/-/user/org.couchdb.user:${username}`, options);
      const json = await response.json();

      if (json.status !== 201) {
        throw new Error(JSON.stringify(json));
      }

      const { token } = json;
      fs.appendFileSync(`${process.env.GITHUB_WORKSPACE}/${this.inputs.npmrc_output_dir}/.npmrc`, "@kuzzleio:registry=https://packages.paas.kuzzle.io\n");
      fs.appendFileSync(`${process.env.GITHUB_WORKSPACE}/${this.inputs.npmrc_output_dir}/.npmrc`, `//packages.paas.kuzzle.io/:_authToken=${token}\n`);
    } catch (error) {
      throw new Error(`Cannot login to the Kuzzle PaaS private NPM registry: ${JSON.stringify(error)}`)
    }
  }

  async deploy(overrides = {}) {
    let [name, tag] = this.inputs.image.split(':');

    if (overrides.tag) {
      tag = overrides.tag;
    }

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.jwt}`
      },
      body: JSON.stringify({
        image: {
          name,
          tag
        }
      })
    };

    try {
      console.log(`Attempting to deploy '${this.inputs.image}' for '${this.inputs.application}' the application on the '${this.inputs.environment}' for the '${this.inputs.project}'`);
      const response = await fetch(
        `${this.inputs.paas_api}/_/projects/${this.inputs.project}/environments/${this.inputs.environment}/applications/${this.inputs.application}/_deploy`,
        options);
      const json = await response.json();

      if (json.status !== 200) {
        throw new Error(json.error.message);
      }

      console.log('Deployment succeeded!');
    } catch (error) {
      throw new Error(`Deployment failed: ${error}`);
    }
  }

  async getApplicationInfo() {
    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.jwt}`
      },
    };

    try {
      const response = await fetch(
        `${this.inputs.paas_api}/_/projects/${this.inputs.project}/environments/${this.inputs.environment}/applications/${this.inputs.application}`,
        options);
      const json = await response.json();

      if (json.status !== 200) {
        throw new Error(json.error.message);
      }

      return json.result;
    } catch (error) {
      throw new Error(`Failed to fetch '${this.inputs.application}' application information: ${error}`);
    }
  }
}


const action = new Action();

try {
  await action.run();
} catch (error) {
  core.setFailed(error);
}





