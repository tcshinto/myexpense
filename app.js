const EXPENSE_KEY = 'ios_pwa_expenses';
const CATEGORY_KEY = 'ios_pwa_categories';
const ACCOUNT_KEY = 'ios_pwa_accounts';

const DEFAULT_CATEGORIES = [
  '🍔 Food & Dining',
  '🚗 Transportation',
  '⚡ Utilities',
  '🛍️ Shopping',
  '🏷️ Other'
];

const DEFAULT_ACCOUNTS = [
  '💳 Credit Card',
  '🏦 Debit Card',
  '💵 Cash',
  '📱 Apple Pay',
  '🔄 Bank Transfer'
];

let expenses = JSON.parse(localStorage.getItem(EXPENSE_KEY)) || [];
let categories = JSON.parse(localStorage.getItem(CATEGORY_KEY)) || [...DEFAULT_CATEGORIES];
let accounts = JSON.parse(localStorage.getItem(ACCOUNT_KEY)) || [...DEFAULT_ACCOUNTS];
let editingId = null;
let inSettings = false;
let activeFilter = 'month'; // 'month' | 'range' | 'all'

// DOM Elements
const listEl = document.getElementById('expenseList');
const totalEl = document.getElementById('totalAmount');
const totalLabelEl = document.getElementById('totalLabel');
const form = document.getElementById('expenseForm');
const formTitleEl = document.getElementById('formTitle');
const submitBtn = document.getElementById('submitBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const categorySelect = document.getElementById('category');
const accountSelect = document.getElementById('account');

const filterPills = document.querySelectorAll('.filter-pill');
const dateRangeBox = document.getElementById('dateRangeBox');
const filterFromInput = document.getElementById('filterFrom');
const filterToInput = document.getElementById('filterTo');

const settingsToggleBtn = document.getElementById('settingsToggleBtn');
const expensesView = document.getElementById('expensesView');
const settingsView = document.getElementById('settingsView');
const pageHeader = document.getElementById('pageHeader');

const GEAR_ICON_SVG = `
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
`;

// Helper for local YYYY-MM-DD formatting
function toLocalDateStr(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Initialize dates (Today + 1st of current month for Date Range defaults)
const today = new Date();
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
document.getElementById('date').value = toLocalDateStr(today);
filterFromInput.value = toLocalDateStr(firstOfMonth);
filterToInput.value = toLocalDateStr(today);

// Filter Pill Listeners
filterPills.forEach(pill => {
  pill.addEventListener('click', () => {
    activeFilter = pill.dataset.filter;
    filterPills.forEach(p => p.classList.toggle('active', p === pill));
    dateRangeBox.style.display = activeFilter === 'range' ? 'grid' : 'none';
    renderExpenses();
  });
});

filterFromInput.addEventListener('change', renderExpenses);
filterToInput.addEventListener('change', renderExpenses);

// Toggle Settings View
settingsToggleBtn.addEventListener('click', () => {
  inSettings = !inSettings;
  expensesView.style.display = inSettings ? 'none' : 'block';
  settingsView.style.display = inSettings ? 'block' : 'none';
  pageHeader.textContent = inSettings ? 'Settings' : 'Expenses';

  if (inSettings) {
    settingsToggleBtn.className = 'done-btn';
    settingsToggleBtn.textContent = 'Done';
    settingsToggleBtn.setAttribute('aria-label', 'Done');
  } else {
    settingsToggleBtn.className = 'icon-btn';
    settingsToggleBtn.innerHTML = GEAR_ICON_SVG;
    settingsToggleBtn.setAttribute('aria-label', 'Settings');
  }
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Populate Home Form Dropdowns
function renderDropdowns() {
  const currentCat = categorySelect.value;
  const currentAcc = accountSelect.value;

  categorySelect.innerHTML = categories
    .map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
    .join('');

  accountSelect.innerHTML = accounts
    .map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`)
    .join('');

  if (categories.includes(currentCat)) categorySelect.value = currentCat;
  if (accounts.includes(currentAcc)) accountSelect.value = currentAcc;
}

// Render Settings Lists
function renderSettings() {
  document.getElementById('categorySettingsList').innerHTML = categories.map((cat, idx) => `
    <div class="list-item">
      <span>${escapeHtml(cat)}</span>
      <div class="item-actions">
        <button type="button" class="edit-btn" onclick="editOption('category', ${idx})">Edit</button>
        <button type="button" class="del-btn" onclick="deleteOption('category', ${idx})">Delete</button>
      </div>
    </div>
  `).join('');

  document.getElementById('accountSettingsList').innerHTML = accounts.map((acc, idx) => `
    <div class="list-item">
      <span>${escapeHtml(acc)}</span>
      <div class="item-actions">
        <button type="button" class="edit-btn" onclick="editOption('account', ${idx})">Edit</button>
        <button type="button" class="del-btn" onclick="deleteOption('account', ${idx})">Delete</button>
      </div>
    </div>
  `).join('');
}

function saveOptions() {
  localStorage.setItem(CATEGORY_KEY, JSON.stringify(categories));
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts));
  renderDropdowns();
  renderSettings();
}

// Add Category
document.getElementById('addCategoryForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('newCategoryInput');
  const val = input.value.trim();
  if (val && !categories.includes(val)) {
    categories.push(val);
    saveOptions();
  }
  input.value = '';
});

// Add Account
document.getElementById('addAccountForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('newAccountInput');
  const val = input.value.trim();
  if (val && !accounts.includes(val)) {
    accounts.push(val);
    saveOptions();
  }
  input.value = '';
});

// Edit Category / Account
window.editOption = (type, index) => {
  const list = type === 'category' ? categories : accounts;
  const oldVal = list[index];
  const updated = prompt(`Edit ${type}:`, oldVal);

  if (updated !== null && updated.trim() !== '' && updated.trim() !== oldVal) {
    const newVal = updated.trim();
    list[index] = newVal;

    expenses = expenses.map(exp => {
      if (type === 'category' && exp.category === oldVal) return { ...exp, category: newVal };
      if (type === 'account' && exp.account === oldVal) return { ...exp, account: newVal };
      return exp;
    });

    saveOptions();
    saveExpenses();
  }
};

// Delete Category / Account
window.deleteOption = (type, index) => {
  const list = type === 'category' ? categories : accounts;
  if (list.length <= 1) {
    alert(`You must keep at least one ${type}.`);
    return;
  }
  const value = list[index];
  if (!confirm(`Delete ${type} "${value}"?`)) return;
  list.splice(index, 1);
  saveOptions();
};

// Get Filtered Expenses
function getFilteredExpenses() {
  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  if (activeFilter === 'month') {
    totalLabelEl.textContent = 'Total Spent (Current Month)';
    return expenses.filter(exp => exp.date && exp.date.startsWith(currentYearMonth));
  }

  if (activeFilter === 'range') {
    const from = filterFromInput.value;
    const to = filterToInput.value;
    totalLabelEl.textContent = 'Total Spent (Filtered Range)';
    return expenses.filter(exp => {
      if (!exp.date) return false;
      if (from && exp.date < from) return false;
      if (to && exp.date > to) return false;
      return true;
    });
  }

  totalLabelEl.textContent = 'Total Spent (All Time)';
  return expenses;
}

// Render Expenses
function renderExpenses() {
  const filtered = getFilteredExpenses();
  const total = filtered.reduce((sum, item) => sum + item.amount, 0);
  totalEl.textContent = total.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  if (filtered.length === 0) {
    listEl.innerHTML = `<p style="color:var(--subtext); text-align:center; margin:8px 0;">No expenses found for this period.</p>`;
    return;
  }

  listEl.innerHTML = [...filtered]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(exp => `
      <div class="list-item">
        <div>
          <div class="tx-title">${escapeHtml(exp.title)}</div>
          <div class="tx-meta">${escapeHtml(exp.category)} • ${escapeHtml(exp.account || accounts)} • ${exp.date}</div>
        </div>
        <div class="tx-right">
          <strong>$${exp.amount.toFixed(2)}</strong>
          <div class="item-actions">
            <button type="button" class="edit-btn" onclick="editExpense('${exp.id}')">Edit</button>
            <button type="button" class="del-btn" onclick="deleteExpense('${exp.id}')">Delete</button>
          </div>
        </div>
      </div>
    `).join('');
}

function saveExpenses() {
  localStorage.setItem(EXPENSE_KEY, JSON.stringify(expenses));
  renderExpenses();
}

function resetFormState() {
  editingId = null;
