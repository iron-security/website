all: clean dev-hugo

dev: dev-wrangler-build dev-miniflare

install:
	brew install hugo npm
	npm install -g wrangler@beta

dev-miniflare:
	miniflare dist/worker.js --watch --debug --host=localhost --https --wrangler-config=wrangler.toml \
		--env dev.env

dev-hugo:
	hugo serve --gc --config=config.yml

dev-wrangler-build:
	wrangler build --env dev

dev-wrangler:
	wrangler dev --env dev --local --local-protocol=http --host localhost

build-hugo:
	hugo --gc --config=config.yml

publish:
	hugo --minify --gc --config=config.yml
	wrangler publish --env prd

clean:
	rm -r dist/ generated/  resources/ workers/worker/ || true

logs:
	wrangler tail --env prd

open:
	open https://localhost:8787
