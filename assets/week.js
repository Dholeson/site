document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const weekNum = Number(params.get("week")) || 1;

  const week = window.WEEKS.find(w => w.week === weekNum);
  if (!week) return;

  const STORAGE_KEY = `week-${weekNum}-notes`;
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

  const startDate = new Date(week.start);
  const todayStr = new Date().toDateString();

  document.getElementById("week-header").innerHTML = `
    <h1 contenteditable="true" id="week-title">${week.title}</h1>
    <small>Week ${week.week} · ${week.start} → ${new Date(startDate.getTime() + 6*86400000).toISOString().slice(0,10)}</small>
  `;

  document.getElementById("week-nav").innerHTML = `
    <button onclick="location.href='week.html?week=${weekNum - 1}'">←</button>
    <strong>Week ${weekNum}</strong>
    <button onclick="location.href='week.html?week=${weekNum + 1}'">→</button>
  `;

  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  document.getElementById("day-cards").innerHTML = days.map((day, i) => {
    const date = new Date(startDate.getTime() + i * 86400000);
    const isToday = date.toDateString() === todayStr ? "today" : "";
    const data = saved[day] || {};

    return `
      <div class="day-card ${isToday}">
        <div class="day-header">
          <strong>${day}</strong>
          <span>${date.getMonth()+1}/${date.getDate()}</span>
        </div>

        <input placeholder="Focus"
          data-day="${day}" data-field="focus"
          value="${data.focus || ""}" />

        <textarea placeholder="Did"
          data-day="${day}" data-field="did">${data.did || ""}</textarea>

        <input placeholder="Blocker"
          data-day="${day}" data-field="blocker"
          value="${data.blocker || ""}" />
      </div>
    `;
  }).join("");

  document.querySelectorAll("input, textarea").forEach(el => {
    el.addEventListener("input", () => {
      const day = el.dataset.day;
      const field = el.dataset.field;
      saved[day] = saved[day] || {};
      saved[day][field] = el.value;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    });
  });
});
