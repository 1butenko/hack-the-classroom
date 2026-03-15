from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship

class TaskBase(SQLModel):
    prompt: str
    description: Optional[str] = None 
    grading_criteria: Optional[str] = None 
    user_feedback: Optional[str] = None
    meshy_task_id: Optional[str] = None
    status: str = "PENDING" 
    is_refining: bool = False
    base_model_config: Optional[str] = None 
    room_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Task(TaskBase, table=True):
    id: str = Field(primary_key=True) 
    participants: List["Participant"] = Relationship(back_populates="task")

class ParticipantBase(SQLModel):
    name: str
    status: str = "joined" 
    submission_data: Optional[str] = None 
    score: Optional[int] = None 
    ai_feedback: Optional[str] = None 
    last_heartbeat: datetime = Field(default_factory=datetime.utcnow)
    has_viewed: bool = Field(default=False)
    reaction: Optional[str] = None

class Participant(ParticipantBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    task_id: str = Field(foreign_key="task.id")
    task: Task = Relationship(back_populates="participants")

class TaskCreate(SQLModel):
    prompt: str
    room_id: Optional[str] = None
    role: str = "teacher" # Default to teacher for backward compatibility

class ParticipantCreate(SQLModel):
    name: str
    task_id: str

class ParticipantSubmit(SQLModel):
    prompts_used: List[str]
    spatial_data: Optional[List[dict]] = None 
