import * as core from '@actions/core';
import fs from 'fs';
import { spawnSync } from "child_process";
import fetch from 'node-fetch';

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
      paas_api: core.getInput('paas_api', { required: false, ...trim })
    };
  }

  async run() {
    await this.login();

    if (!this.inputs.login_only) {
      if (!this.inputs.image) {
        throw new Error(`You're attempting to deploy but you didn't provide a Docker image name to do so.`)
      }

      if (!this.inputs.project) {
        throw new Error(`Project name required for deployment operations.`)
      }

      await this.deploy();

      /**
       * @TODO Perform a rollback if deployment fails or if the deployed 
       * application entered in a error state.
       * @TODO Make the deployment to wait for the new application to be
       * up and running without errors
       * @NOTE To do so we need to rework the rollback PaaS API action 
       * to make it able to rollback by default to the previous version
       * and a dedicated API action to get current application health state
       */
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
      const { token } = await response.json();

      fs.appendFileSync(`${process.env.GITHUB_WORKSPACE}/${this.inputs.npmrc_output_dir}/.npmrc`, "@kuzzleio:registry=https://packages.paas.kuzzle.io\n");
      fs.appendFileSync(`${process.env.GITHUB_WORKSPACE}/${this.inputs.npmrc_output_dir}/.npmrc`, `//packages.paas.kuzzle.io/:_authToken=${token}\n`);
    } catch (error) {
      throw new Error(`Cannot login to the Kuzzle PaaS private NPM registry: ${error}`)
    }
  }

  async deploy() {
    const [name, tag] = this.inputs.image.split(':');

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
        `${this.inputs.paas_api}/projects/${this.inputs.project}/environments/${this.inputs.environment}/applications/${this.inputs.image}/_deploy`,
        options);
      console.log(JSON.stringify(response));
      console.log('Deployment succeeded!');
    } catch (error) {
      throw new Error(`Deployment failed: ${error}`);
    }
  }
}


const action = new Action();

try {
  await action.run();
} catch (error) {
  core.setFailed(error);
}





