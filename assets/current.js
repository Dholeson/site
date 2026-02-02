// current.js – handles rendering the home page (index.html)

import { weeks } from '../data/weeks.js';

// Find current week based on today's date
function getCurrentWeek() {
  const today = new Date();
  return weeks.find(week => {
    const start = new Date(week.startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return today >= start && today <= end;
  });
}

// Format date range (e.g. "Jan 1 – Jan 7, 2026")
function formatDateRange(startDate) {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric, year' })}`;
}

function renderHome() {
  const main = document.getElementById('main-content');
  const currentWeek = getCurrentWeek();

  if (!currentWeek) {
    main.innerHTML = `<p>No current week found. Please check back later.</p>`;
    return;
  }

  // Current week card
  const currentCard = document.createElement('div');
  currentCard.className = 'card';
  currentCard.innerHTML = `
    <h2>Current Week: ${currentWeek.title}</h2>
    <p>${formatDateRange(currentWeek.startDate)}</p>
    <span class="status ${currentWeek.status}">${currentWeek.status.replace('_', ' ')}</span>
    <p class="mt-2">${currentWeek.summary || ''}</p>
    <a href="weeks.html?week=${currentWeek.id}" class="button">View Details</a>
  `;
  main.appendChild(currentCard);

  // Archive listing
  const archiveHeader = document.createElement('h2');
  archiveHeader.textContent = 'Archive';
  archiveHeader.style.marginTop = '2rem';
  main.appendChild(archiveHeader);

  weeks.forEach(week => {
    const weekCard = document.createElement('div');
    weekCard.className = 'card';
    weekCard.innerHTML = `
      <h3>${week.title}</h3>
      <p>${formatDateRange(week.startDate)}</p>
      <span class="status ${week.status}">${week.status.replace('_', ' ')}</span>
      <a href="weeks.html?week=${week.id}" class="button secondary" style="margin-top:0.5rem;">Open</a>
    `;
    main.appendChild(weekCard);
  });
}

document.addEventListener('DOMContentLoaded', renderHome);
