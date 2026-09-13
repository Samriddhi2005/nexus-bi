import re
from typing import Tuple

class SQLGuardrail:
    """
    Enterprise-grade SQL Guardrail validator to prevent destructive queries,
    data mutations, DDL attacks, and SQL injection payloads.
    """
    FORBIDDEN_KEYWORDS = [
        r"\bDROP\b",
        r"\bDELETE\b",
        r"\bUPDATE\b",
        r"\bINSERT\b",
        r"\bALTER\b",
        r"\bTRUNCATE\b",
        r"\bREPLACE\b",
        r"\bCREATE\b",
        r"\bATTACH\b",
        r"\bDETACH\b",
        r"\bGRANT\b",
        r"\bREVOKE\b",
        r"\bPRAGMA\b",
        r"\bEXEC\b",
        r"\bEXECUTE\b",
        r"\bxp_\b"
    ]

    @classmethod
    def clean_query(cls, sql: str) -> str:
        """Strips markdown code fences, comments, and trailing semicolons."""
        sql = re.sub(r"^```(?:sql)?\s*", "", sql.strip(), flags=re.IGNORECASE)
        sql = re.sub(r"\s*```$", "", sql.strip())
        # Remove single-line comments
        sql = re.sub(r"--.*$", "", sql, flags=re.MULTILINE)
        # Remove multi-line comments
        sql = re.sub(r"/\*.*?\*/", "", sql, flags=re.DOTALL)
        sql = sql.strip().rstrip(";")
        return sql

    @classmethod
    def validate_query(cls, sql_query: str) -> Tuple[bool, str, str]:
        """
        Validates whether the SQL query is safe and strictly read-only.
        Returns (is_safe, error_or_success_message, sanitized_query).
        """
        cleaned_sql = cls.clean_query(sql_query)

        if not cleaned_sql:
            return False, "Query is empty.", ""

        # Check for multiple stacked queries (e.g. SELECT 1; DROP TABLE ...)
        if ";" in cleaned_sql:
            return False, "Stacked queries with semicolons are not allowed for security.", cleaned_sql

        # Verify that query begins with SELECT or WITH (Common Table Expressions)
        if not re.match(r"^\s*(SELECT|WITH)\b", cleaned_sql, flags=re.IGNORECASE):
            return False, "Security Violation: Only read-only SELECT or WITH statements are permitted.", cleaned_sql

        # Check against blacklisted keywords
        for pattern in cls.FORBIDDEN_KEYWORDS:
            if re.search(pattern, cleaned_sql, flags=re.IGNORECASE):
                keyword_match = re.search(pattern, cleaned_sql, flags=re.IGNORECASE).group(0)
                return False, f"Security Violation: Query contains prohibited keyword '{keyword_match}'.", cleaned_sql

        return True, "Query verified safe and read-only.", cleaned_sql
