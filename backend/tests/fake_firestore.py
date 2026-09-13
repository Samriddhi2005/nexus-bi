"""
Minimal in-memory stand-in for the google-cloud-firestore client, covering
just the surface backend/*.py actually uses (document get/set/update, add,
collection streaming with where/order_by/limit, and count aggregation).

This lets the API layer's persistence logic be exercised in fast unit tests
without a live Firebase project or the Firestore emulator.
"""
import itertools
from typing import Any, Optional

from google.cloud.firestore_v1 import Increment


class _CountResult:
    def __init__(self, value: int):
        self.value = value


class FakeSnapshot:
    def __init__(self, doc_id: str, data: Optional[dict], ref: "FakeDocRef"):
        self.id = doc_id
        self._data = data
        self.exists = data is not None
        self.reference = ref

    def to_dict(self) -> Optional[dict]:
        return dict(self._data) if self._data is not None else None


def _apply_update(data: dict, updates: dict) -> None:
    for key, value in updates.items():
        parts = key.split(".")
        target = data
        for part in parts[:-1]:
            target = target.setdefault(part, {})
        leaf = parts[-1]
        if isinstance(value, Increment):
            target[leaf] = target.get(leaf, 0) + value.value
        else:
            target[leaf] = value


class FakeDocRef:
    def __init__(self, collection: "FakeCollection", doc_id: str):
        self._collection = collection
        self.id = doc_id

    def get(self) -> FakeSnapshot:
        return FakeSnapshot(self.id, self._collection._docs.get(self.id), self)

    def set(self, data: dict, merge: bool = False) -> None:
        if merge and self.id in self._collection._docs:
            self._collection._docs[self.id].update(data)
        else:
            self._collection._docs[self.id] = dict(data)

    def update(self, updates: dict) -> None:
        existing = self._collection._docs.setdefault(self.id, {})
        _apply_update(existing, updates)

    def delete(self) -> None:
        self._collection._docs.pop(self.id, None)

    def collection(self, name: str) -> "FakeCollection":
        return self._collection._db.collection(f"{self._collection._path}/{self.id}/{name}")


class FakeQuery:
    def __init__(self, collection: "FakeCollection", filters=None, order=None, limit_n=None):
        self._collection = collection
        self._filters = filters or []
        self._order = order
        self._limit_n = limit_n

    def where(self, field: str, op: str, value: Any) -> "FakeQuery":
        return FakeQuery(self._collection, self._filters + [(field, op, value)], self._order, self._limit_n)

    def order_by(self, field: str, direction: str = "ASCENDING") -> "FakeQuery":
        return FakeQuery(self._collection, self._filters, (field, direction), self._limit_n)

    def limit(self, n: int) -> "FakeQuery":
        return FakeQuery(self._collection, self._filters, self._order, n)

    def _matches(self, data: dict) -> bool:
        for field, op, value in self._filters:
            actual = data.get(field)
            if op == "==" and actual != value:
                return False
            if op == ">=" and not (actual is not None and actual >= value):
                return False
        return True

    def stream(self):
        items = [
            FakeSnapshot(doc_id, data, FakeDocRef(self._collection, doc_id))
            for doc_id, data in self._collection._docs.items()
            if self._matches(data)
        ]
        if self._order:
            field, direction = self._order
            items.sort(key=lambda s: s.to_dict().get(field) or "", reverse=(direction == "DESCENDING"))
        if self._limit_n is not None:
            items = items[: self._limit_n]
        return items


class FakeCollection:
    def __init__(self, db: "FakeFirestoreClient", path: str):
        self._db = db
        self._path = path
        self._docs: dict[str, dict] = db._storage.setdefault(path, {})
        self._id_counter = itertools.count(1)

    def document(self, doc_id: Optional[str] = None) -> FakeDocRef:
        if doc_id is None:
            doc_id = f"auto_{next(self._id_counter)}_{len(self._docs)}"
        return FakeDocRef(self, doc_id)

    def add(self, data: dict):
        ref = self.document()
        ref.set(data)
        return (None, ref)

    def where(self, field: str, op: str, value: Any) -> FakeQuery:
        return FakeQuery(self).where(field, op, value)

    def order_by(self, field: str, direction: str = "ASCENDING") -> FakeQuery:
        return FakeQuery(self).order_by(field, direction)

    def limit(self, n: int) -> FakeQuery:
        return FakeQuery(self).limit(n)

    def stream(self):
        return FakeQuery(self).stream()

    def count(self):
        class _Countable:
            def __init__(self, outer):
                self._outer = outer

            def get(inner_self):
                return [[_CountResult(len(inner_self._outer._docs))]]

        return _Countable(self)


class FakeFirestoreClient:
    def __init__(self):
        self._storage: dict[str, dict] = {}

    def collection(self, path: str) -> FakeCollection:
        return FakeCollection(self, path)
