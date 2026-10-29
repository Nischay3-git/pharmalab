# server/app.py
import os
import datetime
from functools import wraps
import jwt
from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.security import check_password_hash
from db import get_db_connection

app = Flask(__name__)
CORS(app)

JWT_SECRET = os.getenv("SECRET_KEY", "pharmalab-super-secret-key-2026")
JWT_ALGORITHM = "HS256"

# ----------------- Security & RBAC Decorators -----------------
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

        if not token:
            return jsonify({"error": "Authentication token is missing"}), 401

        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            current_user = {
                "user_id": payload["user_id"],
                "username": payload["username"],
                "role_name": payload["role_name"]
            }
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Session token has expired. Please log in again."}), 401
        except Exception:
            return jsonify({"error": "Invalid token. Authorization denied."}), 401

        return f(current_user, *args, **kwargs)
    return decorated

def role_required(allowed_roles):
    """
    RBAC Decorator:
    Ensures Administrator has full access to all endpoints,
    while restricting other roles according to allowed_roles.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(current_user, *args, **kwargs):
            user_role = current_user.get("role_name")
            if user_role == "Administrator" or user_role in allowed_roles:
                return f(current_user, *args, **kwargs)
            return jsonify({
                "error": f"Forbidden: Your role '{user_role}' lacks permission for this action."
            }), 403
        return decorated_function
    return decorator

# ----------------- Auth Routes -----------------
# ----------------- Auth Routes -----------------
@app.route("/api/auth/login", methods=["POST"])
def login():
    try:
        data = request.get_json() or {}
        username = data.get("username", "").strip()
        password = data.get("password", "")

        if not username or not password:
            return jsonify({"error": "Username and password required"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT u.user_id, u.username, u.password_hash, r.role_name, u.is_active
            FROM Users u
            JOIN Roles r ON u.role_id = r.role_id
            WHERE u.username = ?;
        """, (username,))
        user_row = cursor.fetchone()
        conn.close()

        # Check if user exists and is active
        if not user_row or not user_row[4]:
            return jsonify({"error": "Invalid username or password"}), 401

        user_id = user_row[0]
        user_name = user_row[1]
        stored_hash = str(user_row[2]) if user_row[2] is not None else ""
        role_name = user_row[3]

        # Verify password: first direct match, then werkzeug hash check
        is_valid = (stored_hash == password)
        if not is_valid:
            try:
                is_valid = check_password_hash(stored_hash, password)
            except Exception:
                is_valid = False

        if not is_valid:
            return jsonify({"error": "Invalid username or password"}), 401

        # Issue JWT valid for 8 hours
        token = jwt.encode({
            "user_id": user_id,
            "username": user_name,
            "role_name": role_name,
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=8)
        }, JWT_SECRET, algorithm=JWT_ALGORITHM)

        return jsonify({
            "token": token,
            "user": {
                "user_id": user_id,
                "username": user_name,
                "role_name": role_name
            }
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
        products = [
            {"product_id": r[0], "name": r[1], "dosage_form": r[2], "strength": r[3], "manufacturer": r[4]}
            for r in cursor.fetchall()
        ]
        conn.close()
        return jsonify(products), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/products", methods=["POST"])
@token_required
@role_required(["Administrator"])  # Only Admin can create master product definitions
def create_product(current_user):
    try:
        data = request.get_json()
        name = data.get("name")
        dosage_form = data.get("dosage_form")
        strength = data.get("strength")
        manufacturer_id = data.get("manufacturer_id", 1)

        if not all([name, dosage_form, strength]):
            return jsonify({"error": "Missing product fields"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO Products (name, dosage_form, strength, manufacturer_id)
            VALUES (?, ?, ?, ?);
        """, (name, dosage_form, strength, manufacturer_id))
        conn.commit()
        conn.close()
        return jsonify({"message": f"Product '{name}' added successfully by Admin"}), 201
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
        batches = [
            {"batch_id": r[0], "batch_number": r[1], "product_name": r[2], "manufacture_date": str(r[3]), "expiry_date": str(r[4]), "status": r[5]}
            for r in cursor.fetchall()
        ]
        conn.close()
        return jsonify(batches), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/batches", methods=["POST"])
@token_required
@role_required(["Laboratory Technician"]) # Tech + Admin
def create_batch(current_user):
    try:
        data = request.get_json()
        batch_number = data.get("batch_number")
        product_id = data.get("product_id")
        manufacture_date = data.get("manufacture_date")
        expiry_date = data.get("expiry_date")

        if not all([batch_number, product_id, manufacture_date, expiry_date]):
            return jsonify({"error": "Missing required batch fields"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO Batches (batch_number, product_id, manufacture_date, expiry_date, status, created_by)
            VALUES (?, ?, ?, ?, 'Registered', ?);
        """, (batch_number, product_id, manufacture_date, expiry_date, current_user["user_id"]))
        conn.commit()
        conn.close()
        return jsonify({"message": f"Batch {batch_number} registered successfully"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ----------------- Quality Testing -----------------
@app.route("/api/tests", methods=["GET"])
def get_tests():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT test_id, test_name, unit, min_limit, max_limit, description FROM QualityTests;")
        tests = [
            {"test_id": r[0], "test_name": r[1], "unit": r[2], "min_limit": float(r[3]), "max_limit": float(r[4]), "description": r[5]}
            for r in cursor.fetchall()
        ]
        conn.close()
        return jsonify(tests), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/test-results", methods=["GET"])
def get_test_results():
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
        results = [
            {"result_id": r[0], "batch_number": r[1], "test_name": r[2], "measured_value": float(r[3]), "unit": r[4], "min_limit": float(r[5]), "max_limit": float(r[6]), "status": r[7], "test_date": str(r[8])[:19]}
            for r in cursor.fetchall()
        ]
        conn.close()
        return jsonify(results), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/test-results", methods=["POST"])
@token_required
@role_required(["Laboratory Technician", "QC Officer"]) # Tech + QC + Admin
def log_test_result(current_user):
    try:
        data = request.get_json()
        batch_id = data.get("batch_id")
        test_id = data.get("test_id")
        measured_value = float(data.get("measured_value"))

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT min_limit, max_limit, test_name, unit FROM QualityTests WHERE test_id = ?", (test_id,))
        spec = cursor.fetchone()
        if not spec:
            conn.close()
            return jsonify({"error": "Test specification not found"}), 404

        min_limit, max_limit, test_name, unit = float(spec[0]), float(spec[1]), spec[2], spec[3]
        evaluation_status = "Pass" if (min_limit <= measured_value <= max_limit) else "Fail"

        cursor.execute("""
            INSERT INTO TestResults (batch_id, test_id, measured_value, status, tested_by)
            OUTPUT INSERTED.result_id
            VALUES (?, ?, ?, ?, ?);
        """, (batch_id, test_id, measured_value, evaluation_status, current_user["user_id"]))
        result_id = cursor.fetchone()[0]

        if evaluation_status == "Fail":
            cursor.execute("UPDATE Batches SET status = 'Quarantined' WHERE batch_id = ?", (batch_id,))
            dev_desc = f"Out-of-Specification: {test_name} measured {measured_value} {unit} (Acceptable: {min_limit}-{max_limit} {unit})"
            cursor.execute("""
                INSERT INTO Deviations (batch_id, result_id, description, severity, status, assigned_to)
                VALUES (?, ?, ?, 'High', 'Open', ?);
            """, (batch_id, result_id, dev_desc, current_user["user_id"]))
        else:
            cursor.execute("UPDATE Batches SET status = 'In Testing' WHERE batch_id = ? AND status = 'Registered';", (batch_id,))

        conn.commit()
        conn.close()

        return jsonify({
            "message": f"Test evaluated: {evaluation_status.upper()}",
            "evaluation": {
                "test_name": test_name,
                "measured_value": f"{measured_value} {unit}",
                "specification": f"{min_limit} - {max_limit} {unit}",
                "status": evaluation_status
            }
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ----------------- Deviations & CAPA -----------------
@app.route("/api/deviations", methods=["GET"])
def get_deviations():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT d.deviation_id, b.batch_number, d.description, d.severity, 
                   d.status, u.username AS assigned_user, d.created_at, d.closed_at, d.batch_id
            FROM Deviations d
            JOIN Batches b ON d.batch_id = b.batch_id
            JOIN Users u ON d.assigned_to = u.user_id
            ORDER BY d.deviation_id DESC;
        """)
        deviations = [
            {
                "deviation_id": r[0], "batch_number": r[1], "description": r[2], "severity": r[3],
                "status": r[4], "assigned_to": r[5], "created_at": str(r[6])[:19],
                "closed_at": str(r[7])[:19] if r[7] else None, "batch_id": r[8]
            }
            for r in cursor.fetchall()
        ]

        for dev in deviations:
            cursor.execute("""
                SELECT ca.action_id, ca.description, u.username AS owner, ca.target_date, ca.status
                FROM CorrectiveActions ca
                JOIN Users u ON ca.owner_id = u.user_id
                WHERE ca.deviation_id = ?;
            """, (dev["deviation_id"],))
            dev["actions"] = [
                {"action_id": a[0], "description": a[1], "owner": a[2], "target_date": str(a[3]), "status": a[4]}
                for a in cursor.fetchall()
            ]

        conn.close()
        return jsonify(deviations), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/corrective-actions", methods=["POST"])
@token_required
@role_required(["QA Officer"]) # QA + Admin
def add_corrective_action(current_user):
    try:
        data = request.get_json()
        deviation_id = data.get("deviation_id")
        description = data.get("description")
        target_date = data.get("target_date")

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO CorrectiveActions (deviation_id, description, owner_id, target_date, status)
            VALUES (?, ?, ?, ?, 'Pending');
        """, (deviation_id, description, current_user["user_id"], target_date))
        cursor.execute("UPDATE Deviations SET status = 'Under Investigation' WHERE deviation_id = ? AND status = 'Open';", (deviation_id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Corrective action assigned"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/corrective-actions/<int:action_id>/complete", methods=["PATCH"])
@token_required
@role_required(["QA Officer", "QC Officer", "Laboratory Technician"]) # Tech + QC + QA + Admin
def complete_action(current_user, action_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE CorrectiveActions 
            SET status = 'Completed', completed_at = SYSUTCDATETIME()
            WHERE action_id = ?;
        """, (action_id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Action completed"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/deviations/<int:deviation_id>/close", methods=["PATCH"])
@token_required
@role_required(["QA Officer"]) # QA + Admin only
def close_deviation(current_user, deviation_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM CorrectiveActions WHERE deviation_id = ?;", (deviation_id,))
        if cursor.fetchone()[0] == 0:
            conn.close()
            return jsonify({"error": "Cannot close: Quality guidelines require at least one CAPA task before closure."}), 400

        cursor.execute("SELECT COUNT(*) FROM CorrectiveActions WHERE deviation_id = ? AND status = 'Pending';", (deviation_id,))
        pending = cursor.fetchone()[0]
        if pending > 0:
            conn.close()
            return jsonify({"error": f"Cannot close: {pending} action(s) still pending."}), 400

        cursor.execute("""
            UPDATE Deviations 
            SET status = 'Closed', closed_at = SYSUTCDATETIME() 
            WHERE deviation_id = ?;
        """, (deviation_id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Deviation closed successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)