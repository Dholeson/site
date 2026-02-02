export function renderHome(weeks) {
  const today = new Date();
  const current = weeks.find(w => new Date(w.start) <= today && today <= new Date(w.end));
  const currentDay = today.toLocaleDateString("en-US", { weekday: "long" });

  if (!current) {
    document.getElementById("current-week").innerHTML = "<p>No active week found.</p>";
    return;
  }

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const notes = JSON.parse(localStorage.getItem(`week-${current.id}`)) || current.notes || {};

  const dayCards = days.map(day => {
    const isToday = day === currentDay ? "today" : "";
    return `
      <div class="day-card ${isToday}">
        <strong>${day}</strong>
        <textarea data-day="${day}">${notes[day] || ""}</textarea>
      </div>
    `;
  }).join("");

  document.getElementById("current-week").innerHTML = `
    <div class="week-card">
      <h2>Week ${current.id}: ${current.title}</h2>
      <p>${current.start} – ${current.end} · <em>${current.status}</em></p>
      <div class="day-list">${dayCards}</div>
    </div>
  `;

  document.querySelectorAll("textarea").forEach(t => {
    t.addEventListener("input", () => {
      notes[t.dataset.day] = t.value;
      localStorage.setItem(`week-${current.id}`, JSON.stringify(notes));
    });
  });
}
