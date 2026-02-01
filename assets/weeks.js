document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("weeks");
  if (!el || !window.WEEKS) return;

  const start = new Date("2026-02-01");
  const now = new Date();
  const currentWeek =
    Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000)) + 1;

  const maxWeeks = 48;

  const html = Array.from({ length: maxWeeks }, (_, i) => {
    const weekNum = i + 1;
    const data = window.WEEKS.find(w => w.week === weekNum);

    const title = data ? data.title : "—";
    const status = data ? data.status : "planned";
    const isCurrent = weekNum === currentWeek ? "current" : "";

    return `
      <div class="${isCurrent}">
        <strong>Week ${weekNum}</strong><br>
        <span>${title}</span><br>
        <small>${status}</small>
      </div>
    `;
  }).join("");

  el.innerHTML = html;
});
