from sqlmodel import SQLModel, create_engine, Session
import os

sqlite_file_name = "classroom.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)

from sqlalchemy import text

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    
    with Session(engine) as session:
        try:
            session.exec(text("ALTER TABLE task ADD COLUMN description VARCHAR"))
            session.exec(text("ALTER TABLE task ADD COLUMN grading_criteria VARCHAR"))
            session.exec(text("ALTER TABLE participant ADD COLUMN submission_data VARCHAR"))
            session.exec(text("ALTER TABLE participant ADD COLUMN score INTEGER"))
            session.exec(text("ALTER TABLE participant ADD COLUMN ai_feedback VARCHAR"))
            session.commit()
            print("Successfully added new columns to tables.")
        except Exception:
            
            session.rollback()

def get_session():
    with Session(engine) as session:
        yield session