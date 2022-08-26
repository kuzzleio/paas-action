"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Action = void 0;
const child_process_1 = require("child_process");
const core_1 = __importDefault(require("@actions/core"));
const node_fetch_1 = __importDefault(require("node-fetch"));
class Action {
    constructor() {
        this.inputs = {
            username: core_1.default.getInput('username', {}),
            password: core_1.default.getInput('password'),
            project: `paas-project-${core_1.default.getInput('project')}`,
            environment: core_1.default.getInput('environment'),
            application: core_1.default.getInput('application'),
            image: core_1.default.getInput('image'),
            login_only: core_1.default.getBooleanInput('login_only', { trimWhitespace: true }),
            paas_api: core_1.default.getInput('paas_api')
        };
    }
    async run() {
        await this.login();
        if (!this.inputs.login_only) {
            if (!this.inputs.image) {
                throw new Error(`You're attempting to deploy but you didn't provide a Docker image name to do so.`);
            }
            if (!this.inputs.project) {
                throw new Error(`Project name required for deployment operations.`);
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
            const response = await (0, node_fetch_1.default)(`${this.inputs.paas_api}/_login/local`, {
                method: 'post',
                body: JSON.stringify({
                    username,
                    password
                }),
                headers: { 'Content-Type': 'application/json' }
            });
            const { result } = await response.json();
            this.jwt = result.jwt;
        }
        catch (error) {
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
            const response = await (0, node_fetch_1.default)(`https://packages.paas.kuzzle.io/-/user/org.couchdb.user:${username}`, options);
            const { token } = await response.json();
            (0, child_process_1.spawnSync)('npm', ['config', 'set', '@kuzzleio:registry', 'https://packages.paas.kuzzle.io'], { stdio: 'inherit' });
            (0, child_process_1.spawnSync)('npm', ['set', '//packages.paas.kuzzle.io/:_authToken', token], { stdio: 'inherit' });
        }
        catch (error) {
            throw new Error(`Cannot login to the Kuzzle PaaS private NPM registry: ${error}`);
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
            await (0, node_fetch_1.default)(`${this.inputs.paas_api}/projects/${this.inputs.project}/environments/${this.inputs.environment}/applications/${this.inputs.image}/_deploy`, options);
            console.log('Deployment succeeded!');
        }
        catch (error) {
            throw new Error(`Deployment failed: ${error}`);
        }
    }
}
exports.Action = Action;
//# sourceMappingURL=Action.js.map