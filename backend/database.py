from sqlmodel import SQLModel, create_engine, Session, text
import os

sqlite_file_name = "classroom.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    
    with Session(engine) as session:
        # Define columns we want to ensure exist
        columns = [
            ("task", "description", "VARCHAR"),
            ("task", "grading_criteria", "VARCHAR"),
            ("task", "refined_prompt", "VARCHAR"),
            ("task", "user_feedback", "VARCHAR"),
            ("task", "meshy_task_id", "VARCHAR"),
            ("task", "status", "VARCHAR"),
            ("task", "is_refining", "BOOLEAN"),
            ("task", "base_model_config", "VARCHAR"),
            ("task", "room_id", "VARCHAR"),
            ("participant", "submission_data", "VARCHAR"),
            ("participant", "score", "INTEGER"),
            ("participant", "ai_feedback", "VARCHAR"),
        ]
        
        for table, column, col_type in columns:
            try:
                session.exec(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
                session.commit()
                print(f"Added column {column} to table {table}")
            except Exception:
                session.rollback() # Column already exists or table doesn't

def get_session():
    with Session(engine) as session:
        yield session
