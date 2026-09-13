import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

def render_plotly_safely(chart_code: str, df: pd.DataFrame):
    """
    Safely executes Plotly visualization code in a restricted scope.
    Restricts __builtins__ to safe primitives and exposes pandas, plotly.express, plotly.graph_objects, and df.
    """
    safe_builtins = {
        "abs": abs, "all": all, "any": any, "bool": bool, "dict": dict,
        "enumerate": enumerate, "float": float, "int": int, "len": len,
        "list": list, "max": max, "min": min, "range": range, "round": round,
        "str": str, "sum": sum, "zip": zip, "print": print
    }
    local_scope = {"pd": pd, "px": px, "go": go, "df": df}
    exec(chart_code, {"__builtins__": safe_builtins}, local_scope)
    return local_scope.get("fig")
