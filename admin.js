/* Admin.js – simple admin console using localStorage.
   NOTE: This demo is intentionally lightweight and not secure.
   For personal use, adjust as needed. */

const PASSWORD = 'weeklybuilds'; // simple password for the demo

function loadWeeks() {
  // Load from localStorage or fallback to default data
  const stored = localStorage.getItem('weeks');
  return stored ? JSON.parse(stored) : window.weeks;
}

function saveWeeks(weeks) {
  localStorage.setItem('weeks', JSON.stringify(weeks));
}

function renderWeeksTable() {
  const weeks = loadWeeks();
  const tbody = document.querySelector('#weeks-table tbody');
  tbody.innerHTML = '';

  weeks.forEach((week, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${week.title}</td>
      <td>${week.startDate}</td>
      <td><span class="status ${week.status}">${week.status.replace('_',' ')}</span></td>
      <td>
        <button class="button small" data-index="${index}" data-action="edit">Edit</button>
        <button class="button small secondary" data-index="${index}" data-action="delete">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function handleWeekFormSubmit(e) {
  e.preventDefault();
  const weeks = loadWeeks();
  const idField = document.getElementById('week-id-input');
  const title = document.getElementById('week-title-input').value.trim();
  const start = document.getElementById('week-start-input').value;
  const status = document.getElementById('week-status-input').value;

  if (idField.value) {
    // edit existing
    const idx = parseInt(idField.value, 10);
    weeks[idx].title = title;
    weeks[idx].startDate = start;
    weeks[idx].status = status;
  } else {
    // new entry
    weeks.push({
      id: `week-${weeks.length.toString().padStart(2, '0')}`,
      title,
      startDate: start,
      status,
      summary: '',
      days: Array.from({ length: 7 }).map((_, i) => ({
        date: new Date(start).toISOString().split('T')[0],
        notes: ''
      }))
    });
  }
  saveWeeks(weeks);
  renderWeeksTable();
  e.target.reset();
}

function handleTableClick(e) {
  const action = e.target.dataset.action;
  const index = parseInt(e.target.dataset.index, 10);
  if (action === 'edit') {
    const weeks = loadWeeks();
    const week = weeks[index];
    document.getElementById('week-id-input').value = index;
    document.getElementById('week-title-input').value = week.title;
    document.getElementById('week-start-input').value = week.startDate;
    document.getElementById('week-status-input').value = week.status;
  } else if (action === 'delete') {
    if (confirm('Delete this week?')) {
      const weeks = loadWeeks();
      weeks.splice(index, 1);
      saveWeeks(weeks);
      renderWeeksTable();
    }
  }
}

function showAdmin() {
  document.getElementById('login-section').style.display = 'none';
  document.getElementById('week-manage').style.display = 'block';
  document.getElementById('logout-btn').style.display = 'block';
  renderWeeksTable();
}

function initAdmin() {
  // login
  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const pw = document.getElementById('password-input').value;
    if (pw === PASSWORD) {
      showAdmin();
    } else {
      document.getElementById('login-error').textContent = 'Incorrect password';
    }
  });

  // week form
  document.getElementById('week-form').addEventListener('submit', handleWeekFormSubmit);

  // reset button
  document.getElementById('reset-week-form').addEventListener('click', (e) => {
    e.preventDefault();
    e.target.form.reset();
    document.getElementById('week-id-input').value = '';
  });

  // logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('week-manage').style.display = 'none';
    document.getElementById('logout-btn').style.display = 'none';
  });

  // table actions
  document.querySelector('#weeks-table tbody').addEventListener('click', handleTableClick);
}

document.addEventListener('DOMContentLoaded', initAdmin);
