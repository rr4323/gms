# Option 1: Docker (recommended)
docker-compose up --build

# Option 2: Local dev
# Terminal 1 — Start PostgreSQL and run backend:
cd backend && python3 manage.py migrate && python3 manage.py seed_data && python3 manage.py runserver

# Terminal 2 — Start frontend:
cd frontend && npm run dev
