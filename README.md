# Kuzzle PaaS Action

This action provide the following functionality for Github Actions users:

- Login to Kuzzle PaaS and get access to our licensed products.
- Deploy a new version of your application.
- Rollback to the previous live version of the targeted application if the deployment fails.

# Usage

| Input            | default | Required |
| ---------------- | ------- | -------- |
| username         |         | true     |
| password         |         | true     |
| npmrc_output_dir | `.`     |          |
| project          |         | true     |
| environment      | main    |          |
| application      | api     |          |
| image            |         | true     |
| login_only       | false   |          |
| timeout          | `60`    |          |
| rollback         | false   |          |

> `project` is **Required** by default but not required if `login_only` is set to `true`.

### Login and get access to our licensed products

```yaml
uses: kuzzleio/paas-action@v1.x.x
with:
  username: ${{ secrets.KUZZLE_PAAS_USERNAME }}
  password: ${{ secrets.KUZZLE_PAAS_PASSWORD }}
  login_only: true
  # You can also choose where to save the produced .npmrc
  npmrc_output_dir: ./backend
```

### Deploy a new version of your application

```yaml
uses: kuzzleio/paas-action@v1.x.x
with:
  username: ${{ secrets.KUZZLE_PAAS_USERNAME }}
  password: ${{ secrets.KUZZLE_PAAS_PASSWORD }}
  project: my-project
  environment: main
  application: api
  image: harbor.paas.kuzzle.io/my-project/main/api:my-tag
  timeout: 45
```

### Deploy a new version of your application and rollback if it fails

> NOTE: It will rollback to the previous live version of the targeted application.

```yaml
uses: kuzzleio/paas-action@v1.x.x
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

# License

The scripts and documentation in this project are released under the [MIT License](LICENSE)
