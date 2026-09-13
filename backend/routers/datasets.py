import io
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status

from backend.auth import get_current_user
from backend.firestore_client import get_firestore_client
from backend.schemas.dataset import DatasetSummary, SchemaResponse
from backend.schemas.user import CurrentUser
from backend.tenancy import get_db_manager_for_user, sync_user_db_to_storage

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


def _clean_table_name(table_name: str) -> str:
    """Mirrors the sanitization core.database.DatabaseManager.load_file_to_sqlite applies internally,
    so we can report back the same table name it actually created — no core/ changes required."""
    clean = re.sub(r"[^a-zA-Z0-9_]", "_", table_name.strip())
    clean = re.sub(r"_+", "_", clean).strip("_")
    return clean or "custom_data"


@router.post("", response_model=DatasetSummary)
async def upload_dataset(
    file: UploadFile,
    table_name: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user),
):
    db_manager = get_db_manager_for_user(current_user.uid)

    contents = await file.read()
    buffer = io.BytesIO(contents)
    buffer.name = file.filename or "upload.csv"

    requested_name = table_name or (file.filename or "custom_data").rsplit(".", 1)[0]
    success, msg = db_manager.load_file_to_sqlite(buffer, table_name=requested_name)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    clean_table = _clean_table_name(requested_name)

    _, count_df, _ = db_manager.execute_query(f"SELECT COUNT(*) AS cnt FROM '{clean_table}'")
    row_count = int(count_df.iloc[0]["cnt"]) if count_df is not None else 0

    _, cols_df, _ = db_manager.execute_query(f"SELECT * FROM '{clean_table}' LIMIT 1")
    columns = list(cols_df.columns) if cols_df is not None else []

    now = datetime.now(timezone.utc).isoformat()
    db = get_firestore_client()
    doc_ref = (
        db.collection("users").document(current_user.uid)
        .collection("datasets").document()
    )
    doc_ref.set({
        "tableName": clean_table,
        "originalFilename": file.filename,
        "rowCount": row_count,
        "columns": columns,
        "uploadedAt": now,
    })
    sync_user_db_to_storage(current_user.uid)

    return DatasetSummary(
        id=doc_ref.id,
        tableName=clean_table,
        originalFilename=file.filename or "",
        rowCount=row_count,
        columns=columns,
        uploadedAt=now,
    )


@router.get("", response_model=list[DatasetSummary])
def list_datasets(current_user: CurrentUser = Depends(get_current_user)):
    db = get_firestore_client()
    docs = (
        db.collection("users").document(current_user.uid)
        .collection("datasets").order_by("uploadedAt", direction="DESCENDING").stream()
    )
    return [DatasetSummary(id=d.id, **d.to_dict()) for d in docs]


@router.get("/schema", response_model=SchemaResponse)
def get_schema(current_user: CurrentUser = Depends(get_current_user)):
    db_manager = get_db_manager_for_user(current_user.uid)
    return SchemaResponse(schema_text=db_manager.get_schema_info())


@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: str, current_user: CurrentUser = Depends(get_current_user)):
    db = get_firestore_client()
    doc_ref = (
        db.collection("users").document(current_user.uid)
        .collection("datasets").document(dataset_id)
    )
    snapshot = doc_ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found.")

    table_name = snapshot.to_dict().get("tableName")
    db_manager = get_db_manager_for_user(current_user.uid)
    if table_name:
        # Use the manager's own connection context (already exists in core/database.py)
        # rather than execute_query, which is scoped to guarded read-only SELECTs.
        with db_manager.get_connection() as conn:
            conn.execute(f"DROP TABLE IF EXISTS '{table_name}'")
            conn.commit()
        sync_user_db_to_storage(current_user.uid)

    doc_ref.delete()
    return {"ok": True}
