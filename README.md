# Option 1: Docker (recommended)
docker-compose up --build

# Option 2: Local dev
# Terminal 1 — Start PostgreSQL and run backend:
cd backend && python3 manage.py migrate && python3 manage.py seed_data && python3 manage.py runserver

# Terminal 2 — Start frontend:
cd frontend && npm run dev

## Screenshots & Demos

### 1. Goal Dashboard
![Dashboard](assets/dashboard.png)

### 2. Goal Detail & Sub-tasks
![Goal Detail](assets/goal_detail.png)

### 3. Evaluator Feedback
![Evaluator Feedback](assets/evaluator_feedback.png)

### 4. Evaluate & Score
![Evaluate Flow](assets/evaluation_filled.png)
![Goal Scored](assets/goal_scored.png)

### 5. Reports
![Reports](assets/reports.png)

### Demos
*   **End-to-End Integration Test:** [View Demo Video](assets/gms_integration_verification_final.webp)
*   **Evaluation Modal Fix Verification:** [View Demo Video](assets/evaluation_modal_fix_test.webp)
# Test
# Test
