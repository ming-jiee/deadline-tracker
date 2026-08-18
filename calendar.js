// calendar.js — month grid view of active tasks, by deadline date

const token = localStorage.getItem("token");
if (!token) {
    window.location.href = "login.html";
}

let calTasks = [];
let viewYear, viewMonth; // viewMonth is 0-indexed
let selectedDateKey = null;

window.addEventListener("load", () => {
    const name = localStorage.getItem("userName") || "Student";
    document.getElementById("avatarInitial").textContent = name.trim().charAt(0).toUpperCase() || "S";
    document.getElementById("logoutBtn").addEventListener("click", logout);
    document.getElementById("prevMonth").addEventListener("click", () => shiftMonth(-1));
    document.getElementById("nextMonth").addEventListener("click", () => shiftMonth(1));
    document.getElementById("todayBtn").addEventListener("click", () => {
        const now = new Date();
        viewYear = now.getFullYear();
        viewMonth = now.getMonth();
        renderCalendar();
    });

    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();

    // support calendar.html?date=YYYY-MM-DD deep links
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get("date");
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        const d = new Date(dateParam + "T00:00:00");
        viewYear = d.getFullYear();
        viewMonth = d.getMonth();
        selectedDateKey = dateParam;
    }

    loadTasks();
});

function logout() {
    localStorage.clear();
    window.location.href = "login.html";
}

function authHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`
    };
}

async function loadTasks() {
    try {
        const response = await fetch(`${API_URL}/tasks/all`, { headers: authHeaders() });
        if (!response.ok) throw new Error("Failed to load tasks");
        calTasks = (await response.json()).filter(t => !t.completed && t.deadline);
        renderCalendar();
    } catch (err) {
        console.error("Error loading tasks for calendar:", err);
        document.getElementById("calGrid").innerHTML = '<div class="empty-state">Could not load tasks.</div>';
    }
}

function shiftMonth(delta) {
    viewMonth += delta;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    renderCalendar();
}

function dateKey(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function urgencyClass(deadlineStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(deadlineStr + "T00:00:00");
    const days = Math.round((d - today) / 86400000);
    if (days <= 3) return "urgent";
    if (days <= 7) return "soon";
    return "later";
}

function renderCalendar() {
    const monthLabel = document.getElementById("monthLabel");
    const grid = document.getElementById("calGrid");
    monthLabel.textContent = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

    const tasksByDate = {};
    calTasks.forEach(t => {
        (tasksByDate[t.deadline] = tasksByDate[t.deadline] || []).push(t);
    });

    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const todayKey = dateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

    let html = "";
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="cal-cell empty"></div>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const key = dateKey(viewYear, viewMonth, day);
        const dayTasks = tasksByDate[key] || [];
        const isToday = key === todayKey;
        const isSelected = key === selectedDateKey;
        const classes = ["cal-cell", "has-task"];
        if (isToday) classes.push("today");
        if (isSelected) classes.push("selected");

        const dots = dayTasks.slice(0, 4).map(t => `<div class="cal-dot ${urgencyClass(t.deadline)}"></div>`).join("");

        html += `
            <div class="${classes.join(" ")}" onclick="selectDate('${key}')">
                <div class="cal-date-num">${day}</div>
                <div class="cal-dots">${dots}</div>
            </div>
        `;
    }

    grid.innerHTML = html;

    if (selectedDateKey) renderSelectedDate(tasksByDate);
}

function selectDate(key) {
    selectedDateKey = key;
    renderCalendar();
}

function renderSelectedDate(tasksByDate) {
    const label = document.getElementById("selectedDateLabel");
    const container = document.getElementById("selectedDateTasks");
    const tasks = (tasksByDate || {})[selectedDateKey] || [];

    const d = new Date(selectedDateKey + "T00:00:00");
    label.textContent = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

    if (!tasks.length) {
        container.innerHTML = '<div class="empty-state" style="padding: 20px 0;">Nothing due this day.</div>';
        return;
    }

    container.innerHTML = tasks.map(t => `
        <div class="cal-day-task ${urgencyClass(t.deadline)}">
            <div class="cal-day-task-name">${escapeHtml(t.module)}</div>
            <div class="cal-day-task-meta">${escapeHtml(t.taskType)}${t.gradeWeight ? ` · ${t.gradeWeight}% of grade` : ""}${t.isGroup ? " · Group" : ""}</div>
        </div>
    `).join("");
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
}
