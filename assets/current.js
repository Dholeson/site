export function renderHome(weeks) {
  const current = getCurrentWeek(weeks);
  const currentDay = new Date().toLocaleDateString("en-US", { weekday: "long" });

  if (!current) {
    document.getElementById("current-week").innerHTML = "<p>No active week found.</p>";
    return;
  }

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const cards = days.map(day => {
    const isToday = day === currentDay ? "today" : "";
    const note = current.notes?.[day] || "";
    return `
      <div class="day-card ${isToday}">
        <strong>${day}</strong>
        <textarea placeholder="What did I do?" data-day="${day}">${note}</textarea>
      </div>
    `;
  }).join("");

  document.getElementById("current-week").innerHTML = `
    <div class="week-card">
      <h2>Week ${current.id}: ${current.title}</h2>
      <p>${current.start} – ${current.end} · <em>${current.status}</em></p>
      <div class="day-list">${cards}</div>
    </div>
  `;

  // Save on input
  document.querySelectorAll("textarea").forEach(t => {
    t.addEventListener("input", () => {
      current.notes[t.dataset.day] = t.value;
      localStorage.setItem(`week-${current.id}`, JSON.stringify(current.notes));
    });
  });
}

function getCurrentWeek(weeks) {
  const today = new Date();
  return weeks.find(week => {
    const start = new Date(week.start);
    const end = new Date(week.end);
    return today >= start && today <= end;
  });
}
