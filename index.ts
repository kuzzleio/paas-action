import * as core from '@actions/core';
import { Action } from './src/Action';

const action = new Action();
action.run().catch(error => {
  core.setFailed(error);
});





