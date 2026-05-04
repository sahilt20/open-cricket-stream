# open-cricket-stream — convenience targets for local development.
# Usage: `make help` for the full list.

SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help
.PHONY: help build up demo stream all logs ps down clean nuke test typecheck dev-engine dev-pwa supabase-start supabase-stop

help:  ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage: make <target>\n\nTargets:\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

build:  ## Build engine and PWA images
	docker compose build

up:  ## Start core services (engine, mediamtx, pwa)
	docker compose up -d
	@echo "→ engine:  http://localhost:8080/healthz"
	@echo "→ pwa:     http://localhost:5173"
	@echo "→ mediamtx HLS preview: http://localhost:8888"

demo:  ## Start core + simulated phone (test pattern → SRT)
	docker compose --profile demo up -d
	@echo "→ test source pushing to srt://localhost:8890?streamid=publish:cam"

stream:  ## Start core + simulated phone + ffmpeg compositor (writes local MP4)
	docker compose --profile demo --profile stream up -d
	@echo "→ recording into the ocs-recordings volume (see /out/local.mp4 inside the container)"

all:  ## Start everything including the optional Samba share
	docker compose --profile demo --profile stream --profile share up -d

logs:  ## Tail logs from all running services
	docker compose logs -f --tail=100

ps:  ## Show running containers
	docker compose ps

down:  ## Stop and remove containers (data volumes preserved)
	docker compose --profile demo --profile stream --profile share down

clean:  ## Like `down` but also removes data volumes (DROPS the SQLite event log!)
	docker compose --profile demo --profile stream --profile share down -v

nuke:  ## clean + remove built images
	docker compose --profile demo --profile stream --profile share down -v --rmi local

test:  ## Run the score-engine reducer tests on the host
	npm test --workspaces --if-present

typecheck:  ## Typecheck all workspaces on the host
	npm run typecheck --workspaces --if-present

dev-engine:  ## Run the engine on the host with tsx watch (no docker)
	npm run dev:engine

dev-pwa:  ## Run the PWA dev server on the host with HMR (no docker)
	npm run dev:pwa

supabase-start:  ## Start a local Supabase stack via the CLI
	npm run db:start --workspace=@ocs/db

supabase-stop:  ## Stop the local Supabase stack
	cd packages/db && npx supabase stop
