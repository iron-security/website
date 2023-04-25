PORT=8788

all: clean dev

dev: dev-wrangler

install:
	brew install hugo npm
	npm install
	npm install -g wrangler

dev-hugo:
	npm run server

dev-wrangler-build:
	npx rangler build --env dev --log-level=debug --local

dev-wrangler:
	npx wrangler dev --env dev --log-level=debug --experimental-local --ip 127.0.0.1 --port $(PORT)

build-hugo:
	npm run build

publish:
	npm run build
	npx wrangler publish --env prd

clean:
	rm -r dist/ generated/  resources/ workers/worker/ || true

logs:
	npx wrangler tail --env prd

open:
	open https://localhost:$(PORT)
