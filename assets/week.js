// week.js – handles rendering an individual week page (weeks.html)

import { weeks } from '../data/weeks.js';

// Get week ID from query parameter (?week=week-01)
function getWeekId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('week');
}

// Format date (e.g. "Mon Jan 1")
function formatDay(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function renderWeek() {
  const weekId = getWeekId();
  const week = weeks.find(w => w.id === weekId);
  const container = document.getElementById('week-main');

  if (!week) {
    container.innerHTML = `<p>Week not found.</p>`;
    return;
  }

  // Header
  const headerCard = document.createElement('div');
  headerCard.className = 'card';
  headerCard.innerHTML = `
    <h2>${week.title}</h2>
    <p>${formatDay(week.startDate)} – ${formatDay(new Date(week.startDate).setDate(new Date(week.startDate).getDate() + 6))}</p>
    <span class="status ${week.status}">${week.status.replace('_',' ')}</span>
  `;
  container.appendChild(headerCard);

  // Days
  week.days.forEach(day => {
    const dayCard = document.createElement('div');
    dayCard.className = 'card';
    dayCard.innerHTML = `
      <h3>${formatDay(day.date)}</h3>
      <p>${day.notes || '<em>No entry for this day.</em>'}</p>
    `;
    container.appendChild(dayCard);
  });
}

document.addEventListener('DOMContentLoaded', renderWeek);
