from flask import Flask, render_template, request, jsonify, send_file
import sqlite3
import os
import io
from datetime import datetime, date

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_DIR = os.path.join(BASE_DIR, "database")
DATABASE = os.path.join(DATABASE_DIR, "expenses.db")

os.makedirs(DATABASE_DIR, exist_ok=True)


# ---------------- DATABASE ----------------

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_database():

    conn = get_db()

    conn.executescript("""

    CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        income REAL DEFAULT 0,
        savings_goal REAL DEFAULT 0,
        currency TEXT DEFAULT 'INR'
    );

    CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        reason TEXT,
        payment_method TEXT,
        spent_at TEXT NOT NULL,
        notes TEXT,
        favorite INTEGER DEFAULT 0,
        deleted INTEGER DEFAULT 0,
        recurring INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS incomes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        source TEXT NOT NULL,
        received_at TEXT NOT NULL,
        notes TEXT
    );

    CREATE TABLE IF NOT EXISTS recurring_expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        frequency TEXT,
        next_date TEXT
    );

    """)

    conn.execute(
        "INSERT OR IGNORE INTO settings(id) VALUES(1)"
    )

    conn.commit()
    conn.close()


# ---------------- HOME ----------------

@app.route("/")
def home():
    return render_template("index.html")


# ---------------- DASHBOARD ----------------

@app.route("/api/dashboard")
def dashboard():

    conn = get_db()

    income = conn.execute(
        "SELECT COALESCE(SUM(amount),0) FROM incomes"
    ).fetchone()[0]

    expense = conn.execute(
        "SELECT COALESCE(SUM(amount),0) FROM expenses WHERE deleted=0"
    ).fetchone()[0]

    today = date.today().isoformat()

    today_spending = conn.execute(
        """
        SELECT COALESCE(SUM(amount),0)
        FROM expenses
        WHERE deleted=0
        AND substr(spent_at,1,10)=?
        """,
        (today,)
    ).fetchone()[0]

    month = datetime.now().strftime("%Y-%m")

    monthly = conn.execute(
        """
        SELECT COALESCE(SUM(amount),0)
        FROM expenses
        WHERE deleted=0
        AND substr(spent_at,1,7)=?
        """,
        (month,)
    ).fetchone()[0]

    categories = conn.execute(
        """
        SELECT category, SUM(amount) AS total
        FROM expenses
        WHERE deleted=0
        GROUP BY category
        ORDER BY total DESC
        """
    ).fetchall()

    recent = conn.execute(
        """
        SELECT *
        FROM expenses
        WHERE deleted=0
        ORDER BY spent_at DESC
        LIMIT 10
        """
    ).fetchall()

    conn.close()

    return jsonify({

        "income": income,

        "expense": expense,

        "balance": income - expense,

        "today": today_spending,

        "month": monthly,

        "categories": [
            dict(x) for x in categories
        ],

        "recent": [
            dict(x) for x in recent
        ]

    })


# ---------------- EXPENSE ----------------

@app.route("/api/expenses", methods=["GET", "POST"])
def expenses():

    conn = get_db()

    if request.method == "POST":

        data = request.json

        conn.execute(
            """
            INSERT INTO expenses
            (
                amount,
                category,
                reason,
                payment_method,
                spent_at,
                notes,
                favorite
            )
            VALUES(?,?,?,?,?,?,?)
            """,
            (
                float(data["amount"]),
                data["category"],
                data.get("reason", ""),
                data.get("payment_method", "Cash"),
                data.get(
                    "spent_at",
                    datetime.now().isoformat()
                ),
                data.get("notes", ""),
                int(data.get("favorite", 0))
            )
        )

        conn.commit()

    rows = conn.execute(
        """
        SELECT *
        FROM expenses
        WHERE deleted=0
        ORDER BY spent_at DESC
        """
    ).fetchall()

    conn.close()

    return jsonify([
        dict(row) for row in rows
    ])


# ---------------- DELETE EXPENSE ----------------

@app.route("/api/expenses/<int:id>", methods=["DELETE"])
def delete_expense(id):

    conn = get_db()

    conn.execute(
        """
        UPDATE expenses
        SET deleted=1
        WHERE id=?
        """,
        (id,)
    )

    conn.commit()
    conn.close()

    return jsonify({
        "success": True
    })


# ---------------- INCOME ----------------

@app.route("/api/income", methods=["GET", "POST"])
def income():

    conn = get_db()

    if request.method == "POST":

        data = request.json

        conn.execute(
            """
            INSERT INTO incomes
            (
                amount,
                source,
                received_at,
                notes
            )
            VALUES(?,?,?,?)
            """,
            (
                float(data["amount"]),
                data["source"],
                data.get(
                    "received_at",
                    date.today().isoformat()
                ),
                data.get("notes", "")
            )
        )

        conn.commit()

    rows = conn.execute(
        """
        SELECT *
        FROM incomes
        ORDER BY received_at DESC
        """
    ).fetchall()

    conn.close()

    return jsonify([
        dict(row) for row in rows
    ])


# ---------------- RECURRING ----------------

@app.route("/api/recurring", methods=["GET", "POST"])
def recurring():

    conn = get_db()

    if request.method == "POST":

        data = request.json

        conn.execute(
            """
            INSERT INTO recurring_expenses
            (
                title,
                amount,
                category,
                frequency,
                next_date
            )
            VALUES(?,?,?,?,?)
            """,
            (
                data["title"],
                float(data["amount"]),
                data["category"],
                data.get("frequency", "Monthly"),
                data["next_date"]
            )
        )

        conn.commit()

    rows = conn.execute(
        """
        SELECT *
        FROM recurring_expenses
        ORDER BY next_date
        """
    ).fetchall()

    conn.close()

    return jsonify([
        dict(row) for row in rows
    ])


# ---------------- ANALYTICS ----------------

@app.route("/api/analytics")
def analytics():

    conn = get_db()

    daily = conn.execute(
        """
        SELECT
            substr(spent_at,1,10) AS day,
            SUM(amount) AS total
        FROM expenses
        WHERE deleted=0
        GROUP BY day
        ORDER BY day
        """
    ).fetchall()

    category = conn.execute(
        """
        SELECT
            category,
            SUM(amount) AS total
        FROM expenses
        WHERE deleted=0
        GROUP BY category
        ORDER BY total DESC
        """
    ).fetchall()

    payment = conn.execute(
        """
        SELECT
            payment_method,
            SUM(amount) AS total
        FROM expenses
        WHERE deleted=0
        GROUP BY payment_method
        """
    ).fetchall()

    conn.close()

    return jsonify({

        "daily": [
            dict(x) for x in daily
        ],

        "category": [
            dict(x) for x in category
        ],

        "payment": [
            dict(x) for x in payment
        ]

    })


# ---------------- AI ANALYSIS ----------------

@app.route("/api/ai")
def ai_analysis():

    conn = get_db()

    total_income = conn.execute(
        "SELECT COALESCE(SUM(amount),0) FROM incomes"
    ).fetchone()[0]

    total_expense = conn.execute(
        """
        SELECT COALESCE(SUM(amount),0)
        FROM expenses
        WHERE deleted=0
        """
    ).fetchone()[0]

    categories = conn.execute(
        """
        SELECT category, SUM(amount) total
        FROM expenses
        WHERE deleted=0
        GROUP BY category
        ORDER BY total DESC
        """
    ).fetchall()

    conn.close()

    tips = []

    if total_income > 0:

        percentage = (
            total_expense /
            total_income
        ) * 100

        if percentage >= 80:

            tips.append(
                "Your spending is using a large portion "
                "of your recorded income."
            )

        elif percentage >= 50:

            tips.append(
                "More than half of your recorded income "
                "has been spent."
            )

        else:

            tips.append(
                "Your current spending is below half "
                "of your recorded income."
            )

    if categories:

        highest = categories[0]

        tips.append(
            f"{highest['category']} is currently your "
            f"highest spending category."
        )

    if not tips:

        tips.append(
            "Add income and expenses to generate "
            "personalized AI insights."
        )

    prediction = total_expense

    return jsonify({

        "tips": tips,

        "prediction": prediction,

        "income": total_income,

        "expense": total_expense,

        "balance": total_income - total_expense

    })


# ---------------- SETTINGS ----------------

@app.route("/api/settings", methods=["GET", "POST"])
def settings():

    conn = get_db()

    if request.method == "POST":

        data = request.json

        conn.execute(
            """
            UPDATE settings
            SET savings_goal=?,
                currency=?
            WHERE id=1
            """,
            (
                float(data.get("savings_goal", 0)),
                data.get("currency", "INR")
            )
        )

        conn.commit()

    row = conn.execute(
        "SELECT * FROM settings WHERE id=1"
    ).fetchone()

    conn.close()

    return jsonify(dict(row))


# ---------------- EXCEL EXPORT ----------------

@app.route("/export/excel")
def export_excel():

    import pandas as pd

    conn = get_db()

    expenses = pd.read_sql_query(
        """
        SELECT
            id,
            amount,
            category,
            reason,
            payment_method,
            spent_at,
            notes
        FROM expenses
        WHERE deleted=0
        """,
        conn
    )

    income = pd.read_sql_query(
        """
        SELECT *
        FROM incomes
        """,
        conn
    )

    category = pd.read_sql_query(
        """
        SELECT
            category,
            SUM(amount) AS total
        FROM expenses
        WHERE deleted=0
        GROUP BY category
        """,
        conn
    )

    conn.close()

    output = io.BytesIO()

    with pd.ExcelWriter(
        output,
        engine="openpyxl"
    ) as writer:

        expenses.to_excel(
            writer,
            index=False,
            sheet_name="Expense Details"
        )

        income.to_excel(
            writer,
            index=False,
            sheet_name="Income History"
        )

        category.to_excel(
            writer,
            index=False,
            sheet_name="Category Analysis"
        )

    output.seek(0)

    return send_file(
        output,
        as_attachment=True,
        download_name="SmartExpense_Report.xlsx",
        mimetype=
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


# ---------------- PDF EXPORT ----------------

@app.route("/export/pdf")
def export_pdf():

    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import (
        SimpleDocTemplate,
        Paragraph,
        Spacer,
        Table,
        TableStyle
    )
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet

    conn = get_db()

    rows = conn.execute(
        """
        SELECT
            category,
            reason,
            amount,
            payment_method,
            spent_at
        FROM expenses
        WHERE deleted=0
        ORDER BY spent_at DESC
        """
    ).fetchall()

    conn.close()

    output = io.BytesIO()

    document = SimpleDocTemplate(
        output,
        pagesize=A4
    )

    styles = getSampleStyleSheet()

    content = []

    content.append(
        Paragraph(
            "SmartSpend AI - Expense Report",
            styles["Title"]
        )
    )

    content.append(
        Spacer(1, 20)
    )

    data = [
        [
            "Category",
            "Reason",
            "Amount",
            "Payment",
            "Date"
        ]
    ]

    for row in rows:

        data.append([
            row["category"],
            row["reason"] or "-",
            f"Rs. {row['amount']:,.2f}",
            row["payment_method"],
            row["spent_at"][:16]
        ])

    table = Table(
        data,
        repeatRows=1
    )

    table.setStyle(
        TableStyle([
            (
                "BACKGROUND",
                (0,0),
                (-1,0),
                colors.HexColor("#635bff")
            ),
            (
                "TEXTCOLOR",
                (0,0),
                (-1,0),
                colors.white
            ),
            (
                "GRID",
                (0,0),
                (-1,-1),
                0.4,
                colors.grey
            ),
            (
                "FONTSIZE",
                (0,0),
                (-1,-1),
                8
            )
        ])
    )

    content.append(table)

    document.build(content)

    output.seek(0)

    return send_file(
        output,
        as_attachment=True,
        download_name="SmartExpense_Report.pdf",
        mimetype="application/pdf"
    )


# ---------------- RESET ----------------

@app.route("/api/reset", methods=["POST"])
def reset():

    conn = get_db()

    conn.execute("DELETE FROM expenses")
    conn.execute("DELETE FROM incomes")
    conn.execute("DELETE FROM recurring_expenses")

    conn.execute(
        """
        UPDATE settings
        SET savings_goal=0,
            currency='INR'
        WHERE id=1
        """
    )

    conn.commit()
    conn.close()

    return jsonify({
        "success": True
    })


# ---------------- START ----------------

init_database()

if __name__ == "__main__":
    app.run(debug=True)