let expenses = [];

let dailyChart;
let categoryChart;
let analyticsDaily;
let paymentChart;


const $ = (id) =>
    document.getElementById(id);


function money(value) {

    return "₹" +
        Number(value || 0)
        .toLocaleString(
            "en-IN",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );
}


/* ---------------- PAGE NAVIGATION ---------------- */

document
.querySelectorAll(".nav[data-page]")
.forEach(button => {

    button.addEventListener(
        "click",
        () => {

            showPage(
                button.dataset.page
            );

        }
    );

});


function showPage(page) {

    document
    .querySelectorAll(".page")
    .forEach(section => {

        section.classList.remove(
            "active"
        );

    });


    const selected =
        $(page);

    if (selected) {

        selected.classList.add(
            "active"
        );

    }


    document
    .querySelectorAll(".nav")
    .forEach(button => {

        button.classList.toggle(
            "active",
            button.dataset.page === page
        );

    });


    if (page === "expenses")
        loadExpenses();

    if (page === "income")
        loadIncome();

    if (page === "recurring")
        loadRecurring();

    if (page === "analytics")
        loadAnalytics();

    if (page === "ai")
        loadAI();

}


/* ---------------- DASHBOARD ---------------- */

async function loadDashboard() {

    const response =
        await fetch(
            "/api/dashboard"
        );

    const data =
        await response.json();


    $("income").textContent =
        money(data.income);

    $("expense").textContent =
        money(data.expense);

    $("balance").textContent =
        money(data.balance);

    $("today").textContent =
        money(data.today);

    $("month").textContent =
        money(data.month);


    $("clock").textContent =
        new Date().toLocaleString(
            "en-IN",
            {
                dateStyle: "full",
                timeStyle: "short"
            }
        );


    renderRecent(
        data.recent
    );


    renderDashboardCharts(
        data
    );

}


function renderRecent(list) {

    if (!list.length) {

        $("recent").innerHTML =
            "<p>No transactions yet.</p>";

        return;

    }


    $("recent").innerHTML =
        list.map(item => `

        <div class="transaction">

            <div>

                <div class="transaction-title">

                    ${item.category}

                    ${item.favorite ? "⭐" : ""}

                </div>

                <div class="transaction-info">

                    ${item.reason || "No reason"}

                    ·

                    ${item.payment_method}

                    ·

                    ${item.spent_at.replace("T"," ")}

                </div>

            </div>

            <strong>

                -${money(item.amount)}

            </strong>

        </div>

        `).join("");

}


function renderDashboardCharts(data) {

    if (dailyChart)
        dailyChart.destroy();

    if (categoryChart)
        categoryChart.destroy();


    dailyChart =
        new Chart(
            $("dailyChart"),
            {
                type: "line",

                data: {

                    labels:
                        data.recent
                        .map(x =>
                            x.spent_at
                            .slice(0,10)
                        )
                        .reverse(),

                    datasets: [

                        {

                            label:
                                "Spending",

                            data:
                                data.recent
                                .map(x =>
                                    x.amount
                                )
                                .reverse(),

                            tension: 0.35,

                            fill: true

                        }

                    ]

                },

                options: {

                    responsive: true,

                    plugins: {

                        legend: {
                            display: false
                        }

                    }

                }

            }
        );


    categoryChart =
        new Chart(
            $("categoryChart"),
            {
                type: "doughnut",

                data: {

                    labels:
                        data.categories
                        .map(x =>
                            x.category
                        ),

                    datasets: [

                        {

                            data:
                                data.categories
                                .map(x =>
                                    x.total
                                )

                        }

                    ]

                },

                options: {

                    plugins: {

                        legend: {
                            position: "bottom"
                        }

                    }

                }

            }
        );

}


/* ---------------- EXPENSE ---------------- */

async function loadExpenses() {

    const response =
        await fetch(
            "/api/expenses"
        );

    expenses =
        await response.json();

    renderExpenses();

}


function renderExpenses() {

    const search =
        (
            $("filterText")?.value ||
            $("globalSearch")?.value ||
            ""
        ).toLowerCase();


    const payment =
        $("paymentFilter")?.value || "";


    const from =
        $("fromDate")?.value || "";


    const to =
        $("toDate")?.value || "";


    const filtered =
        expenses.filter(
            expense => {

                const text =
                    `
                    ${expense.category}
                    ${expense.reason}
                    ${expense.notes}
                    `.toLowerCase();


                return (

                    (!search ||
                        text.includes(search))

                    &&

                    (!payment ||
                        expense.payment_method
                        === payment)

                    &&

                    (!from ||
                        expense.spent_at
                        .slice(0,10)
                        >= from)

                    &&

                    (!to ||
                        expense.spent_at
                        .slice(0,10)
                        <= to)

                );

            }
        );


    $("expenseTable").innerHTML = `

        <table class="table">

            <thead>

                <tr>

                    <th>Date</th>

                    <th>Category</th>

                    <th>Reason</th>

                    <th>Payment</th>

                    <th>Amount</th>

                    <th>Action</th>

                </tr>

            </thead>

            <tbody>

                ${filtered.map(item => `

                    <tr>

                        <td>
                            ${item.spent_at}
                        </td>

                        <td>
                            ${item.category}
                        </td>

                        <td>
                            ${item.reason || "-"}
                        </td>

                        <td>
                            ${item.payment_method}
                        </td>

                        <td>
                            <strong>
                                ${money(item.amount)}
                            </strong>
                        </td>

                        <td>

                            <button
                            onclick="deleteExpense(${item.id})"
                            >
                                🗑️
                            </button>

                        </td>

                    </tr>

                `).join("")}

            </tbody>

        </table>

    `;

}


/* FILTER */

[
    "filterText",
    "fromDate",
    "toDate",
    "paymentFilter",
    "globalSearch"
]
.forEach(id => {

    $(id)?.addEventListener(
        "input",
        renderExpenses
    );

});


/* ---------------- ADD EXPENSE ---------------- */

function openExpense() {

    $("modalBody").innerHTML = `

        <h2>
            Add Expense
        </h2>

        <div class="form-grid">

            <label>

                Amount

                <input
                id="expenseAmount"
                type="number"
                step="0.01"
                >

            </label>


            <label>

                Category

                <select id="expenseCategory">

                    <option>Food</option>

                    <option>Transport</option>

                    <option>Shopping</option>

                    <option>Bills</option>

                    <option>Education</option>

                    <option>Health</option>

                    <option>Entertainment</option>

                    <option>Other</option>

                </select>

            </label>


            <label>

                Reason

                <input
                id="expenseReason"
                placeholder="Why did you spend?"
                >

            </label>


            <label>

                Payment Method

                <select id="expensePayment">

                    <option>Cash</option>

                    <option>UPI</option>

                    <option>Card</option>

                    <option>Bank Transfer</option>

                </select>

            </label>


            <label>

                Date & Time

                <input
                id="expenseDate"
                type="datetime-local"
                >

            </label>


            <label>

                Favorite

                <select id="expenseFavorite">

                    <option value="0">
                        No
                    </option>

                    <option value="1">
                        Yes
                    </option>

                </select>

            </label>


            <label class="full">

                Notes

                <textarea
                id="expenseNotes"
                ></textarea>

            </label>

        </div>


        <div class="form-actions">

            <button
            class="secondary"
            onclick="closeModal()"
            >
                Cancel
            </button>

            <button
            class="primary"
            onclick="saveExpense()"
            >
                Save Expense
            </button>

        </div>

    `;


    $("expenseDate").value =
        new Date()
        .toISOString()
        .slice(0,16);


    $("modal")
    .classList.add("show");

}


async function saveExpense() {

    const data = {

        amount:
            $("expenseAmount").value,

        category:
            $("expenseCategory").value,

        reason:
            $("expenseReason").value,

        payment_method:
            $("expensePayment").value,

        spent_at:
            $("expenseDate").value,

        favorite:
            $("expenseFavorite").value,

        notes:
            $("expenseNotes").value

    };


    if (!data.amount) {

        alert(
            "Please enter expense amount."
        );

        return;

    }


    await fetch(
        "/api/expenses",
        {

            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body:
                JSON.stringify(data)

        }
    );


    closeModal();

    await loadExpenses();

    await loadDashboard();

}


async function deleteExpense(id) {

    if (
        !confirm(
            "Move this expense to Trash?"
        )
    )
        return;


    await fetch(
        `/api/expenses/${id}`,
        {
            method: "DELETE"
        }
    );


    loadExpenses();

    loadDashboard();

}


/* ---------------- INCOME ---------------- */

function openIncome() {

    $("modalBody").innerHTML = `

        <h2>
            Add Income
        </h2>

        <div class="form-grid">

            <label>

                Amount

                <input
                id="incomeAmount"
                type="number"
                >

            </label>


            <label>

                Source

                <input
                id="incomeSource"
                placeholder="Salary / Freelance"
                >

            </label>


            <label>

                Date

                <input
                id="incomeDate"
                type="date"
                >

            </label>


            <label class="full">

                Notes

                <textarea
                id="incomeNotes"
                ></textarea>

            </label>

        </div>


        <div class="form-actions">

            <button
            class="primary"
            onclick="saveIncome()"
            >
                Save Income
            </button>

        </div>

    `;


    $("incomeDate").value =
        new Date()
        .toISOString()
        .slice(0,10);


    $("modal")
    .classList.add("show");

}


async function saveIncome() {

    await fetch(
        "/api/income",
        {

            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body:
                JSON.stringify({

                    amount:
                        $("incomeAmount").value,

                    source:
                        $("incomeSource").value,

                    received_at:
                        $("incomeDate").value,

                    notes:
                        $("incomeNotes").value

                })

        }
    );


    closeModal();

    loadIncome();

    loadDashboard();

}


async function loadIncome() {

    const data =
        await fetch(
            "/api/income"
        )
        .then(
            response =>
                response.json()
        );


    $("incomeTable").innerHTML = `

        <table class="table">

            <tr>

                <th>
                    Date
                </th>

                <th>
                    Source
                </th>

                <th>
                    Amount
                </th>

                <th>
                    Notes
                </th>

            </tr>


            ${data.map(item => `

                <tr>

                    <td>
                        ${item.received_at}
                    </td>

                    <td>
                        ${item.source}
                    </td>

                    <td>
                        ${money(item.amount)}
                    </td>

                    <td>
                        ${item.notes || "-"}
                    </td>

                </tr>

            `).join("")}

        </table>

    `;

}


/* ---------------- RECURRING ---------------- */

function openRecurring() {

    $("modalBody").innerHTML = `

        <h2>
            Add Recurring Expense
        </h2>

        <div class="form-grid">

            <label>

                Title

                <input id="recurringTitle">

            </label>


            <label>

                Amount

                <input
                id="recurringAmount"
                type="number"
                >

            </label>


            <label>

                Category

                <input
                id="recurringCategory"
                value="Bills"
                >

            </label>


            <label>

                Frequency

                <select id="recurringFrequency">

                    <option>
                        Monthly
                    </option>

                    <option>
                        Weekly
                    </option>

                    <option>
                        Yearly
                    </option>

                </select>

            </label>


            <label>

                Next Date

                <input
                id="recurringDate"
                type="date"
                >

            </label>

        </div>


        <div class="form-actions">

            <button
            class="primary"
            onclick="saveRecurring()"
            >
                Save
            </button>

        </div>

    `;


    $("modal")
    .classList.add("show");

}


async function saveRecurring() {

    await fetch(
        "/api/recurring",
        {

            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body:
                JSON.stringify({

                    title:
                        $("recurringTitle").value,

                    amount:
                        $("recurringAmount").value,

                    category:
                        $("recurringCategory").value,

                    frequency:
                        $("recurringFrequency").value,

                    next_date:
                        $("recurringDate").value

                })

        }
    );


    closeModal();

    loadRecurring();

}


async function loadRecurring() {

    const data =
        await fetch(
            "/api/recurring"
        )
        .then(
            response =>
                response.json()
        );


    $("recurringTable").innerHTML = `

        <table class="table">

            <tr>

                <th>
                    Title
                </th>

                <th>
                    Amount
                </th>

                <th>
                    Category
                </th>

                <th>
                    Frequency
                </th>

                <th>
                    Next Date
                </th>

            </tr>


            ${data.map(item => `

                <tr>

                    <td>
                        ${item.title}
                    </td>

                    <td>
                        ${money(item.amount)}
                    </td>

                    <td>
                        ${item.category}
                    </td>

                    <td>
                        ${item.frequency}
                    </td>

                    <td>
                        ${item.next_date}
                    </td>

                </tr>

            `).join("")}

        </table>

    `;

}


/* ---------------- ANALYTICS ---------------- */

async function loadAnalytics() {

    const data =
        await fetch(
            "/api/analytics"
        )
        .then(
            response =>
                response.json()
        );


    if (analyticsDaily)
        analyticsDaily.destroy();


    if (paymentChart)
        paymentChart.destroy();


    analyticsDaily =
        new Chart(
            $("analyticsDaily"),
            {

                type: "bar",

                data: {

                    labels:
                        data.daily.map(
                            x => x.day
                        ),

                    datasets: [

                        {

                            label:
                                "Daily Spending",

                            data:
                                data.daily.map(
                                    x => x.total
                                )

                        }

                    ]

                }

            }
        );


    paymentChart =
        new Chart(
            $("paymentChart"),
            {

                type: "doughnut",

                data: {

                    labels:
                        data.payment.map(
                            x =>
                                x.payment_method
                        ),

                    datasets: [

                        {

                            data:
                                data.payment.map(
                                    x =>
                                        x.total
                                )

                        }

                    ]

                }

            }
        );


    $("categoryRows").innerHTML =
        data.category
        .map(item => `

            <div class="transaction">

                <span>
                    ${item.category}
                </span>

                <strong>
                    ${money(item.total)}
                </strong>

            </div>

        `)
        .join("");

}


/* ---------------- AI ---------------- */

async function loadAI() {

    const data =
        await fetch(
            "/api/ai"
        )
        .then(
            response =>
                response.json()
        );


    $("tips").innerHTML =
        data.tips
        .map(
            tip =>
                `<div class="suggestion">
                    ✨ ${tip}
                </div>`
        )
        .join("");


    $("prediction").textContent =
        money(
            data.prediction
        );

}


/* ---------------- BUDGET ---------------- */

async function saveBudget() {

    const goal =
        $("goalInput").value || 0;


    await fetch(
        "/api/settings",
        {

            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body:
                JSON.stringify({

                    savings_goal:
                        goal,

                    currency:
                        "INR"

                })

        }
    );


    $("budgetMsg").textContent =
        "Savings goal saved successfully.";

}


/* ---------------- SETTINGS ---------------- */

async function saveSettings() {

    await fetch(
        "/api/settings",
        {

            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body:
                JSON.stringify({

                    currency:
                        $("currency").value

                })

        }
    );


    alert(
        "Settings saved successfully."
    );

}


/* ---------------- MODAL ---------------- */

function closeModal() {

    $("modal")
    .classList.remove(
        "show"
    );

}


/* ---------------- RESET ---------------- */

async function resetData() {

    if (
        !confirm(
            "Delete all expense, income and recurring data?"
        )
    )
        return;


    await fetch(
        "/api/reset",
        {
            method: "POST"
        }
    );


    location.reload();

}


/* ---------------- DARK MODE ---------------- */

$("themeBtn").onclick =
    () => {

        document.body
        .classList.toggle(
            "dark"
        );

    };


/* ---------------- CALCULATOR ---------------- */

const calculatorKeys = [

    "7", "8", "9", "÷",

    "4", "5", "6", "×",

    "1", "2", "3", "−",

    "0", ".", "=", "+"

];


$("calcKeys").innerHTML =
    calculatorKeys
    .map(
        key =>
            `<button
                onclick="calculate('${key}')">
                ${key}
            </button>`
    )
    .join("");


function calculate(key) {

    const input =
        $("calc");


    if (key === "=") {

        try {

            input.value =
                Function(
                    "return " +
                    input.value
                    .replaceAll(
                        "×",
                        "*"
                    )
                    .replaceAll(
                        "÷",
                        "/"
                    )
                    .replaceAll(
                        "−",
                        "-"
                    )
                )();

        }

        catch {

            input.value =
                "Error";

        }

    }

    else {

        input.value += key;

    }

}


/* ---------------- CLOCK ---------------- */

setInterval(
    () => {

        $("clock").textContent =
            new Date().toLocaleString(
                "en-IN",
                {
                    dateStyle: "full",
                    timeStyle: "short"
                }
            );

    },
    1000
);


/* ---------------- START ---------------- */

loadDashboard();

loadExpenses();