
# Models
User_type
    name
User
    Name
    Type: FR(User_type)

Role
    Name
Entity
    Name:str (goal,dashboard)


Permission	
    Name:str
    entity: FR

Role_permission:
	role:FR
	permission:FR

User_role:
	user:FR
	role:FR


Priority:
	Name

Goal_period:
	Name : str(Quaterly,daily,monthly)

Entity:
    Name:str (Company,Team,Individual)
Goal
    Name: str
    Description:str
    Labels:json (any string)(list)(category)(Growth,delivery,process)
    priority:FR(Priority)
    Status
    Target_completion: int
    Assigned_to: FR(user)
    goal_period:FR
    entity:FR
    due_date:Datetime
    Weightage: int
    owner:FR(Goal)
    feedback:Fr(FEEDBACK)

goal_Feedback
    Goal: FR(Goal)
    feedback:text

Goal_comment:
    user:FR
    Comment:text

Task
    Goal : FR(Goal)
    Name
    Status


Evaluator_dimention
    Name :Quality, Ownership, Communication, Timeliness,Initiative
Evaluation_rating
    Name:Below / Meets / Above Expectations
    score:int

Evaluator
    evaluator_dimention:FR
    rating:FR(evaluation_rating)


Note:
The goal table is used for the dashboard view.

Dashboard_view:
    Company_level
    Manager_level
    Member_level

Description:

Overview cards: Total goals, % Active, % Completed, % Pending Approval, % Rejected — at Company,
Team, and Individual level
• Completion chart: Donut chart per team or member; filterable by month or quarter
• Goal status board: List view with status pills, due dates, completion %, and last-updated timestamp
• Performance snapshot: Average score across all closed goals per member and per team; current period
vs. previous period
• At-risk indicator: Goals past 70% of their due date with less than 50% completion are flagged
automatically



# Api:
api/v1/goal/ :create goal
api/v1/goal/<id:int>/:update goal
api/v1/goal/<id:int>/move_to/<str:status>/ :move to reviewer
api/v1/goal/<id:int>/add_comment/
api/v1/goal/<id:int>/add_feedback/
api/v1/goal/<id:int>/add_evaluation/ 
api/v1/dashboard/ 



# Tech-stack:
Django
DRF
postgresql
Docker
react



