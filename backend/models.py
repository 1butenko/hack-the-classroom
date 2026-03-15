from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship

class TaskBase(SQLModel):
    prompt: str
    refined_prompt: Optional[str] = None
    user_feedback: Optional[str] = None
    meshy_task_id: Optional[str] = None
    status: str = "PENDING" 
    model_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Task(TaskBase, table=True):
    id: str = Field(primary_key=True) 
    participants: List["Participant"] = Relationship(back_populates="task")

class ParticipantBase(SQLModel):
    name: str
    status: str = "joined" 
    has_viewed: bool = False
    reaction: Optional[str] = None
    last_heartbeat: datetime = Field(default_factory=datetime.utcnow)

class Participant(ParticipantBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    task_id: str = Field(foreign_key="task.id")
    task: Task = Relationship(back_populates="participants")

class TaskCreate(SQLModel):
    prompt: str

class ParticipantCreate(SQLModel):
    name: str
    task_id: str

class ParticipantUpdate(SQLModel):
    status: Optional[str] = None
    has_viewed: Optional[bool] = None
    reaction: Optional[str] = None
