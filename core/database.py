import sqlite3
import pandas as pd
import os
import re
from typing import Tuple, List, Dict, Any, Optional, Generator
from contextlib import contextmanager

class DatabaseManager:
    """
    Manages SQLite database connections, dynamic CSV/Excel ingestion,
    schema extraction, and query execution.
    """
    def __init__(self, db_path: str = "nexus_bi.db"):
        self.db_path = db_path
        self._initialize_default_data()

    @contextmanager
    def get_connection(self) -> Generator[sqlite3.Connection, None, None]:
        """Returns a connection to the SQLite database and ensures it closes properly."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _initialize_default_data(self):
        """Preloads Sales_Agent.csv if the database does not have tables yet."""
        bundled_csv = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "Sales_Agent.csv")
        if os.path.exists(bundled_csv):
            # Check if table already exists
            tables = self.get_table_names()
            if "Sales_Agent" not in tables:
                self.load_file_to_sqlite(bundled_csv, table_name="Sales_Agent")

    @staticmethod
    def clean_column_name(col: str) -> str:
        """Sanitizes column names: lowercase, alphanumeric and underscores only."""
        clean = re.sub(r'[^a-zA-Z0-9_]', '_', str(col).strip().lower())
        clean = re.sub(r'_+', '_', clean).strip('_')
        return clean or "column"

    def load_file_to_sqlite(self, file_source: Any, table_name: str) -> Tuple[bool, str]:
        """
        Dynamically loads a CSV or Excel file into SQLite with type inference
        and chronological date standardization.
        """
        try:
            # Clean table name
            clean_table = re.sub(r'[^a-zA-Z0-9_]', '_', table_name.strip())
            clean_table = re.sub(r'_+', '_', clean_table).strip('_')
            if not clean_table:
                clean_table = "custom_data"

            # Read file with Pandas
            if hasattr(file_source, "read") or isinstance(file_source, str):
                if isinstance(file_source, str) and file_source.endswith((".xlsx", ".xls")):
                    df = pd.read_excel(file_source)
                elif hasattr(file_source, "name") and file_source.name.endswith((".xlsx", ".xls")):
                    df = pd.read_excel(file_source)
                else:
                    df = pd.read_csv(file_source)
            else:
                return False, "Unsupported file format."

            # Clean and standardize column names
            df.columns = [self.clean_column_name(c) for c in df.columns]

            # Fix the PDF's month sorting bug:
            # If 'month' and 'year' exist, create a standardized 'date' column (YYYY-MM-01)
            month_map = {
                "january": "01", "february": "02", "march": "03", "april": "04",
                "may": "05", "june": "06", "july": "07", "august": "08",
                "september": "09", "october": "10", "november": "11", "december": "12",
                "jan": "01", "feb": "02", "mar": "03", "apr": "04",
                "jun": "06", "jul": "07", "aug": "08", "sep": "09",
                "oct": "10", "nov": "11", "dec": "12"
            }

            if "month" in df.columns and "year" in df.columns and "date" not in df.columns:
                try:
                    def make_date(row):
                        m_str = str(row["month"]).strip().lower()
                        m_num = month_map.get(m_str, "01")
                        y_val = int(row["year"])
                        return f"{y_val:04d}-{m_num}-01"
                    df["date"] = df.apply(make_date, axis=1)
                except Exception:
                    pass

            # Write DataFrame to SQLite
            with self.get_connection() as conn:
                df.to_sql(clean_table, conn, if_exists="replace", index=False)

            return True, f"Successfully loaded '{clean_table}' with {len(df)} records."
        except Exception as e:
            return False, f"Failed to ingest file: {str(e)}"

    def get_table_names(self) -> List[str]:
        """Returns a list of all user tables in the SQLite database."""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
                return [row["name"] for row in cursor.fetchall()]
        except Exception:
            return []

    def get_schema_info(self) -> str:
        """
        Extracts rich schema information including table names, columns, data types,
        and 2-3 sample rows for the LLM prompt.
        """
        tables = self.get_table_names()
        if not tables:
            return "No tables found in the database."

        schema_lines = []
        with self.get_connection() as conn:
            cursor = conn.cursor()
            for table in tables:
                schema_lines.append(f"Table: {table}")
                cursor.execute(f"PRAGMA table_info('{table}');")
                columns = cursor.fetchall()
                col_descs = [f"  - {col['name']} ({col['type']})" for col in columns]
                schema_lines.extend(col_descs)

                # Fetch 2 sample records
                cursor.execute(f"SELECT * FROM '{table}' LIMIT 2;")
                sample_rows = cursor.fetchall()
                if sample_rows:
                    schema_lines.append("  Sample Rows:")
                    for row in sample_rows:
                        row_dict = dict(row)
                        schema_lines.append(f"    {row_dict}")
                schema_lines.append("")

        return "\n".join(schema_lines)

    def execute_query(self, sql_query: str) -> Tuple[bool, Optional[pd.DataFrame], Optional[str]]:
        """
        Executes a SQL query and returns (success_bool, DataFrame_result, error_string).
        """
        try:
            with self.get_connection() as conn:
                df = pd.read_sql_query(sql_query, conn)
                return True, df, None
        except Exception as e:
            return False, None, str(e)
