.PHONY: dev build test clean

# Local development - runs both backend and frontend
dev:
	@echo "Starting backend on :8000 and frontend on :5173..."
	@cd frontend && npm install
	@(uvicorn app:app --host 0.0.0.0 --port 8000 --reload &) && \
	 cd frontend && npm run dev

# Build frontend for production
build:
	cd frontend && npm ci && npm run build

# Run tests
test:
	python -m pytest tests/ -v

# Clean generated files
clean:
	rm -rf frontend/dist frontend/node_modules data/dashboard.db tests/test_dashboard.db __pycache__ .pytest_cache
