# Google Analytics Dashboard — Backend

## Setup

1. Install dependencies and create the virtual environment:
   ```bash
   uv sync
   ```

2. Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```

3. Run the server:
   ```bash
   uv run uvicorn app.main:app --reload --port 8000
   ```
