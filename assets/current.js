const start = new Date("2026-02-01"); // start date
const now = new Date();

const week = Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000)) + 1;
const day = now.toLocaleDateString(undefined, { weekday: "long" });

const project = "Website reboot";
const days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const dayRow = days.map(d =>
  `<span class="day ${d === day ? "today" : ""}">${d.slice(0,3)}</span>`
).join("");

el.innerHTML = `
  <div class="current">
    <strong>Week ${week}: ${project}</strong><br>
    <div>${dayRow}</div>
  </div>
`;


el.innerHTML = `
  <div class="current">
    <strong>Week ${week}: ${project}</strong><br>
    <span>Today: ${day}</span>
  </div>
`;
