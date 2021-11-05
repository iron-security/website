# website

This is the repository that builds the static website for [iron.security](https://iron.security/) using [hugo](https://gohugo.io/) for generating the HTML/CSS/JS and then `wrangler` to deploy everything to [Cloudflare Workers](https://workers.cloudflare.com) all over the globe.

Workers was chosen instead of [Cloudflare Pages](https://pages.cloudflare.com/) so we can set HTTP security headers on HTTP responses and even handle contact form submissions to [Mailgun](https://mailgun.com/).
Workers uses Cloudflare KV under the hood to store all static assets and retrieve them according to a caching policy.

For local development `miniflare` is used to not have to store the worker in Cloudflare KV every time we run it during development, triggering additional quotas.

## Building

With `hugo`, `wrangler-cli` and `miniflare` installed, you can just run `make` for local development.
You'll need to create a `dev.env` file with the environment secrets mentioned in `wrangler.toml`.

For publishing to production, you will need to create those secrets in Cloudflare Workers via `wrangler --env prd secret put <name>`.

## Directory structure

- `.github/`: the GitHub Actions workflows and dependabot configuration file for automated dependency upgrades.
- `content/`: hugo content files.
- `i18n/`: translations.
- `layouts/`: HTML layout files.
- `static/`: static files such as CSS, JS and images.
- `workers/`: the Cloudflare Worker edge/serverless function that sets HTTP security headers.
