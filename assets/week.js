document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const weekNum = Number(params.get("week")) || 1;

  const STORAGE_KEY = `week-${weekNum}-notes`;
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

  const week = window.WEEKS.find(w => w.week === weekNum);
  if (!week) return;

  const today = new Date().toLocaleDateString(undefined, { weekday: "short" });

  document.getElementById("week-header").innerHTML = `
    <h1>Week ${week.week}: ${week.title}</h1>
    <small>${week.start} → ${week.end} · ${week.status}</small>
  `;

  document.getElementById("week-nav").innerHTML = `
    <button onclick="location.href='week.html?week=${weekNum - 1}'">←</button>
    <strong>Week ${weekNum}</strong>
    <button onclick="location.href='week.html?week=${weekNum + 1}'">→</button>
  `;

  const days = Object.keys(week.days);

  document.getElementById("day-cards").innerHTML = days.map(day => {
    const isToday = day === today ? "today" : "";
    const note = saved[day] || "";
    return `
      <div class="day-card ${isToday}">
        <strong>${day}</strong>
        <textarea data-day="${day}" placeholder="What did I do?">${note}</textarea>
      </div>
    `;
  }).join("");

  document.querySelectorAll("textarea").forEach(t => {
    t.addEventListener("input", () => {
      saved[t.dataset.day] = t.value;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    });
  });
});
