/* Pennywise - one script shared by all four pages.
   Each page has <body data-page="..."> so we know which init function to run (bottom of file). */

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/* ---------- Sample data (used only the first time) ---------- */

// Shortcut to build one transaction object
function tx(id, description, amount, date, type, category, method) {
  return { id: id, description: description, amount: amount, date: date, type: type, category: category, method: method };
}

const sampleData = {
  categories: ["Food", "Transport", "Education", "Shopping", "Entertainment", "Accommodation", "Other"],
  transactions: [
    tx(1, "Pocket money", 8000, "2026-10-01", "Income", "Income", "Bank Transfer"),
    tx(2, "Freelance income", 2000, "2026-10-26", "Income", "Income", "Bank Transfer"),
    tx(3, "Bus pass", 700, "2026-10-02", "Expense", "Transport", "Cash"),
    tx(4, "Cab to railway station", 400, "2026-10-18", "Expense", "Transport", "UPI"),
    tx(5, "Monthly groceries", 1200, "2026-10-05", "Expense", "Food", "UPI"),
    tx(6, "Dinner with roommates", 910, "2026-10-12", "Expense", "Food", "UPI"),
    tx(7, "Coffee with friends", 260, "2026-10-24", "Expense", "Food", "UPI"),
    tx(8, "College canteen", 80, "2026-10-27", "Expense", "Food", "UPI"),
    tx(9, "Textbooks", 1255, "2026-10-08", "Expense", "Education", "Card"),
    tx(10, "Online course", 500, "2026-10-14", "Expense", "Education", "UPI"),
    tx(11, "Printing and stationery", 145, "2026-10-25", "Expense", "Education", "Cash"),
    tx(12, "T-shirt", 900, "2026-10-15", "Expense", "Shopping", "Card"),
    tx(13, "Movie tickets", 450, "2026-10-22", "Expense", "Entertainment", "UPI"),
    tx(14, "Music subscription", 150, "2026-10-10", "Expense", "Entertainment", "UPI"),
    tx(15, "Phone recharge", 300, "2026-10-06", "Expense", "Other", "UPI"),
    tx(16, "Haircut", 200, "2026-10-20", "Expense", "Other", "Cash")
  ],
  budget: {
    monthly: 12000,
    limits: { Food: 3000, Transport: 1500, Education: 2500, Shopping: 1500, Entertainment: 1000, Accommodation: 0, Other: 2500 }
  },
  goals: [
    { id: 1, name: "New laptop", target: 40000, saved: 1500, date: "2027-03-31" },
    { id: 2, name: "Emergency fund", target: 10000, saved: 500, date: "2027-01-31" }
  ]
};

/* ---------- Colors (the CSS variables from style.css) ---------- */
const categoryColors = {
  Food: "var(--c-food)", Transport: "var(--c-transport)", Education: "var(--c-education)",
  Shopping: "var(--c-shopping)", Entertainment: "var(--c-entertainment)", Other: "var(--c-other)",
  Accommodation: "var(--violet)", Income: "var(--teal)"
};
const goalColors = ["var(--blue)", "var(--violet)", "var(--gold)", "var(--rose)", "var(--teal)"];

// Color for a category. Categories you add yourself get gold.
function colorOf(category) {
  return categoryColors[category] || "var(--gold)";
}

/* ---------- Saving and loading (LocalStorage) ---------- */

// Everything lives in one object, saved under one key.
let data = JSON.parse(localStorage.getItem("pennywise")) || sampleData;

function saveData() {
  localStorage.setItem("pennywise", JSON.stringify(data));
}

/* ---------- Small helpers ---------- */

function byId(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  byId(id).textContent = text;
}

// 12000 -> ₹12,000 (negative numbers get a minus sign)
function money(n) {
  return (n < 0 ? "−" : "") + "₹" + Math.abs(n).toLocaleString("en-IN");
}

// "2026-10-27" -> "27 Oct"
function niceDate(iso) {
  const parts = iso.split("-");
  return Number(parts[2]) + " " + monthNames[parts[1] - 1].slice(0, 3);
}

// "2026-10" -> "October 2026"
function monthLabel(ym) {
  const parts = ym.split("-");
  return monthNames[parts[1] - 1] + " " + parts[0];
}

// Makes typed text safe to put inside HTML
function safe(text) {
  const box = document.createElement("div");
  box.textContent = text;
  return box.innerHTML.replace(/"/g, "&quot;");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Find the item with this id in a list (transactions or goals)
function findById(list, id) {
  for (const item of list) {
    if (item.id == id) return item;
  }
}

// Transactions sorted newest first
function sortedTransactions() {
  const copy = data.transactions.slice();
  copy.sort(function (a, b) {
    return b.date.localeCompare(a.date);
  });
  return copy;
}

/* ---------- Month selection (Dashboard and Budget) ---------- */

// Months that have transactions, newest first, like ["2026-10", "2026-09"]
function getMonths() {
  const list = [];
  for (const t of data.transactions) {
    const month = t.date.slice(0, 7);
    if (!list.includes(month)) list.push(month);
  }
  return list.sort().reverse();
}

// The month the user picked, or the latest month that has data
function selectedMonth() {
  const months = getMonths();
  const saved = localStorage.getItem("pw_month");
  if (months.includes(saved)) return saved;
  return months[0] || today().slice(0, 7);
}

function showMonthInHeader() {
  setText("headerMonth", monthLabel(selectedMonth()));
}

// Fill the month dropdown; call redraw() when the user picks another month
function setupMonthSelect(redraw) {
  const select = byId("month");
  let months = getMonths();
  if (months.length === 0) months = [selectedMonth()];
  let html = "";
  for (const m of months) {
    html += `<option value="${m}">${monthLabel(m)}</option>`;
  }
  select.innerHTML = html;
  select.value = selectedMonth();
  select.addEventListener("change", function () {
    localStorage.setItem("pw_month", select.value);
    redraw();
  });
}

/* ---------- Calculations (always from real transactions) ---------- */

// Income, expenses and spending per category for one month
function monthTotals(month) {
  const totals = { income: 0, expense: 0, byCat: {} };
  for (const t of data.transactions) {
    if (t.date.slice(0, 7) !== month) continue;
    if (t.type === "Income") {
      totals.income += t.amount;
    } else {
      totals.expense += t.amount;
      totals.byCat[t.category] = (totals.byCat[t.category] || 0) + t.amount;
    }
  }
  return totals;
}

// Total of all "Income" or all "Expense" transactions, any month
function totalOf(type) {
  let sum = 0;
  for (const t of data.transactions) {
    if (t.type === type) sum += t.amount;
  }
  return sum;
}

function totalSaved() {
  let sum = 0;
  for (const g of data.goals) sum += g.saved;
  return sum;
}

/* ---------- Shared HTML pieces ---------- */

// A label + progress bar in the given color.
// The amount text turns orange at 80% of the limit and rose when the limit is reached.
function barHtml(label, spent, limit, color) {
  let status = "";
  if (limit > 0 && spent >= limit) status = "over";
  else if (limit > 0 && spent >= limit * 0.8) status = "warn";
  const amount = limit > 0 ? money(spent) + " of " + money(limit) : money(spent) + " (no limit)";
  return `<div>
    <p class="row ${status}"><span>${safe(label)}</span><span>${amount}</span></p>
    <progress style="--bar:${color}" value="${limit > 0 ? spent : 0}" max="${limit > 0 ? limit : 1}" aria-label="${safe(label)}"></progress>
  </div>`;
}

// Category badge with a dot in the category color
function badge(category) {
  return `<span class="badge" style="--dot:${colorOf(category)}">${safe(category)}</span>`;
}

// Amount cell: green +₹ for income, −₹ for expenses
function amountCell(t) {
  if (t.type === "Income") return `<td class="amount income">+${money(t.amount)}</td>`;
  return `<td class="amount">−${money(t.amount)}</td>`;
}

/* ==========================================================
   DASHBOARD PAGE
   ========================================================== */
function renderDashboard() {
  const t = monthTotals(selectedMonth());
  showMonthInHeader();
  setText("balance", money(totalOf("Income") - totalOf("Expense")));
  setText("income", money(t.income));
  setText("expenses", money(t.expense));
  setText("budgetTotal", money(data.budget.monthly));
  setText("remaining", money(data.budget.monthly - t.expense));
  setText("savings", money(totalSaved()));

  // Spending by category
  let bars = "";
  for (const c of data.categories) {
    bars += barHtml(c, t.byCat[c] || 0, data.budget.limits[c] || 0, colorOf(c));
  }
  byId("categoryBars").innerHTML = bars;

  // Five most recent transactions
  let rows = "";
  for (const x of sortedTransactions().slice(0, 5)) {
    rows += `<tr><td>${niceDate(x.date)}</td><td>${safe(x.description)}</td><td>${badge(x.category)}</td><td>${x.method}</td>${amountCell(x)}</tr>`;
  }
  byId("recentBody").innerHTML = rows || `<tr><td class="empty">No transactions yet. Add your first one!</td></tr>`;
}

function initDashboard() {
  setupMonthSelect(renderDashboard);
  renderDashboard();
}

/* ==========================================================
   TRANSACTIONS PAGE
   ========================================================== */

// Fill a <select> with the categories (plus "Income"). extraFirst adds an "All" option on top.
function fillCategorySelect(select, extraFirst) {
  let html = extraFirst ? `<option value="All">${extraFirst}</option>` : "";
  for (const c of data.categories.concat("Income")) {
    html += `<option>${safe(c)}</option>`;
  }
  select.innerHTML = html;
}

// Refresh every place that lists categories: form, filter and the chips
function refreshCategories() {
  const filter = byId("filterCategory");
  const chosen = filter.value || "All";
  fillCategorySelect(byId("txCategory"));
  fillCategorySelect(filter, "All categories");
  filter.value = chosen;
  if (filter.value === "") filter.value = "All";

  let chips = "";
  for (const c of data.categories) {
    chips += `<span class="chip">${safe(c)}<button type="button" data-category="${safe(c)}" aria-label="Remove ${safe(c)}">×</button></span>`;
  }
  byId("categoryList").innerHTML = chips;
}

// Income always uses the "Income" category; expenses need a spending category
function syncCategoryWithType() {
  const category = byId("txCategory");
  if (byId("txType").value === "Income") category.value = "Income";
  else if (category.value === "Income") category.value = data.categories[0];
}

// Clear the form and go back to "add" mode
function resetTransactionForm() {
  byId("txForm").reset();
  byId("txId").value = "";
  byId("txDate").value = today();
  byId("formTitle").textContent = "Add transaction";
  byId("txSubmit").textContent = "Add transaction";
  syncCategoryWithType();
}

// Draw the table using the search box and the two filters
function renderTransactions() {
  const search = byId("search").value.toLowerCase();
  const category = byId("filterCategory").value;
  const type = byId("filterType").value;
  let rows = "";
  for (const t of sortedTransactions()) {
    const text = (t.description + " " + t.category + " " + t.method).toLowerCase();
    if (!text.includes(search)) continue;
    if (category !== "All" && t.category !== category) continue;
    if (type !== "All" && t.type !== type) continue;
    rows += `<tr>
      <td>${niceDate(t.date)}</td><td>${safe(t.description)}</td><td>${badge(t.category)}</td><td>${t.method}</td>${amountCell(t)}
      <td><div class="cell-actions">
        <button type="button" class="btn secondary small" data-action="edit" data-id="${t.id}">Edit</button>
        <button type="button" class="btn danger small" data-action="delete" data-id="${t.id}">Delete</button>
      </div></td>
    </tr>`;
  }
  byId("txBody").innerHTML = rows || `<tr><td colspan="6" class="empty">No transactions match your search.</td></tr>`;
}

// Add a new transaction or save changes to an existing one
function saveTransaction(event) {
  event.preventDefault();
  const id = byId("txId").value;
  const t = {
    id: id ? Number(id) : Date.now(),
    description: byId("txDescription").value.trim(),
    amount: Number(byId("txAmount").value),
    date: byId("txDate").value,
    type: byId("txType").value,
    category: byId("txCategory").value,
    method: byId("txMethod").value
  };
  if (t.description === "" || t.amount <= 0) {
    alert("Please enter a description and an amount greater than 0.");
    return;
  }
  if (t.type === "Expense" && t.category === "Income") {
    alert("Please choose a spending category for an expense.");
    return;
  }
  if (id) {
    const old = findById(data.transactions, id);
    data.transactions[data.transactions.indexOf(old)] = t;
  } else {
    data.transactions.push(t);
  }
  saveData();
  resetTransactionForm();
  renderTransactions();
}

// Edit and Delete buttons in the table
function handleTransactionClick(event) {
  const action = event.target.dataset.action;
  const t = findById(data.transactions, event.target.dataset.id);
  if (!t) return;

  if (action === "delete" && confirm("Delete this transaction?")) {
    data.transactions.splice(data.transactions.indexOf(t), 1);
    saveData();
    renderTransactions();
  }
  if (action === "edit") {
    byId("txId").value = t.id;
    byId("txDescription").value = t.description;
    byId("txAmount").value = t.amount;
    byId("txDate").value = t.date;
    byId("txType").value = t.type;
    byId("txCategory").value = t.category;
    byId("txMethod").value = t.method;
    byId("formTitle").textContent = "Edit transaction";
    byId("txSubmit").textContent = "Save changes";
    byId("add").scrollIntoView();
  }
}

// Add a new category
function addCategory(event) {
  event.preventDefault();
  const name = byId("newCategory").value.trim();
  let exists = name.toLowerCase() === "income";
  for (const c of data.categories) {
    if (c.toLowerCase() === name.toLowerCase()) exists = true;
  }
  if (exists) {
    alert("That category already exists.");
    return;
  }
  data.categories.push(name);
  saveData();
  byId("newCategory").value = "";
  refreshCategories();
}

// Remove a category (not allowed while a transaction uses it)
function removeCategory(event) {
  const name = event.target.dataset.category;
  if (!name) return;
  for (const t of data.transactions) {
    if (t.category === name) {
      alert("You can't remove \"" + name + "\" because transactions use it. Edit or delete them first.");
      return;
    }
  }
  data.categories.splice(data.categories.indexOf(name), 1);
  delete data.budget.limits[name];
  saveData();
  refreshCategories();
}

function initTransactions() {
  showMonthInHeader();
  refreshCategories();
  resetTransactionForm();

  // The dashboard buttons link here with ?type=Income or ?type=Expense
  const wanted = new URLSearchParams(window.location.search).get("type");
  if (wanted === "Income" || wanted === "Expense") {
    byId("txType").value = wanted;
    syncCategoryWithType();
  }

  byId("txForm").addEventListener("submit", saveTransaction);
  byId("txCancel").addEventListener("click", resetTransactionForm);
  byId("txType").addEventListener("change", syncCategoryWithType);
  byId("txBody").addEventListener("click", handleTransactionClick);
  byId("search").addEventListener("input", renderTransactions);
  byId("filterCategory").addEventListener("change", renderTransactions);
  byId("filterType").addEventListener("change", renderTransactions);
  byId("categoryForm").addEventListener("submit", addCategory);
  byId("categoryList").addEventListener("click", removeCategory);
  renderTransactions();
}

/* ==========================================================
   BUDGET PAGE
   ========================================================== */

// Draw budget numbers, progress bars and the warning message
function renderBudget() {
  const t = monthTotals(selectedMonth());
  const budget = data.budget;
  showMonthInHeader();
  setText("totalBudget", money(budget.monthly));
  setText("totalSpent", money(t.expense));
  setText("remaining", money(budget.monthly - t.expense));
  byId("monthlyBudget").value = budget.monthly;
  byId("overallBar").innerHTML = barHtml("Overall budget", t.expense, budget.monthly, "var(--teal)");

  // One bar per category; remember which ones reached their limit
  let bars = "";
  const reached = [];
  for (const c of data.categories) {
    const spent = t.byCat[c] || 0;
    const limit = budget.limits[c] || 0;
    bars += barHtml(c, spent, limit, colorOf(c));
    if (limit > 0 && spent >= limit) reached.push(c);
  }
  byId("budgetBars").innerHTML = bars;

  // Warning banner
  const used = budget.monthly > 0 ? t.expense / budget.monthly : 0;
  const box = byId("budgetAlert");
  let message = "";
  box.className = "alert";
  if (used > 1) {
    message = "You have exceeded your monthly budget by " + money(t.expense - budget.monthly) + ".";
    box.className = "alert danger";
  } else if (used === 1) {
    message = "You have used your entire monthly budget.";
    box.className = "alert danger";
  } else if (used >= 0.8) {
    message = "Careful: you have used " + Math.round(used * 100) + "% of your monthly budget.";
  }
  if (reached.length > 0) message += " Category limit reached: " + reached.join(", ") + ".";
  box.textContent = message.trim();
  box.hidden = message.trim() === "";
}

// One number input for each category limit
function renderLimitFields() {
  let html = "";
  for (let i = 0; i < data.categories.length; i++) {
    const c = data.categories[i];
    html += `<div class="field"><label for="limit-${i}">${safe(c)} (₹)</label>
      <input id="limit-${i}" type="number" min="0" value="${data.budget.limits[c] || 0}"></div>`;
  }
  byId("limitFields").innerHTML = html;
}

function initBudget() {
  setupMonthSelect(renderBudget);
  renderLimitFields();
  renderBudget();

  byId("budgetForm").addEventListener("submit", function (event) {
    event.preventDefault();
    data.budget.monthly = Number(byId("monthlyBudget").value);
    saveData();
    renderBudget();
  });

  byId("limitForm").addEventListener("submit", function (event) {
    event.preventDefault();
    for (let i = 0; i < data.categories.length; i++) {
      data.budget.limits[data.categories[i]] = Number(byId("limit-" + i).value);
    }
    saveData();
    renderBudget();
  });
}

/* ==========================================================
   SAVINGS GOALS PAGE
   ========================================================== */

// Clear the goal form and go back to "add" mode
function resetGoalForm() {
  byId("goalForm").reset();
  byId("goalId").value = "";
  byId("goalFormTitle").textContent = "Add a savings goal";
  byId("goalSubmit").textContent = "Add goal";
}

// One card per goal, each with its own bar color
function renderGoals() {
  let html = "";
  for (let i = 0; i < data.goals.length; i++) {
    const g = data.goals[i];
    const left = Math.max(g.target - g.saved, 0);
    const percent = Math.min(Math.round((g.saved / g.target) * 100), 100);
    html += `<article class="panel">
      <h2>${safe(g.name)}</h2>
      <p class="muted">Target date: ${niceDate(g.date)} ${g.date.slice(0, 4)}</p>
      <p class="row"><span>${money(g.saved)} of ${money(g.target)}</span><span>${percent}%</span></p>
      <progress style="--bar:${goalColors[i % goalColors.length]}" value="${Math.min(g.saved, g.target)}" max="${g.target}" aria-label="${safe(g.name)}"></progress>
      <p class="${left === 0 ? "income" : ""}">${left === 0 ? "Goal achieved!" : money(left) + " more to reach this goal"}</p>
      <div class="inline-form">
        <input type="number" min="1" placeholder="Amount (₹)" aria-label="Amount to add to ${safe(g.name)}">
        <button type="button" class="btn small" data-action="add" data-id="${g.id}">Add money</button>
      </div>
      <div class="goal-actions">
        <button type="button" class="btn secondary small" data-action="edit" data-id="${g.id}">Edit</button>
        <button type="button" class="btn danger small" data-action="delete" data-id="${g.id}">Delete</button>
      </div>
    </article>`;
  }
  byId("goalList").innerHTML = html || `<p class="empty">No savings goals yet. Add one above to get started.</p>`;
}

// Add a new goal or save changes to an existing one
function saveGoal(event) {
  event.preventDefault();
  const id = byId("goalId").value;
  const g = {
    id: id ? Number(id) : Date.now(),
    name: byId("goalName").value.trim(),
    target: Number(byId("goalTarget").value),
    saved: Number(byId("goalSaved").value),
    date: byId("goalDate").value
  };
  if (g.name === "" || g.target <= 0 || g.saved < 0) {
    alert("Please enter a goal name, a target above 0 and a saved amount of 0 or more.");
    return;
  }
  if (id) {
    const old = findById(data.goals, id);
    data.goals[data.goals.indexOf(old)] = g;
  } else {
    data.goals.push(g);
  }
  saveData();
  resetGoalForm();
  renderGoals();
}

// Add money, Edit and Delete buttons on the goal cards
function handleGoalClick(event) {
  const button = event.target;
  const g = findById(data.goals, button.dataset.id);
  if (!g) return;

  if (button.dataset.action === "add") {
    const amount = Number(button.parentElement.querySelector("input").value);
    if (amount <= 0) {
      alert("Please enter an amount greater than 0.");
      return;
    }
    g.saved += amount;
    saveData();
    renderGoals();
  }
  if (button.dataset.action === "edit") {
    byId("goalId").value = g.id;
    byId("goalName").value = g.name;
    byId("goalTarget").value = g.target;
    byId("goalSaved").value = g.saved;
    byId("goalDate").value = g.date;
    byId("goalFormTitle").textContent = "Edit savings goal";
    byId("goalSubmit").textContent = "Save changes";
    byId("goalForm").scrollIntoView();
  }
  if (button.dataset.action === "delete" && confirm("Delete the goal \"" + g.name + "\"?")) {
    data.goals.splice(data.goals.indexOf(g), 1);
    saveData();
    renderGoals();
  }
}

function initSavings() {
  showMonthInHeader();
  byId("goalForm").addEventListener("submit", saveGoal);
  byId("goalCancel").addEventListener("click", resetGoalForm);
  byId("goalList").addEventListener("click", handleGoalClick);
  renderGoals();
}

/* ---------- Start the right code for the current page ---------- */
const page = document.body.dataset.page;
if (page === "dashboard") initDashboard();
if (page === "transactions") initTransactions();
if (page === "budget") initBudget();
if (page === "savings") initSavings();
