document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("current");
  if (!el || !window.WEEKS) return;

  const start = new Date("2026-02-01");
  const now = new Date();

  const weekNum =
    Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000)) + 1;

  const today = now.toLocaleDateString(undefined, { weekday: "long" });

  const weekData =
    window.WEEKS.find(w => w.week === weekNum) ||
    { title: "Unplanned week", status: "unknown" };

  const days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

  const dayRow = days
    .map(d => `<span class="day ${d === today ? "today" : ""}">${d.slice(0,3)}</span>`)
    .join("");

  el.innerHTML = `
    <div class="current">
      <strong>Week ${weekNum}: ${weekData.title}</strong><br>
      <small>Status: ${weekData.status}</small>
      <div style="margin-top:6px">${dayRow}</div>
    </div>
  `;
});
