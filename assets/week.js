const params = new URLSearchParams(window.location.search);
const weekNum = Number(params.get("week")) || 1;

const week = window.WEEKS.find(w => w.week === weekNum);
if (!week) return;

const today = new Date().toLocaleDateString(undefined, { weekday: "short" });

document.getElementById("week-header").innerHTML = `
  <h1>Week ${week.week}: ${week.title}</h1>
  <small>${week.start} → ${week.end} · ${week.status}</small>
`;

document.getElementById("week-nav").innerHTML = `
  <button onclick="location.href='week.html?week=${weekNum - 1}'">←</button>
  <button onclick="location.href='week.html?week=${weekNum + 1}'">→</button>
`;

const days = Object.entries(week.days);

document.getElementById("day-cards").innerHTML = days.map(([day, data]) => {
  const isToday = day === today ? "today" : "";
  return `
    <div class="day-card ${isToday}">
      <strong>${day}</strong>
      <p>${data.note || "—"}</p>
    </div>
  `;
}).join("");
