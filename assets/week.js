export function renderArchive(weeks) {
  const main = document.getElementById("archive-main");

  if (!weeks.length) {
    main.innerHTML = "<p>No archived weeks found.</p>";
    return;
  }

  weeks.forEach(week => {
    const saved = JSON.parse(localStorage.getItem(`week-${week.id}`));
    const notes = { ...week.notes, ...saved };

    const cards = Object.entries(notes).map(([day, note]) => {
      return `<div class="day-card"><strong>${day}</strong><p>${note || ""}</p></div>`;
    }).join("");

    const html = `
      <div class="week-card">
        <h2>Week ${week.id}: ${week.title}</h2>
        <p>${week.start} – ${week.end} · <em>${week.status}</em></p>
        <div class="day-list">${cards}</div>
      </div>
    `;
    main.innerHTML += html;
  });
}
