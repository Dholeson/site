const PASSWORD = "weeklybuilds";

function initAdmin() {
  const pwInput = document.getElementById("password");
  const loginBtn = document.getElementById("login-btn");
  const errorBox = document.getElementById("login-error");
  const editor = document.getElementById("editor");

  loginBtn.addEventListener("click", () => {
    if (pwInput.value === PASSWORD) {
      document.getElementById("login-section").style.display = "none";
      editor.style.display = "block";
      loadWeeks();
    } else {
      errorBox.textContent = "Incorrect password.";
    }
  });

  document.getElementById("week-form").addEventListener("submit", e => {
    e.preventDefault();
    const id = Date.now();
    const week = {
      id,
      title: document.getElementById("title").value,
      start: document.getElementById("start").value,
      end: getEndFromStart(document.getElementById("start").value),
      status: document.getElementById("status").value,
      notes: {}
    };
    const existing = JSON.parse(localStorage.getItem("admin_weeks") || "[]");
    localStorage.setItem("admin_weeks", JSON.stringify([...existing, week]));
    location.reload();
  });
}

function getEndFromStart(start) {
  const d = new Date(start);
  d.setDate(d.getDate() + 6);
  return d.toISOString().split("T")[0];
}

function loadWeeks() {
  const container = document.getElementById("week-list");
  const data = JSON.parse(localStorage.getItem("admin_weeks") || "[]");
  data.forEach(w => {
    const li = document.createElement("li");
    li.textContent = `Week ${w.id}: ${w.title} (${w.start} – ${w.end})`;
    container.appendChild(li);
  });
}

initAdmin();
