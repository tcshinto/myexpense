    document.addEventListener('DOMContentLoaded', () => {
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

      function safeLoad(key, fallback) {
        try {
          const parsed = JSON.parse(localStorage.getItem(key));
          return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallback;
        } catch (e) {
          return fallback;
        }
      }

      let expenses = (() => {
        try {
          const parsed = JSON.parse(localStorage.getItem(EXPENSE_KEY));
          return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          return [];
        }
      })();
      let categories = safeLoad(CATEGORY_KEY, [...DEFAULT_CATEGORIES]);
      let accounts = safeLoad(ACCOUNT_KEY, [...DEFAULT_ACCOUNTS]);
      let editingId = null;
      let inSettings = false;
      let activeFilter = 'month';

      // DOM Elements
      const listEl = document.getElementById('expenseList');
      const totalEl = document.getElementById('totalAmount');
      const totalLabelEl = document.getElementById('totalLabel');
      const form = document.getElementById('expenseForm');
      const formTitleEl = document.getElementById('formTitle');
      const submitBtn = document.getElementById('submitBtn');
      const cancelEditBtn = document.getElementById('cancelEditBtn');
      const amountInput = document.getElementById('amount');
      const categorySelect = document.getElementById('category');
      const accountSelect = document.getElementById('account');
      let amountCents = 0;

      const filterPills = document.querySelectorAll('.filter-pill');
      const dateRangeBox = document.getElementById('dateRangeBox');
      const filterFromInput = document.getElementById('filterFrom');
      const filterToInput = document.getElementById('filterTo');
      const filterCategorySelect = document.getElementById('filterCategory');
      const filterAccountSelect = document.getElementById('filterAccount');

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

      function toLocalDateStr(dateObj) {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }

      function formatAmount(cents) {
        const whole = String(Math.floor(cents / 100)).padStart(2, '0');
        const fraction = String(cents % 100).padStart(2, '0');
        return `${whole}.${fraction}`;
      }

      function setAmountCents(cents) {
        amountCents = Math.max(0, Math.min(99999999, Math.round(cents)));
        amountInput.value = formatAmount(amountCents);
      }

      amountInput.addEventListener('beforeinput', (e) => {
        if (e.data !== null) {
          e.preventDefault();
          const digits = e.data.replace(/\D/g, '');
          if (!digits) return;
          if (amountInput.selectionStart === 0 && amountInput.selectionEnd === amountInput.value.length) {
            amountCents = 0;
          }
          for (const digit of digits) {
            setAmountCents(amountCents * 10 + Number(digit));
          }
        } else if (e.inputType === 'deleteContentBackward') {
          e.preventDefault();
          setAmountCents(Math.floor(amountCents / 10));
        }
      });

      amountInput.addEventListener('paste', (e) => {
        e.preventDefault();
        const digits = (e.clipboardData?.getData('text') || '').replace(/\D/g, '');
        if (digits) setAmountCents(Number(digits));
      });

      amountInput.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
          e.preventDefault();
          setAmountCents(Math.floor(amountCents / 10));
        } else if (/^\d$/.test(e.key)) {
          e.preventDefault();
          setAmountCents(amountCents * 10 + Number(e.key));
        }
      });

      const today = new Date();
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      document.getElementById('date').value = toLocalDateStr(today);
      filterFromInput.value = toLocalDateStr(firstOfMonth);
      filterToInput.value = toLocalDateStr(today);

      // Filter Pills
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
      filterCategorySelect.addEventListener('change', renderExpenses);
      filterAccountSelect.addEventListener('change', renderExpenses);

      // Gear / Settings Toggle
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

      function renderDropdowns() {
        const currentCat = categorySelect.value;
        const currentAcc = accountSelect.value;
        const filterCat = filterCategorySelect.value;
        const filterAcc = filterAccountSelect.value;

        categorySelect.innerHTML = categories
          .map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
          .join('');

        accountSelect.innerHTML = accounts
          .map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`)
          .join('');

        filterCategorySelect.innerHTML = `<option value="">All Categories</option>` +
          categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
        filterAccountSelect.innerHTML = `<option value="">All Accounts</option>` +
          accounts.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');

        if (categories.includes(currentCat)) categorySelect.value = currentCat;
        if (accounts.includes(currentAcc)) accountSelect.value = currentAcc;
        if (categories.includes(filterCat)) filterCategorySelect.value = filterCat;
        if (accounts.includes(filterAcc)) filterAccountSelect.value = filterAcc;
      }

      function renderSettings() {
        document.getElementById('categorySettingsList').innerHTML = categories.map((cat, idx) => `
          <div class="list-item">
            <span>${escapeHtml(cat)}</span>
            <div class="item-actions">
              <button type="button" class="edit-btn" data-action="edit-opt" data-type="category" data-idx="${idx}">Edit</button>
              <button type="button" class="del-btn" data-action="del-opt" data-type="category" data-idx="${idx}">Delete</button>
            </div>
          </div>
        `).join('');

        document.getElementById('accountSettingsList').innerHTML = accounts.map((acc, idx) => `
          <div class="list-item">
            <span>${escapeHtml(acc)}</span>
            <div class="item-actions">
              <button type="button" class="edit-btn" data-action="edit-opt" data-type="account" data-idx="${idx}">Edit</button>
              <button type="button" class="del-btn" data-action="del-opt" data-type="account" data-idx="${idx}">Delete</button>
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

      // Event Delegation for Settings Edit/Delete
      settingsView.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const { action, type, idx } = btn.dataset;
        const index = Number(idx);
        const list = type === 'category' ? categories : accounts;

        if (action === 'edit-opt') {
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
        } else if (action === 'del-opt') {
          if (list.length <= 1) {
            alert(`You must keep at least one ${type}.`);
            return;
          }
          const value = list[index];
          if (!confirm(`Delete ${type} "${value}"?`)) return;
          list.splice(index, 1);
          saveOptions();
        }
      });

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

      function getFilteredExpenses() {
        const now = new Date();
        const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const monthName = now.toLocaleString('en-US', { month: 'long' });
        let filtered;

        if (activeFilter === 'month') {
          totalLabelEl.textContent = `Total Spent (${monthName})`;
          filtered = expenses.filter(exp => exp.date && exp.date.startsWith(currentYearMonth));
        } else if (activeFilter === 'range') {
          const from = filterFromInput.value;
          const to = filterToInput.value;
          totalLabelEl.textContent = 'Total Spent (Filtered Range)';
          filtered = expenses.filter(exp => {
            if (!exp.date) return false;
            if (from && exp.date < from) return false;
            if (to && exp.date > to) return false;
            return true;
          });
        } else {
          totalLabelEl.textContent = 'Total Spent (All Time)';
          filtered = expenses;
        }

        const selectedCategory = filterCategorySelect.value;
        const selectedAccount = filterAccountSelect.value;
        return filtered.filter(exp =>
          (!selectedCategory || exp.category === selectedCategory) &&
          (!selectedAccount || exp.account === selectedAccount)
        );
      }

      function renderExpenses() {
        const filtered = getFilteredExpenses();
        const total = filtered.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        totalEl.textContent = total.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

        if (filtered.length === 0) {
          listEl.innerHTML = `<p style="color:var(--subtext); text-align:center; margin:8px 0;">No expenses found for this period.</p>`;
          return;
        }

        listEl.innerHTML = [...filtered]
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .map(exp => `
            <div class="expense-row" data-id="${exp.id}">
              <div class="item-actions expense-actions">
                <button type="button" class="edit-btn" data-action="edit-exp" data-id="${exp.id}">Edit</button>
                <button type="button" class="del-btn" data-action="del-exp" data-id="${exp.id}">Delete</button>
              </div>
              <div class="list-item">
                <div>
                  <div class="tx-title">${escapeHtml(exp.title)}</div>
                  <div class="tx-meta">${escapeHtml(exp.category)} • ${escapeHtml(exp.account || accounts[0])} • ${exp.date}</div>
                </div>
                <div class="tx-right">
                  <strong>$${Number(exp.amount).toFixed(2)}</strong>
                </div>
              </div>
            </div>
          `).join('');
      }

      // Event Delegation for Expense Edit/Delete
      listEl.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) {
          const openRow = e.target.closest('.expense-row.open');
          if (openRow) openRow.classList.remove('open');
          return;
        }
        const { action, id } = btn.dataset;

        if (action === 'edit-exp') {
          const exp = expenses.find(item => item.id === id);
          if (!exp) return;

          editingId = id;
          document.getElementById('title').value = exp.title;
          setAmountCents(Math.round(Number(exp.amount) * 100));
          document.getElementById('date').value = exp.date;

          if (!categories.includes(exp.category)) {
            categorySelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(exp.category)}">${escapeHtml(exp.category)}</option>`);
          }
          if (exp.account && !accounts.includes(exp.account)) {
            accountSelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(exp.account)}">${escapeHtml(exp.account)}</option>`);
          }

          categorySelect.value = exp.category;
          accountSelect.value = exp.account || accounts[0];

          formTitleEl.textContent = 'Edit Expense';
          submitBtn.textContent = 'Update Expense';
          cancelEditBtn.style.display = 'inline-block';

          document.getElementById('formCard').scrollIntoView({ behavior: 'smooth' });
        } else if (action === 'del-exp') {
          const exp = expenses.find(item => item.id === id);
          if (!exp) return;
          if (!confirm(`Delete expense "${exp.title}"?`)) return;
          if (editingId === id) resetFormState();
          expenses = expenses.filter(item => item.id !== id);
          saveExpenses();
        }
      });

      let swipeStartX = 0;
      let swipeStartY = 0;
      let swipeRow = null;
      let swipeContent = null;
      let swipeDeltaX = 0;

      listEl.addEventListener('touchstart', (e) => {
        if (e.target.closest('.expense-actions')) return;
        swipeRow = e.target.closest('.expense-row');
        if (!swipeRow) return;

        swipeContent = swipeRow.querySelector('.list-item');
        swipeStartX = e.touches[0].clientX;
        swipeStartY = e.touches[0].clientY;
        swipeDeltaX = 0;

        listEl.querySelectorAll('.expense-row.open').forEach(row => {
          if (row !== swipeRow) row.classList.remove('open');
        });
      }, { passive: true });

      listEl.addEventListener('touchmove', (e) => {
        if (!swipeRow || !swipeContent) return;
        const deltaX = e.touches[0].clientX - swipeStartX;
        const deltaY = e.touches[0].clientY - swipeStartY;
        if (Math.abs(deltaY) > Math.abs(deltaX)) return;

        swipeDeltaX = deltaX;
        const isOpen = swipeRow.classList.contains('open');
        const baseOffset = isOpen ? -128 : 0;
        const offset = Math.max(-128, Math.min(0, baseOffset + deltaX));
        swipeContent.style.transform = `translateX(${offset}px)`;
        e.preventDefault();
      }, { passive: false });

      listEl.addEventListener('touchend', () => {
        if (!swipeRow || !swipeContent) return;
        const isOpen = swipeRow.classList.contains('open');
        const shouldOpen = isOpen ? swipeDeltaX <= 40 : swipeDeltaX < -40;

        swipeContent.style.transform = '';
        swipeRow.classList.toggle('open', shouldOpen);
        swipeRow = null;
        swipeContent = null;
        swipeDeltaX = 0;
      });

      listEl.addEventListener('touchcancel', () => {
        if (swipeContent) swipeContent.style.transform = '';
        swipeRow = null;
        swipeContent = null;
        swipeDeltaX = 0;
      });

      function saveExpenses() {
        localStorage.setItem(EXPENSE_KEY, JSON.stringify(expenses));
        renderExpenses();
      }

      function resetFormState() {
        editingId = null;
        form.reset();
        setAmountCents(0);
        document.getElementById('date').value = toLocalDateStr(new Date());
        formTitleEl.textContent = 'Add Expense';
        submitBtn.textContent = 'Add Expense';
        cancelEditBtn.style.display = 'none';
      }

      cancelEditBtn.addEventListener('click', resetFormState);

      form.addEventListener('submit', (e) => {
        e.preventDefault();

        if (amountCents <= 0) {
          alert('Enter an amount.');
          amountInput.focus();
          return;
        }

        const expenseData = {
          title: document.getElementById('title').value.trim(),
          amount: amountCents / 100,
          category: categorySelect.value,
          account: accountSelect.value,
          date: document.getElementById('date').value
        };

        if (editingId) {
          expenses = expenses.map(exp => exp.id === editingId ? { ...exp, ...expenseData } : exp);
        } else {
          expenses.push({
            id: Date.now().toString(),
            ...expenseData
          });
        }

        saveExpenses();
        resetFormState();
      });

      // Only register Service Worker on http/https
      if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      }

      // Initial Render
      renderDropdowns();
      renderSettings();
      renderExpenses();
    });