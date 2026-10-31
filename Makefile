.PHONY: help install run test lint demo clean

help:
	@echo "Available commands:"
	@echo "  make install  - Install pinned dependencies"
	@echo "  make run      - Run the Taskocalypse local web server"
	@echo "  make test     - Run pytest with coverage report"
	@echo "  make lint     - Run ruff linter and formatting checks"
	@echo "  make demo     - Generate a messy demo folder for instant testing"
	@echo "  make clean    - Remove cached files and test artifacts"

install:
	python -m pip install -r requirements.txt

run:
	python -m app

test:
	-node --test tests/js/*.test.js
	python -m pytest

lint:
	python -m ruff check app tests demo_setup.py
	python -m ruff format --check app tests demo_setup.py

demo:
	python demo_setup.py

clean:
	python -c "import shutil, pathlib; [shutil.rmtree(p, ignore_errors=True) for p in pathlib.Path('.').rglob('__pycache__')]; [p.unlink(missing_ok=True) for p in pathlib.Path('.').glob('*.journal.json')]"
