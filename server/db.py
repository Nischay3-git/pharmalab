# server/db.py
import os
from pathlib import Path

import pyodbc
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

CONN_STR = os.getenv("AZURE_SQL_CONNECTION_STRING")

def get_db_connection():
    if not CONN_STR:
        raise ValueError("AZURE_SQL_CONNECTION_STRING is missing in .env")
    return pyodbc.connect(CONN_STR)