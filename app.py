import streamlit as st
import pandas as pd
import json
import plotly.express as px
import plotly.graph_objects as go
import time
import os

from core.database import DatabaseManager
from core.llm_factory import LLMFactory
from core.agent_graph import run_bi_workflow

# -------------------------------------------------------------
# Streamlit Page Config & Custom Styling
# -------------------------------------------------------------
st.set_page_config(
    page_title="NexusBI — Autonomous Multi-Agent BI Analyst",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Glassmorphism & Modern Dark Theme CSS
st.markdown("""
<style>
    /* Main Background & Fonts */
    .stApp {
        background-color: #0b0f19;
        color: #f1f5f9;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    
    /* Sidebar Styling */
    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, #0f172a 0%, #080d1a 100%);
        border-right: 1px solid #1e293b;
    }
    
    /* Sleek Header Banner */
    .hero-banner {
        background: linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.7) 100%);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(59, 130, 246, 0.2);
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 24px;
        box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
    }
    .hero-title {
        font-size: 28px;
        font-weight: 800;
        background: linear-gradient(90deg, #60a5fa, #a855f7);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 8px;
    }
    .hero-subtitle {
        color: #94a3b8;
        font-size: 14px;
        margin: 0;
    }
    
    /* Thought Log Styling */
    .thought-item {
        padding: 8px 12px;
        border-left: 3px solid #3b82f6;
        background: rgba(30, 41, 59, 0.4);
        margin-bottom: 6px;
        border-radius: 4px;
        font-size: 13px;
        color: #cbd5e1;
    }
    
    /* Badge styling */
    .badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .badge-safe {
        background: rgba(34, 197, 94, 0.15);
        color: #4ade80;
        border: 1px solid rgba(34, 197, 94, 0.3);
    }
    .badge-agent {
        background: rgba(99, 102, 241, 0.15);
        color: #a5b4fc;
        border: 1px solid rgba(99, 102, 241, 0.3);
    }
</style>
""", unsafe_allow_html=True)

# -------------------------------------------------------------
# Initialize Session State
# -------------------------------------------------------------
if "db_manager" not in st.session_state:
    st.session_state.db_manager = DatabaseManager()

if "messages" not in st.session_state:
    st.session_state.messages = []

# -------------------------------------------------------------
# Sidebar: Configuration & Controls
# -------------------------------------------------------------
with st.sidebar:
    st.markdown("### ⚡ NexusBI Controls")
    st.caption("Autonomous Multi-Agent BI Analytics Engine")
    st.divider()

    # Model Provider Selection
    st.markdown("#### 1. Select Free LLM Provider")
    llm_provider = st.selectbox(
        "Provider",
        options=["Groq (Recommended - Free & 500 T/s)", "Google Gemini (Free Tier)", "OpenAI (Optional)"],
        index=0
    )

    provider_code = "groq"
    model_name = "openai/gpt-oss-120b"
    if "Gemini" in llm_provider:
        provider_code = "gemini"
        model_name = "gemini-1.5-flash"
    elif "OpenAI" in llm_provider:
        provider_code = "openai"
        model_name = "gpt-4o-mini"
    else:
        selected_model = st.selectbox(
            "Select Groq Model",
            options=[
                "openai/gpt-oss-120b (Recommended - 120B Flagship)",
                "qwen/qwen3.8-27b (Fast & Smart)",
                "openai/gpt-oss-20b (Ultra Fast)"
            ],
            index=0
        )
        model_name = selected_model.split(" ")[0]

    # API Key Input
    st.markdown("#### 2. Enter API Key")
    env_groq = os.getenv("GROQ_API_KEY", "")
    env_gemini = os.getenv("GEMINI_API_KEY", "")
    env_openai = os.getenv("OPENAI_API_KEY", "")

    default_key = ""
    if provider_code == "groq":
        default_key = env_groq
        help_text = "[👉 Get a Free Groq API Key (No Credit Card)](https://console.groq.com/keys)"
    elif provider_code == "gemini":
        default_key = env_gemini
        help_text = "[👉 Get a Free Google Gemini API Key](https://aistudio.google.com/app/apikey)"
    else:
        default_key = env_openai
        help_text = "Enter OpenAI API Key"

    user_api_key = st.text_input(
        f"{provider_code.upper()} API Key",
        value=default_key,
        type="password",
        help="Keys are kept private in your session and never logged."
    )
    st.markdown(help_text)
    st.divider()

    # Data Source Section
    st.markdown("#### 3. Data Source")
    data_source = st.radio(
        "Choose Database Mode",
        options=["Bundled Sales KPI (Jan-Jul 2024)", "Upload CSV / Excel"],
        index=0
    )

    if data_source == "Upload CSV / Excel":
        uploaded_file = st.file_uploader("Upload custom CSV or Excel", type=["csv", "xlsx", "xls"])
        if uploaded_file is not None:
            table_name = uploaded_file.name.split(".")[0]
            success, msg = st.session_state.db_manager.load_file_to_sqlite(uploaded_file, table_name)
            if success:
                st.success(f"✅ {msg}")
            else:
                st.error(f"❌ {msg}")

    # Inspect Active Schema
    with st.expander("🔍 Inspect Database Schema", expanded=False):
        schema_text = st.session_state.db_manager.get_schema_info()
        st.code(schema_text, language="sql")

    st.divider()
    if st.button("🗑️ Clear Chat History", use_container_width=True):
        st.session_state.messages = []
        st.rerun()

# -------------------------------------------------------------
# Main Header Banner
# -------------------------------------------------------------
st.markdown("""
<div class="hero-banner">
    <div class="hero-title">⚡ NexusBI: Autonomous Multi-Agent BI Analyst</div>
    <div class="hero-subtitle">
        Turn conversational questions into validated SQL, self-healing database queries, dynamic Plotly charts, and strategic executive insights.
    </div>
</div>
""", unsafe_allow_html=True)

# Quick Starter Pills
st.markdown("**⚡ Sample Questions (Click to run):**")
col1, col2, col3, col4 = st.columns(4)

preset_prompt = None
with col1:
    if st.button("📈 Profit in July 2024?", use_container_width=True):
        preset_prompt = "What was the profit in July 2024?"
with col2:
    if st.button("📉 Lower than average?", use_container_width=True):
        preset_prompt = "Which months saw lower profit as compared to the overall average profit across all months?"
with col3:
    if st.button("📊 Profit Trend?", use_container_width=True):
        preset_prompt = "What is the trend of profit across all the months?"
with col4:
    if st.button("⭐ Highest Customer Score?", use_container_width=True):
        preset_prompt = "Which months recorded the highest customer satisfaction score?"

st.write("")

# -------------------------------------------------------------
# Display Chat History
# -------------------------------------------------------------
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        if msg["role"] == "user":
            st.markdown(f"**{msg['content']}**")
        else:
            res = msg["response_data"]

            # Thought Trace Accordion
            if res.get("thought_log"):
                with st.expander("🧠 Agent Multi-Step Reasoning Trace", expanded=False):
                    for step in res["thought_log"]:
                        st.markdown(f"""
                        <div class="thought-item">
                            <span class="badge badge-agent">{step.get('agent', 'Agent')}</span><br>
                            {step.get('thought', '')}
                        </div>
                        """, unsafe_allow_html=True)

            # Tabbed Results
            tab1, tab2, tab3, tab4 = st.tabs(["💡 Executive Insights", "📊 Interactive Chart", "📋 Raw Data", "🛠️ SQL Inspector"])

            with tab1:
                st.markdown(res.get("final_insights", "No insights generated."))

            with tab2:
                chart_code = res.get("chart_code")
                sql_df_json = res.get("sql_df_json")
                if chart_code and sql_df_json:
                    try:
                        df = pd.read_json(sql_df_json, orient="split")
                        local_scope = {"pd": pd, "px": px, "go": go, "df": df}
                        exec(chart_code, {}, local_scope)
                        fig = local_scope.get("fig")
                        if fig:
                            st.plotly_chart(fig, use_container_width=True)
                        else:
                            st.info("Chart figure was not initialized.")
                    except Exception as e:
                        st.caption(f"Chart render notice: {e}")
                else:
                    st.info("No chart needed for this query (e.g., single scalar fact or empty result).")

            with tab3:
                sql_df_json = res.get("sql_df_json")
                if sql_df_json:
                    df = pd.read_json(sql_df_json, orient="split")
                    st.dataframe(df, use_container_width=True)
                    csv_data = df.to_csv(index=False).encode('utf-8')
                    st.download_button(
                        "📥 Download Result as CSV",
                        data=csv_data,
                        file_name="nexus_bi_result.csv",
                        mime="text/csv",
                        key=f"dl_{time.time()}"
                    )
                else:
                    st.write("No tabular data returned.")

            with tab4:
                st.markdown(f"<span class='badge badge-safe'>Safe Read-Only Query</span>", unsafe_allow_html=True)
                st.code(res.get("sql_query", "-- No SQL generated"), language="sql")
                if res.get("guardrail_message"):
                    st.caption(f"Guardrail Note: {res['guardrail_message']}")

# -------------------------------------------------------------
# User Input Handling
# -------------------------------------------------------------
user_input = st.chat_input("Ask any business question about your data (e.g. sales, profit, trends)...")
query_to_run = preset_prompt or user_input

if query_to_run:
    # Check for API Key
    if not user_api_key:
        st.warning(f"⚠️ Please enter your {provider_code.upper()} API Key in the left sidebar to proceed! You can get a free one in seconds using the link provided.")
        st.stop()

    # Append user message
    st.session_state.messages.append({"role": "user", "content": query_to_run})
    with st.chat_message("user"):
        st.markdown(f"**{query_to_run}**")

    # Assistant execution with Live Thought Streaming
    with st.chat_message("assistant"):
        status_box = st.status("🤖 Multi-Agent Brain at Work...", expanded=True)

        try:
            status_box.write("⚙️ Connecting to LLM Engine...")
            llm = LLMFactory.get_llm(provider=provider_code, api_key=user_api_key, model_name=model_name)

            status_box.write("🧠 Planner & SQL Engineer: Formulating optimized SQLite query...")
            time.sleep(0.3)

            status_box.write("🛡️ Security Guardrail: Verifying read-only execution...")
            time.sleep(0.2)

            status_box.write("⚡ Database Executor: Running query & checking self-healing...")
            final_state = run_bi_workflow(
                user_query=query_to_run,
                llm=llm,
                db_manager=st.session_state.db_manager
            )

            status_box.write("📊 Chartist & Strategist: Creating insights and visualization...")
            status_box.update(label="✅ Analysis & Insights Complete!", state="complete", expanded=False)

            # Display Thought Trace
            if final_state.get("thought_log"):
                with st.expander("🧠 Agent Multi-Step Reasoning Trace", expanded=False):
                    for step in final_state["thought_log"]:
                        st.markdown(f"""
                        <div class="thought-item">
                            <span class="badge badge-agent">{step.get('agent', 'Agent')}</span><br>
                            {step.get('thought', '')}
                        </div>
                        """, unsafe_allow_html=True)

            # Display Tabs
            tab1, tab2, tab3, tab4 = st.tabs(["💡 Executive Insights", "📊 Interactive Chart", "📋 Raw Data", "🛠️ SQL Inspector"])

            with tab1:
                st.markdown(final_state.get("final_insights", ""))

            with tab2:
                chart_code = final_state.get("chart_code")
                sql_df_json = final_state.get("sql_df_json")
                if chart_code and sql_df_json:
                    try:
                        df = pd.read_json(sql_df_json, orient="split")
                        local_scope = {"pd": pd, "px": px, "go": go, "df": df}
                        exec(chart_code, {}, local_scope)
                        fig = local_scope.get("fig")
                        if fig:
                            st.plotly_chart(fig, use_container_width=True)
                        else:
                            st.info("Chart figure was not initialized.")
                    except Exception as e:
                        st.caption(f"Chart render notice: {e}")
                else:
                    st.info("No chart needed for this query (e.g. single scalar fact or empty result).")

            with tab3:
                sql_df_json = final_state.get("sql_df_json")
                if sql_df_json:
                    df = pd.read_json(sql_df_json, orient="split")
                    st.dataframe(df, use_container_width=True)
                    csv_data = df.to_csv(index=False).encode('utf-8')
                    st.download_button(
                        "📥 Download Result as CSV",
                        data=csv_data,
                        file_name="nexus_bi_result.csv",
                        mime="text/csv",
                        key=f"dl_live_{time.time()}"
                    )
                else:
                    st.write("No tabular data returned.")

            with tab4:
                st.markdown(f"<span class='badge badge-safe'>Safe Read-Only Query</span>", unsafe_allow_html=True)
                st.code(final_state.get("sql_query", "-- No SQL generated"), language="sql")
                if final_state.get("guardrail_message"):
                    st.caption(f"Guardrail Note: {final_state['guardrail_message']}")

            # Save to conversation state
            st.session_state.messages.append({
                "role": "assistant",
                "content": final_state.get("final_insights", ""),
                "response_data": final_state
            })

        except Exception as e:
            status_box.update(label="❌ Execution Failed", state="error", expanded=True)
            st.error(f"Error during execution: {str(e)}")
