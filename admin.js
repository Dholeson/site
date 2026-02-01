// admin.js
// Simple admin editor for Weekly Builds
// Phase 1: localStorage-backed, no auth, no backend

function loadWeeks() {
  try {
    return JSON.parse(localStorage.getItem("weeks")) || {};
  } catch {
    return {};
  }
}

function saveWeeks(weeks) {
  localStorage.setItem("weeks", JSON.stringify(weeks, null, 2));
}

function renderDebug(data) {
  document.getElementById("debug").textContent =
    JSON.stringify(data, null, 2);
}

document.getElementById("saveWeek").addEventListener("click", () => {
  const weekNumber = Number(
    document.getElementById("weekNumber").value
  );
  const title =
    document.getElementById("weekTitleInput").value.trim();
  const start =
    document.getElementById("weekStart").value;
  const status =
    document.getElementById("weekStatus").value;

  if (!weekNumber || !title || !start) {
    alert("Week number, title, and start date are required.");
    return;
  }

  const weeks = loadWeeks();

  weeks[weekNumber] = {
    title,
    start,
    status,
    days: {
      Sun: "",
      Mon: "",
      Tue: "",
      Wed: "",
      Thu: "",
      Fri: "",
      Sat: ""
    }
  };

  saveWeeks(weeks);
  renderDebug(weeks[weekNumber]);
});


// Optional helper: preload a week when you type a number
document.getElementById("weekNumber").addEventListener("change", () => {
  const weekNumber = Number(
    document.getElementById("weekNumber").value
  );
  if (!weekNumber) return;

  const weeks = loadWeeks();
  const week = weeks[weekNumber];
  if (!week) return;

  document.getElementById("weekTitleInput").value = week.title;
  document.getElementById("weekStart").value = week.start;
  document.getElementById("weekStatus").value = week.status;

  renderDebug(week);
});
