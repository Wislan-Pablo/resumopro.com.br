from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from db.session import get_engine
from db.models import Project, EditorState, FileAsset


router = APIRouter()


def get_session():
    engine = get_engine()
    with Session(engine) as session:
        yield session


# ---------------------- Projects ----------------------
@router.post("/projects", response_model=Project)
def create_project(
    project: Project,
    session: Session = Depends(get_session),
):
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


@router.get("/projects", response_model=List[Project])
def list_projects(
    session: Session = Depends(get_session),
):
    return session.exec(select(Project).order_by(Project.created_at.desc())).all()


@router.get("/projects/{project_id}", response_model=Project)
def get_project(
    project_id: int,
    session: Session = Depends(get_session),
):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    return project


@router.delete("/projects/{project_id}")
def delete_project(
    project_id: int,
    session: Session = Depends(get_session),
):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    session.delete(project)
    session.commit()
    return {"ok": True}


# ------------------- EditorStates ---------------------
@router.post("/editor-states", response_model=EditorState)
def create_editor_state(
    state: EditorState,
    session: Session = Depends(get_session),
):
    # garantir que project existe
    if not session.get(Project, state.project_id):
        raise HTTPException(status_code=400, detail="Projeto inexistente para 'project_id'")
    session.add(state)
    session.commit()
    session.refresh(state)
    return state


@router.get("/editor-states", response_model=List[EditorState])
def list_editor_states(
    project_id: Optional[int] = Query(None),
    session: Session = Depends(get_session),
):
    stmt = select(EditorState)
    if project_id is not None:
        stmt = stmt.where(EditorState.project_id == project_id)
    return session.exec(stmt.order_by(EditorState.created_at.desc())).all()


@router.get("/editor-states/{state_id}", response_model=EditorState)
def get_editor_state(
    state_id: int,
    session: Session = Depends(get_session),
):
    state = session.get(EditorState, state_id)
    if not state:
        raise HTTPException(status_code=404, detail="Estado do editor não encontrado")
    return state


@router.delete("/editor-states/{state_id}")
def delete_editor_state(
    state_id: int,
    session: Session = Depends(get_session),
):
    state = session.get(EditorState, state_id)
    if not state:
        raise HTTPException(status_code=404, detail="Estado do editor não encontrado")
    session.delete(state)
    session.commit()
    return {"ok": True}


# --------------------- FileAssets ---------------------
@router.post("/file-assets", response_model=FileAsset)
def create_file_asset(
    asset: FileAsset,
    session: Session = Depends(get_session),
):
    if not session.get(Project, asset.project_id):
        raise HTTPException(status_code=400, detail="Projeto inexistente para 'project_id'")
    session.add(asset)
    session.commit()
    session.refresh(asset)
    return asset


@router.get("/file-assets", response_model=List[FileAsset])
def list_file_assets(
    project_id: Optional[int] = Query(None),
    file_type: Optional[str] = Query(None),
    session: Session = Depends(get_session),
):
    stmt = select(FileAsset)
    if project_id is not None:
        stmt = stmt.where(FileAsset.project_id == project_id)
    if file_type is not None:
        stmt = stmt.where(FileAsset.file_type == file_type)
    return session.exec(stmt.order_by(FileAsset.created_at.desc())).all()


@router.delete("/file-assets/{asset_id}")
def delete_file_asset(
    asset_id: int,
    session: Session = Depends(get_session),
):
    asset = session.get(FileAsset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    session.delete(asset)
    session.commit()
    return {"ok": True}