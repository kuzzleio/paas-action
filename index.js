import * as core from "@actions/core";
import fs from "fs";
import fetch from "node-fetch";

function sleep(s) {
  return new Promise((resolve) => setTimeout(resolve, s * 1000));
}

class Action {
  constructor() {
    this.inputs = {
      username: core.getInput("username", {
        required: true,
        trimWhitespace: true,
      }),

      password: core.getInput("password", {
        required: true,
        trimWhitespace: true,
      }),

      project: `paas-project-${core.getInput("project", {
        required: false,
        trimWhitespace: true,
      })}`,

      environment: core.getInput("environment", {
        required: false,
        trimWhitespace: true,
      }),

      application: core.getInput("application", {
        required: false,
        trimWhitespace: true,
      }),
      image: core.getInput("image", { required: false, trimWhitespace: true }),

      login_only: core.getBooleanInput("login_only", {
        required: false,
        trimWhitespace: true,
      }),

      npmrc_output_dir: core.getInput("npmrc_output_dir", {
        required: false,
        trimWhitespace: true,
      }),

      paas_api: core.getInput("paas_api", {
        required: false,
        trimWhitespace: true,
      }),

      paas_packages: core.getInput("paas_packages", {
        required: false,
        trimWhitespace: true,
      }),

      rollback: core.getBooleanInput("rollback", {
        required: false,
        trimWhitespace: true,
      }),

      timeout: parseInt(
        core.getInput("timeout", { required: false, trimWhitespace: true })
      ),
    };
  }

  async waitForApplication() {
    let status = "Processing";
    let tryCount = 0;

    while (status !== "Healthy" && tryCount < this.inputs.timeout) {
      const currentAppInfo = await this.getApplicationInfo();
      status = currentAppInfo.status;
      tryCount++;

      await sleep(1);
    }

    if (tryCount === this.inputs.timeout) {
      throw new Error(
        `Deployment failed for application ${this.inputs.application}: Timeout. Current application status: ${status}`
      );
    }

    return status;
  }

  async loginToPaas(username, password) {
    /**
     * Login to the Kuzzle PaaS API
     */
    try {
      const response = await fetch(`${this.inputs.paas_api}/_login/local`, {
        method: "post",
        body: JSON.stringify({
          username,
          password,
        }),
        headers: { "Content-Type": "application/json" },
      });
      const json = await response.json();

      if (response.status !== 200) {
        throw new Error(json.error.message);
      }

      const { result } = json;
      this.jwt = result.jwt;
    } catch (error) {
      console.error(error);
      throw new Error("Cannot login to the Kuzzle PaaS services");
    }
  }

  async loginToNpmPrivateRegistry() {
    /**
     * Login to the Kuzzle PaaS private NPM registry
     */
    try {
      const options = {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(
            `${username}:${password}`
          ).toString("base64")}`,
        },
        body: JSON.stringify({
          name: username,
          password,
        }),
      };

      const response = await fetch(
        `https://${this.inputs.paas_packages}/-/user/org.couchdb.user:${username}`,
        options
      );

      const json = await response.json();

      if (response.status !== 201) {
        throw new Error(json.error.message);
      }

      const { token } = json;
      fs.appendFileSync(
        `${process.env.GITHUB_WORKSPACE}/${this.inputs.npmrc_output_dir}/.npmrc`,
        `@kuzzleio:registry=https://${this.inputs.paas_packages}\n`
      );
      fs.appendFileSync(
        `${process.env.GITHUB_WORKSPACE}/${this.inputs.npmrc_output_dir}/.npmrc`,
        `//${this.inputs.paas_packages}/:_authToken=${token}\n`
      );
    } catch (error) {
      console.error(error);
      throw new Error("Cannot login to the Kuzzle PaaS private NPM registry");
    }
  }

  async login() {
    const { username, password } = this.inputs;

    await this.loginToPaas(username, password);
    await this.loginToNpmPrivateRegistry(username, password);
  }

  async deploy(overrides = {}) {
    let [name, tag] = this.inputs.image.split(":");

    if (overrides.tag) {
      tag = overrides.tag;
    }

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.jwt}`,
      },
      body: JSON.stringify({
        image: {
          name,
          tag,
        },
      }),
    };

    try {
      console.log(
        `Attempting to deploy '${name}:${tag}' for '${this.inputs.application}' the application on the '${this.inputs.environment}' for the '${this.inputs.project}'`
      );
      const response = await fetch(
        `${this.inputs.paas_api}/_/projects/${this.inputs.project}/environments/${this.inputs.environment}/applications/${this.inputs.application}/_deploy`,
        options
      );
      const json = await response.json();

      if (json.status !== 200) {
        throw new Error(json.error.message);
      }
    } catch (error) {
      throw new Error(`Deployment failed: ${error}`);
    } finally {
      await sleep(10);
    }
  }

  async getApplicationInfo() {
    const options = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.jwt}`,
      },
    };

    try {
      const response = await fetch(
        `${this.inputs.paas_api}/_/projects/${this.inputs.project}/environments/${this.inputs.environment}/applications/${this.inputs.application}`,
        options
      );
      const json = await response.json();

      if (json.status !== 200) {
        throw new Error(json.error.message);
      }

      return json.result;
    } catch (error) {
      throw new Error(
        `Failed to fetch '${this.inputs.application}' application information: ${error}`
      );
    }
  }

  async rollback() {
    const previousAppInfo = await this.getApplicationInfo();

    console.log(
      `Rolling back to image ${previousAppInfo.spec.source.helm.values.kuzzle.image.name}:${previousAppInfo.spec.source.helm.values.kuzzle.image.tag}`
    );

    await this.deploy({
      tag: previousAppInfo.spec.source.helm.values.kuzzle.image.tag,
    });

    await this.waitForApplication();
    console.log("Rollback successful! 🥵");
  }

  async run() {
    if (!this.inputs.image) {
      throw new Error(
        `You're attempting to deploy but you didn't provide a Docker image name to do so.`
      );
    }

    if (!this.inputs.project) {
      throw new Error(`Project name required for deployment operations.`);
    }

    await this.login();

    if (this.inputs.login_only) {
      return;
    }

    await this.deploy();

    let status;

    try {
      status = await this.waitForApplication();
      console.log("Deployment succeeded!");
    } catch (error) {
      console.log("Deployment failed!");

      if (!this.inputs.rollback) {
        throw new Error(
          `Application deployment errored with final status ${status}`
        );
      }

      this.rollback();

      process.exit(1);
    }
  }
}

try {
  await new Action().run();
} catch (error) {
  core.setFailed(error);
}
