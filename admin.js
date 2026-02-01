// admin.js
// Client-side admin UI (NOT secure — personal use only)

const ADMIN_PASSWORD = "weeklybuilds"; // change if you want

function $(id) {
  return document.getElementById(id);
}

document.addEventListener("DOMContentLoaded", () => {
  const loginSection = $("login-section");
  const manageSection = $("manage-section");
  const ideasSection = $("ideas-section");
  const logoutBtn = $("logout");
  const errorEl = $("login-error");

  // ---- LOGIN ----
  $("login-form").addEventListener("submit", e => {
    e.preventDefault();
    const pw = $("password").value;

    if (pw !== ADMIN_PASSWORD) {
      errorEl.textContent = "Incorrect password";
      return;
    }

    loginSection.style.display = "none";
    manageSection.style.display = "block";
    ideasSection.style.display = "block";
    logoutBtn.style.display = "inline-block";
    errorEl.textContent = "";

    renderWeeks();
    renderIdeas();
  });

  logoutBtn.addEventListener("click", () => {
    location.reload();
  });
});

/* ---------------- DATA ---------------- */

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

/* ---------------- WEEKS ---------------- */

function renderWeeks() {
  const weeks = load("weeks", {});
  const tbody = $("weeks-table").querySelector("tbody");
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
    const weeks = load("weeks", {});

    if (edit) {
      const w = weeks[edit];
      $("week-id").value = edit;
      $("week-title-input").value = w.title;
      $("week-start-input").value = w.start;
      $("week-status-input").value = w.status;
    }

    if (del && confirm("Delete this week?")) {
      delete weeks[del];
      save("weeks", weeks);
      renderWeeks();
    }
  };
}

$("week-form").addEventListener("submit", e => {
  e.preventDefault();
  const weeks = load("weeks", {});
  const id = $("week-id").value || Date.now().toString();

  weeks[id] = {
    title: $("week-title-input").value,
    start: $("week-start-input").value,
    status: $("week-status-input").value,
    days: weeks[id]?.days || {}
  };

  save("weeks", weeks);
  e.target.reset();
  $("week-id").value = "";
  renderWeeks();
});

/* ---------------- IDEAS ---------------- */

function renderIdeas() {
  const ideas = load("ideas", []);
  const list = $("ideas-list");
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
      save("ideas", ideas);
      renderIdeas();
    }
  };
}

$("idea-form").addEventListener("submit", e => {
  e.preventDefault();
  const ideas = load("ideas", []);
  ideas.push($("idea-title-input").value);
  save("ideas", ideas);
  e.target.reset();
  renderIdeas();
});
