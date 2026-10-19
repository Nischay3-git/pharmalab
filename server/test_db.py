import os
from pathlib import Path

import pyodbc
from dotenv import load_dotenv


def get_connection_strings():
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
    conn_str = os.getenv("AZURE_SQL_CONNECTION_STRING")
    if not conn_str:
        return []

    conn_str = conn_str.strip()
    candidates = []
    for candidate in [conn_str, conn_str.replace("ODBC Driver 18 for SQL Server", "SQL Server")]:
        if candidate and candidate not in candidates:
            candidates.append(candidate)
    return candidates


def main():
    conn_strings = get_connection_strings()
    if not conn_strings:
        print("Error: AZURE_SQL_CONNECTION_STRING not found in .env file.")
        return 1

    last_error = None
    for conn_str in conn_strings:
        try:
            print("Attempting to connect to Azure SQL Database...")
            with pyodbc.connect(conn_str) as conn:
                with conn.cursor() as cursor:
                    print("Connected successfully!\n")

                    cursor.execute("SELECT product_id, name, dosage_form, strength FROM Products;")
                    rows = cursor.fetchall()

                    print("--- Products in Database ---")
                    for row in rows:
                        print(f"ID: {row[0]} | Name: {row[1]} | Form: {row[2]} | Strength: {row[3]}")
            return 0
        except pyodbc.Error as exc:
            last_error = exc

    print(f"Database connection failed: {last_error}")
    if any("ODBC Driver 18 for SQL Server" in conn_str for conn_str in conn_strings):
        print("Hint: This machine is using the SQL Server ODBC driver. Update AZURE_SQL_CONNECTION_STRING to use Driver={SQL Server}.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())