from typing import Optional
from sqlmodel import Session, select
import sqlalchemy as sa

from .session import get_engine
from .models import Project, FileAsset, EditorState


def get_or_create_project(name: str, pdf_name: Optional[str] = None) -> Project:
    engine = get_engine()
    with Session(engine) as session:
        project = session.exec(select(Project).where(Project.name == name)).first()
        if project:
            if pdf_name and project.pdf_name != pdf_name:
                project.pdf_name = pdf_name
                session.add(project)
                session.commit()
                session.refresh(project)
            return project
        project = Project(name=name, pdf_name=pdf_name)
        session.add(project)
        session.commit()
        session.refresh(project)
        return project


def add_file_asset(
    project_id: int,
    filename: str,
    file_type: str,
    path: str,
    size: Optional[int] = None,
    mime_type: Optional[str] = None,
) -> FileAsset:
    engine = get_engine()
    with Session(engine) as session:
        asset = FileAsset(
            project_id=project_id,
            filename=filename,
            file_type=file_type,
            path=path,
            size=size,
            mime_type=mime_type,
        )
        session.add(asset)
        session.commit()
        session.refresh(asset)
        return asset


def add_editor_state(
    project_id: int,
    state_path: str,
    resumo_path: Optional[str] = None,
    current_pdf_label: Optional[str] = None,
) -> EditorState:
    engine = get_engine()
    with Session(engine) as session:
        state = EditorState(
            project_id=project_id,
            state_path=state_path,
            resumo_path=resumo_path,
            current_pdf_label=current_pdf_label,
        )
        session.add(state)
        session.commit()
        session.refresh(state)
        return state


def get_project_by_name(name: str) -> Optional[Project]:
    engine = get_engine()
    with Session(engine) as session:
        return session.exec(select(Project).where(Project.name == name)).first()


def delete_asset_by_path(path: str) -> int:
    """Delete FileAsset records matching an exact path. Returns deleted count."""
    engine = get_engine()
    with Session(engine) as session:
        assets = session.exec(select(FileAsset).where(FileAsset.path == path)).all()
        deleted = 0
        for a in assets:
            session.delete(a)
            deleted += 1
        if deleted:
            session.commit()
        return deleted


def delete_assets_by_prefix(prefix: str) -> int:
    """Delete FileAsset records with path starting with prefix. Returns deleted count."""
    engine = get_engine()
    with Session(engine) as session:
        assets = session.exec(select(FileAsset).where(FileAsset.path.like(prefix + "%"))).all()
        deleted = 0
        for a in assets:
            session.delete(a)
            deleted += 1
        if deleted:
            session.commit()
        return deleted


def delete_editor_states_by_project_id(project_id: int) -> int:
    engine = get_engine()
    with Session(engine) as session:
        states = session.exec(select(EditorState).where(EditorState.project_id == project_id)).all()
        deleted = 0
        for s in states:
            session.delete(s)
            deleted += 1
        if deleted:
            session.commit()
        return deleted