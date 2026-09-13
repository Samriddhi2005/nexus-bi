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
        r"\bREPLACE\s+INTO\b",
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
        sql_str = sql.strip()
        fence_match = re.search(r"```(?:sql)?\s*([\s\S]*?)\s*```", sql_str, flags=re.IGNORECASE)
        if fence_match:
            sql_str = fence_match.group(1).strip()
        else:
            sql_str = re.sub(r"^```(?:sql)?\s*", "", sql_str, flags=re.IGNORECASE)
            sql_str = re.sub(r"\s*```$", "", sql_str).strip()

        # Remove single-line comments
        sql_str = re.sub(r"--.*$", "", sql_str, flags=re.MULTILINE)
        # Remove multi-line comments
        sql_str = re.sub(r"/\*.*?\*/", "", sql_str, flags=re.DOTALL)
        sql_str = sql_str.strip().rstrip(";").strip()
        return sql_str

    @classmethod
    def validate_query(cls, sql_query: str) -> Tuple[bool, str, str]:
        """
        Validates whether the SQL query is safe and strictly read-only.
        Returns (is_safe, error_or_success_message, sanitized_query).
        """
        cleaned_sql = cls.clean_query(sql_query)

        if not cleaned_sql:
            return False, "Query is empty.", ""

        # Check for multiple stacked queries without false-positives on string literals
        sql_no_literals = re.sub(r"'(?:''|[^'])*'", "''", cleaned_sql)
        sql_no_literals = re.sub(r'"(?:""|[^"])*"', '""', sql_no_literals)
        if ";" in sql_no_literals:
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
