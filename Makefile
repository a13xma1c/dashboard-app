# Convenience targets for the whole repo. Each sub-project also works standalone.

.PHONY: install dev backend frontend test test-backend test-frontend test-e2e lint clean up down logs redis

install:            ## Install backend (uv) and frontend (npm) dependencies
	cd backend && uv sync
	cd frontend && npm install

backend:            ## Run the API with mock data on :8000
	cd backend && GA_MOCK_MODE=true uv run uvicorn app.main:app --reload --port 8000

frontend:           ## Run the Vite dev server on :5173
	cd frontend && npm run dev

dev:                ## Run backend (mock mode) and frontend together
	$(MAKE) -j2 backend frontend

up:                 ## Build and run the full stack in containers (redis + backend + frontend)
	docker compose up --build -d
	@echo "→ http://localhost:$${FRONTEND_PORT:-5173}"

down:               ## Stop and remove the containers
	docker compose down

logs:               ## Tail container logs
	docker compose logs -f

redis:              ## Run only the Redis cache container (for a locally-run backend: REDIS_URL=redis://localhost:6379/0)
	docker compose up -d redis

lint:               ## Static checks: ruff + mypy, oxlint + tsc
	cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy
	cd frontend && npm run lint && npx tsc -b

test-backend:       ## pytest with coverage
	cd backend && uv run pytest --cov=app --cov-report=term-missing

test-frontend:      ## vitest
	cd frontend && npm test

test-e2e:           ## Playwright (starts both servers itself)
	cd frontend && npm run test:e2e

test: lint test-backend test-frontend test-e2e   ## Everything

clean:
	rm -rf backend/.pytest_cache backend/.mypy_cache backend/.ruff_cache backend/.coverage
	rm -rf frontend/dist frontend/coverage frontend/test-results frontend/playwright-report frontend/node_modules/.tmp
	find . -name __pycache__ -type d -not -path "*/.venv/*" -exec rm -rf {} +

help:
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-16s %s\n", $$1, $$2}'
