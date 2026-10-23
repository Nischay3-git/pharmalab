# server/app.py
from flask import Flask, jsonify, request
from flask_cors import CORS
from db import get_db_connection

app = Flask(__name__)
CORS(app)

@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy", "service": "PharmaLab API"}), 200

# ----------------- Products -----------------
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

# ----------------- Batches -----------------
@app.route("/api/batches", methods=["GET"])
def get_batches():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT b.batch_id, b.batch_number, p.name AS product_name, 
                   b.manufacture_date, b.expiry_date, b.status
            FROM Batches b
            JOIN Products p ON b.product_id = p.product_id
            ORDER BY b.batch_id DESC;
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

@app.route("/api/batches", methods=["POST"])
def create_batch():
    try:
        data = request.get_json()
        batch_number = data.get("batch_number")
        product_id = data.get("product_id")
        manufacture_date = data.get("manufacture_date")
        expiry_date = data.get("expiry_date")
        created_by = data.get("created_by", 1)

        if not all([batch_number, product_id, manufacture_date, expiry_date]):
            return jsonify({"error": "Missing required batch fields"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO Batches (batch_number, product_id, manufacture_date, expiry_date, status, created_by)
            VALUES (?, ?, ?, ?, 'Registered', ?);
        """, (batch_number, product_id, manufacture_date, expiry_date, created_by))
        conn.commit()
        conn.close()

        return jsonify({"message": f"Batch {batch_number} registered successfully"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ----------------- Quality Tests & Automated Evaluation -----------------
@app.route("/api/tests", methods=["GET"])
def get_tests():
    """Retrieve all standard quality test definitions and limits."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT test_id, test_name, unit, min_limit, max_limit, description 
            FROM QualityTests;
        """)
        rows = cursor.fetchall()
        tests = [
            {
                "test_id": r[0],
                "test_name": r[1],
                "unit": r[2],
                "min_limit": float(r[3]),
                "max_limit": float(r[4]),
                "description": r[5]
            }
            for r in rows
        ]
        conn.close()
        return jsonify(tests), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/test-results", methods=["GET"])
def get_test_results():
    """Retrieve all recorded test results with batch and test names."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT tr.result_id, b.batch_number, qt.test_name, tr.measured_value, 
                   qt.unit, qt.min_limit, qt.max_limit, tr.status, tr.test_date
            FROM TestResults tr
            JOIN Batches b ON tr.batch_id = b.batch_id
            JOIN QualityTests qt ON tr.test_id = qt.test_id
            ORDER BY tr.result_id DESC;
        """)
        rows = cursor.fetchall()
        results = [
            {
                "result_id": r[0],
                "batch_number": r[1],
                "test_name": r[2],
                "measured_value": float(r[3]),
                "unit": r[4],
                "min_limit": float(r[5]),
                "max_limit": float(r[6]),
                "status": r[7],
                "test_date": str(r[8])[:19]
            }
            for r in rows
        ]
        conn.close()
        return jsonify(results), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/test-results", methods=["POST"])
def log_test_result():
    """
    Core Evaluation Engine:
    Compares measured_value against min_limit and max_limit,
    records Pass/Fail automatically, and updates the batch status.
    """
    try:
        data = request.get_json()
        batch_id = data.get("batch_id")
        test_id = data.get("test_id")
        measured_value = data.get("measured_value")
        tested_by = data.get("tested_by", 1)

        if batch_id is None or test_id is None or measured_value is None:
            return jsonify({"error": "batch_id, test_id, and measured_value are required"}), 400

        measured_value = float(measured_value)

        conn = get_db_connection()
        cursor = conn.cursor()

        # 1. Fetch test specifications
        cursor.execute("SELECT min_limit, max_limit, test_name, unit FROM QualityTests WHERE test_id = ?", (test_id,))
        test_spec = cursor.fetchone()
        if not test_spec:
            conn.close()
            return jsonify({"error": "Test specification not found"}), 404

        min_limit = float(test_spec[0])
        max_limit = float(test_spec[1])
        test_name = test_spec[2]
        unit = test_spec[3]

        # 2. Automated evaluation logic
        evaluation_status = "Pass" if (min_limit <= measured_value <= max_limit) else "Fail"

        # 3. Insert into TestResults
        cursor.execute("""
            INSERT INTO TestResults (batch_id, test_id, measured_value, status, tested_by)
            VALUES (?, ?, ?, ?, ?);
        """, (batch_id, test_id, measured_value, evaluation_status, tested_by))

        # 4. Update the batch lifecycle status
        # If any test fails, mark batch as Quarantined; otherwise set to In Testing
        if evaluation_status == "Fail":
            cursor.execute("UPDATE Batches SET status = 'Quarantined' WHERE batch_id = ?", (batch_id,))
        else:
            cursor.execute("""
                UPDATE Batches 
                SET status = 'In Testing' 
                WHERE batch_id = ? AND status = 'Registered';
            """, (batch_id,))

        conn.commit()
        conn.close()

        return jsonify({
            "message": f"Test logged: {evaluation_status.upper()}",
            "evaluation": {
                "test_name": test_name,
                "measured_value": f"{measured_value} {unit}",
                "specification": f"{min_limit} - {max_limit} {unit}",
                "status": evaluation_status
            }
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)