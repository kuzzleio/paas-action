# Kuzzle PaaS Action

This action allows you to:
- `login` to the Kuzzle PaaS service and private NPM registry
- `deploy` a new version of your Kuzzle PaaS hosted application

## Inputs

## `username`

**Required** Your Kuzzle PaaS username.

## `password`

**Required** Your Kuzzle PaaS password.

## `project`

**Required** Your Kuzzle PaaS project name (not required if `login_only` is set to `true`)

## `environment`

Your Kuzzle PaaS project environment to target (default: `main`).

## `application`

The Kuzzle PaaS application name to update (default: `api`)

## `image`

**Required** The Docker image to use to perform the deploy (not required if `login_only` is set to `true`)


## Example usage

### Login and get access to our licensed products (for functional test purposes for example):

```yaml
uses: kuzzleio/paas-action@v0.4.0
with:
  username: ${{ secrets.KUZZLE_PAAS_USERNAME }}
  password: ${{ secrets.KUZZLE_PAAS_PASSWORD }}
  login_only: "true"
```

### Deploy a new version of your application on your Kuzzle PaaS environment:

```yaml
uses: kuzzleio/paas-action@0.4.0
with:
  username: ${{ secrets.KUZZLE_PAAS_USERNAME }}
  password: ${{ secrets.KUZZLE_PAAS_PASSWORD }}
  project: my-project
  environment: main
  application: api
  image: harbor.paas.kuzzle.io/my-project/main/api:my-tag
```