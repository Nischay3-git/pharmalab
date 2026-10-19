# server/app.py
from flask import Flask, jsonify, request
from flask_cors import CORS
from db import get_db_connection

app = Flask(__name__)
CORS(app)  # Enables cross-origin requests for your React frontend

@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy", "service": "PharmaLab API"}), 200

@app.route("/api/products", methods=["GET"])
def get_products():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.product_id, p.name, p.dosage_form, p.strength, m.name AS manufacturer_name
            FROM Products p
            JOIN Manufacturers m ON p.manufacturer_id = m.manufacturer_id;
        """)
        rows = cursor.fetchall()
        products = [
            {
                "product_id": r[0],
                "name": r[1],
                "dosage_form": r[2],
                "strength": r[3],
                "manufacturer": r[4]
            }
            for r in rows
        ]
        conn.close()
        return jsonify(products), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/batches", methods=["GET"])
def get_batches():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT b.batch_id, b.batch_number, p.name AS product_name, 
                   b.manufacture_date, b.expiry_date, b.status
            FROM Batches b
            JOIN Products p ON b.product_id = p.product_id;
        """)
        rows = cursor.fetchall()
        batches = [
            {
                "batch_id": r[0],
                "batch_number": r[1],
                "product_name": r[2],
                "manufacture_date": str(r[3]),
                "expiry_date": str(r[4]),
                "status": r[5]
            }
            for r in rows
        ]
        conn.close()
        return jsonify(batches), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)