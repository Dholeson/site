// admin.js
// Lightweight admin gate + week/idea management
// NOTE: client-side only, not real security

const ADMIN_PASSWORD = "weeklybuilds"; // <-- change this if you want

function qs(id) {
  return document.getElementById(id);
}

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value, null, 2));
}

/* ---------- LOGIN ---------- */

const loginSection = qs("login-section");
const manageSection = qs("manage-section");
const ideasSection = qs("ideas-section");
const logoutBtn = qs("logout");

qs("login-form").addEventListener("submit", e => {
  e.preventDefault();
  const pw = qs("password").value;

  if (pw !== ADMIN_PASSWORD) {
    qs("login-error").textContent = "Incorrect password";
    return;
  }

  loginSection.style.display = "none";
  manageSection.style.display = "block";
  ideasSection.style.display = "block";
  logoutBtn.style.display = "inline-block";

  renderWeeks();
  renderIdeas();
});

logoutBtn.addEventListener("click", () => {
  location.reload();
});

/* ---------- WEEKS ---------- */

const weeksKey = "weeks";

function renderWeeks() {
  const weeks = load(weeksKey, {});
  const tbody = qs("weeks-table").querySelector("tbody");
  tbody.innerHTML = "";

  Object.entries(weeks)
    .sort(([a],[b]) => Number(a) - Number(b))
    .forEach(([id, w]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${id}</td>
        <td>${w.title}</td>
        <td>${w.start}</td>
        <td>${w.status}</td>
        <td>
          <button data-edit="${id}">Edit</button>
          <button data-del="${id}">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  tbody.onclick = e => {
    const edit = e.target.dataset.edit;
    const del = e.target.dataset.del;
    const weeks = load(weeksKey, {});

    if (edit) {
      const w = weeks[edit];
      qs("week-id").value = edit;
      qs("week-title-input").value = w.title;
      qs("week-start-input").value = w.start;
      qs("week-status-input").value = w.status;
    }

    if (del && confirm("Delete week?")) {
      delete weeks[del];
      save(weeksKey, weeks);
      renderWeeks();
    }
  };
}

qs("week-form").addEventListener("submit", e => {
  e.preventDefault();
  const weeks = load(weeksKey, {});
  const id = qs("week-id").value || String(Date.now());

  weeks[id] = {
    title: qs("week-title-input").value,
    start: qs("week-start-input").value,
    status: qs("week-status-input").value,
    days: weeks[id]?.days || {}
  };

  save(weeksKey, weeks);
  e.target.reset();
  qs("week-id").value = "";
  renderWeeks();
});

/* ---------- IDEAS ---------- */

const ideasKey = "ideas";

function renderIdeas() {
  const ideas = load(ideasKey, []);
  const list = qs("ideas-list");
  list.innerHTML = "";

  ideas.forEach((idea, i) => {
    const li = document.createElement("li");
    li.innerHTML = `
      ${idea}
      <button data-del="${i}">✕</button>
    `;
    list.appendChild(li);
  });

  list.onclick = e => {
    if (e.target.dataset.del) {
      ideas.splice(e.target.dataset.del, 1);
      save(ideasKey, ideas);
      renderIdeas();
    }
  };
}

qs("idea-form").addEventListener("submit", e => {
  e.preventDefault();
  const ideas = load(ideasKey, []);
  ideas.push(qs("idea-title-input").value);
  save(ideasKey, ideas);
  e.target.reset();
  renderIdeas();
});
