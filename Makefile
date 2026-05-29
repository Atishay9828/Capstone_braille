.PHONY: dev test coverage smoke check-louis clean

# Start FastAPI with hot reload
dev:
	uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Run all tests with verbose output
test:
	pytest tests/ -v

# Run tests with coverage report
coverage:
	pytest tests/ --cov=backend --cov-report=term-missing

# Run end-to-end smoke test
smoke:
	python3 scripts/smoke_test.py

# Verify liblouis is installed and working
check-louis:
	python3 -c "import louis; print('liblouis version:', louis.version()); print(louis.translateString(['en-us-g1.ctb'], 'hello'))"

# Remove Python bytecode cache
clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	find . -type f -name "*.pyo" -delete 2>/dev/null || true
