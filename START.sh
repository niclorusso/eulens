#!/bin/bash

# Agora EU Startup Script

echo "🇪🇺 Starting Agora EU..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if database is running
if ! docker ps | grep -q agora-eu-postgres; then
    echo "📦 Starting PostgreSQL database..."
    docker-compose up -d
    sleep 5
fi

echo "✅ Database is ready"
echo ""

# Start backend
echo "⚙️ Starting backend server (port 5001)..."
node server/index.js &
BACKEND_PID=$!
sleep 2

# Start frontend
echo "🎨 Starting frontend server (port 3000)..."
cd client && npm run dev &
FRONTEND_PID=$!

echo ""
echo "🚀 Agora EU is running!"
echo ""
echo "Frontend:  http://localhost:3000"
echo "Backend:   http://localhost:5001"
echo "API Docs:  http://localhost:5001/api/health"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Wait for processes
wait $BACKEND_PID $FRONTEND_PID
