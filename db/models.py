from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True)
    hashed_password: str
    full_name: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Project(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", index=True)
    name: str
    description: Optional[str] = None
    status: str = Field(default="draft")
    pdf_name: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class EditorState(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    state_path: str  # Path to estrutura_edicao.json
    resumo_path: Optional[str] = None  # Path to resumo_notebooklm_normalized.md or editado
    current_pdf_label: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class FileAsset(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    filename: str
    file_type: str = Field(default="other", index=True)  # e.g. pdf, image, html, markdown, final_pdf
    path: str
    size: Optional[int] = None
    mime_type: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)