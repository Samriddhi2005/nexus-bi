from typing import List, Optional

from pydantic import BaseModel


class DatasetSummary(BaseModel):
    id: str
    tableName: str
    originalFilename: str
    rowCount: int
    columns: List[str]
    uploadedAt: Optional[str] = None


class SchemaResponse(BaseModel):
    schema_text: str
