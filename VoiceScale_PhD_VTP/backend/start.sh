#!/bin/bash
# VoiceCare PHC - Backend Startup Script
cd "$(dirname "$0")"

echo "Installing dependencies..."
pip install -r requirements.txt

echo "Starting VoiceCare PHC backend on http://localhost:8000"
echo "API docs: http://localhost:8000/api/v1/docs"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
