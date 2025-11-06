"""Initial base tables for SQLModel models

Revision ID: 0001
Revises: 
Create Date: 2025-11-05
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # user table
    op.create_table(
        'user',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('full_name', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_user_email', 'user', ['email'], unique=False)

    # project table
    op.create_table(
        'project',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='draft'),
        sa.Column('pdf_name', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
    )
    op.create_index('ix_project_user_id', 'project', ['user_id'], unique=False)

    # editorstate table
    op.create_table(
        'editorstate',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('state_path', sa.String(), nullable=False),
        sa.Column('resumo_path', sa.String(), nullable=True),
        sa.Column('current_pdf_label', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['project.id']),
    )
    op.create_index('ix_editorstate_project_id', 'editorstate', ['project_id'], unique=False)

    # fileasset table
    op.create_table(
        'fileasset',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('file_type', sa.String(), nullable=False, server_default='other'),
        sa.Column('path', sa.String(), nullable=False),
        sa.Column('size', sa.Integer(), nullable=True),
        sa.Column('mime_type', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['project.id']),
    )
    op.create_index('ix_fileasset_project_id', 'fileasset', ['project_id'], unique=False)
    op.create_index('ix_fileasset_file_type', 'fileasset', ['file_type'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_fileasset_file_type', table_name='fileasset')
    op.drop_index('ix_fileasset_project_id', table_name='fileasset')
    op.drop_table('fileasset')

    op.drop_index('ix_editorstate_project_id', table_name='editorstate')
    op.drop_table('editorstate')

    op.drop_index('ix_project_user_id', table_name='project')
    op.drop_table('project')

    op.drop_index('ix_user_email', table_name='user')
    op.drop_table('user')