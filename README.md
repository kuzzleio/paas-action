# Kuzzle PaaS Action

## Inputs

## `username`

**Required** Your Kuzzle PaaS username.

## `password`

**Required** Your Kuzzle PaaS password.

## `npmrc_output_dir`

Where to save the produced .npmrc file when login (default: Project root directory).

## `project`

**Required** Your Kuzzle PaaS project name (not required if `login_only` is set to `true`).

## `environment`

Your Kuzzle PaaS project environment to target (default: `main`).

## `application`

The Kuzzle PaaS application name to update (default: `api`).

## `image`

**Required** The Docker image to use to perform the deploy (not required if `login_only` is set to `true`).

## `login_only`

If true, only the login action will be performed (default: `false`).

## `timeout`

The amount of time in second before a deployment can be considere as a failure (default: `60`).

## `rollback`

Allows you to perform a rollback to the previous live version of the targeted application (default: `false`).



## Example usage

### Login and get access to our licensed products (for functional test purposes for example):

```yaml
uses: kuzzleio/paas-action@vv0.6.0
with:
  username: ${{ secrets.KUZZLE_PAAS_USERNAME }}
  password: ${{ secrets.KUZZLE_PAAS_PASSWORD }}
  login_only: true
  # You can also choose where to save the produced .npmrc
  npmrc_output_dir: ./backend
```

### Deploy a new version of your application on your Kuzzle PaaS environment:

```yaml
uses: kuzzleio/paas-action@v0.6.0
with:
  username: ${{ secrets.KUZZLE_PAAS_USERNAME }}
  password: ${{ secrets.KUZZLE_PAAS_PASSWORD }}
  project: my-project
  environment: main
  application: api
  image: harbor.paas.kuzzle.io/my-project/main/api:my-tag
  timeout: 45 
```

### Deploy a new version of your application on your Kuzzle PaaS environment and rollback if it fail:

> NOTE: It will rollback to the previous live version of the targeted application.

```yaml
uses: kuzzleio/paas-action@v0.6.0
with:
  username: ${{ secrets.KUZZLE_PAAS_USERNAME }}
  password: ${{ secrets.KUZZLE_PAAS_PASSWORD }}
  project: my-project
  environment: main
  application: api
  image: harbor.paas.kuzzle.io/my-project/main/api:my-tag
  rollback: true
  timeout: 90
```
