const start = new Date("2026-02-01"); // start date
const now = new Date();

const week = Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000)) + 1;
const day = now.toLocaleDateString(undefined, { weekday: "long" });

document.getElementById("current").innerHTML = `
  <div class="current">
    <strong>Week ${week}</strong><br>
    <span>Today: ${day}</span>
  </div>
`;
