# README

[![Security](https://github.com/this-oliver/template-js/actions/workflows/security.yaml/badge.svg)](https://github.com/this-oliver/template-js/actions/workflows/security.yaml) [![CI](https://github.com/this-oliver/template-js/actions/workflows/ci.yaml/badge.svg)](https://github.com/this-oliver/template-js/actions/workflows/ci.yaml) [![CD](https://github.com/this-oliver/template-js/actions/workflows/cd.yaml/badge.svg)](https://github.com/this-oliver/template-js/actions/workflows/cd.yaml)

This is a template for javascript or typescript projects that builds on [`this-oliver/template`](https://github.com/this-oliver/template). It includes the following:

- Standardized coding style with [eslint](eslint.config.mjs) (linting)
- Standardized commit message style with [commitlint](.commitlintrc.js) that enforces [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/) (linting)
- Locally enforce linting with [husky](./.husky/).
- Pre-built devops automations for continous [integration](.github/workflows/cicd.yaml) and [deployment](.github/workflows/cicd.yaml) (CICD)
- Pre-built security automations for less vulnerable code and dependencies with [dependabot](./.github/dependabot.yaml), [auto-merge.yaml](.github/workflows/auto-merge.yaml) and [security.yaml](.github/workflows/security.yaml).
- Typescipt support with [tsconfig](tsconfig.json) (_which you can remove if you don't use typescript_)
- Bug and Feature reporting with [Issue Templates](.github/ISSUE_TEMPLATE/).

## Usage

Pre-requisites:

- [nodejs](https://nodejs.org/en/) v23 or later
- [pnpm](https://pnpm.io/) v10 or later

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run
node dist/index.js
```
