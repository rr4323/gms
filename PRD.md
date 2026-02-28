# Goal Management System

> **Product Requirements Document • MVP Hackathon • v2.0**

| Initiative | Type | Timeline | Focus |
|---|---|---|---|
| Goal Management System | Company-Level Hackathon | 2-Day MVP Sprint | Goal Setting, Monitoring & Reporting |

---

## 1. Problem & Solution

Performance management today is fragmented — goals are set informally, evaluations are subjective, and no single source of truth exists for tracking progress or generating meaningful reports.

| What's Broken Today | What GMS Fixes |
|---|---|
| Goals set informally with no structure or hierarchy | Structured goals at Company → Team → Individual level |
| Only managers set goals; members have no ownership | Both evaluators and members can propose and submit goals |
| No approval workflow; goals go unreviewed | Evaluator reviews, approves, and scores each goal |
| Feedback is optional and usually skipped | Feedback is mandatory before a goal score is finalized |
| No visibility into team or organization-wide progress | Real-time dashboard across all goal levels |
| Reports are manual, ad-hoc, and inconsistent | Automated performance reports for any period or team |

---

## 2. How GMS Works

GMS is built around one core loop: **Goals are set → reviewed and approved → tracked to completion → evaluated with mandatory feedback → reported.**

### Goal Lifecycle

1. Member or Evaluator **drafts** a goal with title, description, category tag, due date, and weightage
2. Goal is **submitted** for review — status moves to *Pending Approval*
3. Evaluator reviews and either **Approves** or **Rejects** (with a comment)
4. Member tracks progress and **updates completion %** as work happens
5. On completion, Evaluator **scores** the goal (Below / Meets / Above Expectations)
6. **Feedback is mandatory** before the score is finalized — both parties submit their perspective
7. Final score is **locked** and feeds into the performance dashboard and reports

### Goal Hierarchy

Every goal belongs to one of three levels. Higher-level goals cascade down into lower-level ones, ensuring alignment across the organization.

| Level | Owner | Purpose |
|---|---|---|
| **Company** | Leadership / CXOs | Org-wide strategic objectives for the quarter/year |
| **Team** | Team Leads / Managers | Team deliverables aligned to company goals |
| **Individual** | Team Members | Personal goals aligned to team objectives |

---

## 3. Feature Scope — MVP

### Goal Management

- **Create Goal:** Title, description, level (Company/Team/Individual), due date, weightage (%), and category tag (e.g. Growth, Delivery, Process)
- **Submit for Approval:** Moves goal into the evaluator's review queue
- **Approval Flow:** Evaluator approves or rejects with a mandatory comment on rejection
- **Progress Tracking:** Member updates completion % at any point; goal card shows a progress bar
- **Sub-tasks:** Optional sub-items under a goal to break work into steps
- **Editing Rules:** Goals can only be edited while in Draft or Rejected state; Active goals are locked

### Feedback (Mandatory on Scoring)

- **Triggered:** Auto-triggered when evaluator marks a goal as complete and attempts to score it
- **Member side:** Member submits a self-reflection — *What did you deliver? What would you do differently?*
- **Evaluator side:** Evaluator rates on 5 dimensions — Quality, Ownership, Communication, Timeliness, Initiative — with a free-text comment
- **Scoring locked:** Final rating (Below / Meets / Above Expectations) and numeric score are only saved after both parties complete feedback
- **Visibility:** Both sides can see the finalized feedback and score; no surprises

### Dashboard

- **Overview cards:** Total goals, % Active, % Completed, % Pending Approval, % Rejected — at Company, Team, and Individual level
- **Completion chart:** Donut chart per team or member; filterable by month or quarter
- **Goal status board:** List view with status pills, due dates, completion %, and last-updated timestamp
- **Performance snapshot:** Average score across all closed goals per member and per team; current period vs. previous period
- **At-risk indicator:** Goals past 70% of their due date with less than 50% completion are flagged automatically

### Reports (P0 — Must Ship)

- **Individual Report:** All goals for a member in a period — status, completion %, evaluator score, feedback summary
- **Team Report:** Aggregated view across all members; avg score, goals completed vs. total, top/bottom performers
- **Company Report:** Org-wide summary by team; goal completion rate, score distribution, period-over-period trend
- **Export:** All reports exportable as PDF or CSV

---

## 4. Role-Based Access

Three roles. Access is designed so everyone can participate in the goal process — members own their goals, evaluators govern quality and scoring, leadership monitors outcomes.

| Feature / Action | Team Member | Evaluator / Manager | Leadership / Admin |
|---|---|---|---|
| Create a goal (draft) | Own goals | Any member | Any level |
| Submit goal for approval | Yes | Yes | Yes |
| Approve / Reject goal | No | Yes | Yes |
| Update completion % | Own goals | Their team | All |
| Submit self-reflection (feedback) | Mandatory | View only | View only |
| Submit evaluator feedback + score | No | Mandatory | Yes |
| View finalized score and feedback | Own only | Their team | All |
| Dashboard — Individual view | Own only | Yes | Yes |
| Dashboard — Team view | No | Their team | All teams |
| Dashboard — Company view | No | No | Yes |
| At-risk goal alerts | Own goals | Their team | All |
| Individual performance report | Own only | Their team | All |
| Team / Company report + export | No | Their team | All |
| Add / Edit teams and members | No | No | Yes |

---

## 5. Prioritization & What's Out of Scope

### P0 — Must Ship

- Goal CRUD: Create, submit, approve/reject, track completion, edit in draft/rejected state
- Approval workflow: Evaluator queue with approval, rejection + mandatory comment
- Mandatory feedback: Blocked scoring until both member and evaluator submit feedback
- Dashboard: Status cards, completion chart, at-risk flagging — Individual and Team views
- Reports: Individual, Team, and Company reports; PDF/CSV export
- Role-based access: Three-tier permission model enforced throughout

### P1 — If Time Permits

- Month-over-month performance comparison on dashboard
- Period-over-period trend chart per team
- Search and filter goals by status, tag, or date range

### Explicitly Out of Scope

- Bandwidth / capacity tracking — not relevant to goal quality or outcomes
- Task management or sub-project tooling — keep goals high-level
- AI features, Chatbots, or automated scheduling
- Meeting / Connects module or calendar integrations
- Notifications or email alerts (post-MVP)
- CRM or external system integrations

---

## 6. Demo Flow (< 5 min)

1. Admin creates a team and assigns members and evaluators
2. Member drafts and submits a goal — evaluator receives it in their queue
3. Evaluator approves the goal; it moves to Active
4. Member updates completion % over time; at-risk flag triggers on dashboard
5. Member marks goal complete and submits self-reflection feedback
6. Evaluator reviews member feedback, rates on 5 dimensions, and sets final score
7. Score is locked; dashboard updates; report is generated and exported
