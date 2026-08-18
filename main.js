// ============================================================
// main.js — dashboard: create/view/update/complete tasks
// ============================================================

const token = localStorage.getItem("token");
if (!token) {
    window.location.href = "login.html";
}

let allTasks = [];
let currentFilter = "all";
let currentTypeFilter = "";
let currentModuleFilter = "";
let currentSort = "priority";

window.addEventListener("load", () => {
    const name = localStorage.getItem("userName") || "Student";
    document.getElementById("avatarInitial").textContent = name.trim().charAt(0).toUpperCase() || "S";
    document.getElementById("todayDate").textContent = new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });
    document.getElementById("logoutBtn").addEventListener("click", logout);
    document.getElementById("taskForm").addEventListener("submit", handleFormSubmit);
    document.getElementById("regenerateBtn").addEventListener("click", generateStudyPlan);

    document.querySelectorAll(".filter-item").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".filter-item").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentFilter = btn.dataset.filter;
            renderTasks();
        });
    });

    const typeSelect = document.getElementById("typeFilterSelect");
    if (typeSelect) {
        typeSelect.addEventListener("change", () => {
            currentTypeFilter = typeSelect.value;
            renderTasks();
        });
    }

    const moduleSelect = document.getElementById("moduleFilterSelect");
    if (moduleSelect) {
        moduleSelect.addEventListener("change", () => {
            currentModuleFilter = moduleSelect.value;
            renderTasks();
        });
    }

    const sortSelect = document.getElementById("sortSelect");
    if (sortSelect) {
        sortSelect.addEventListener("change", () => {
            currentSort = sortSelect.value;
            renderTasks();
        });
    }

    loadTasksFromAWS();
});

// Rebuild the module dropdown's options from whatever modules currently
// exist in the user's task list, keeping their current selection if it's
// still valid.
function populateModuleFilter() {
    const select = document.getElementById("moduleFilterSelect");
    if (!select) return;
    const modules = Array.from(new Set(allTasks.map(t => t.module).filter(Boolean))).sort();
    const previousValue = select.value;
    select.innerHTML = '<option value="">Module: Any</option>' +
        modules.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join("");
    if (modules.includes(previousValue)) select.value = previousValue;
    else currentModuleFilter = "";
}

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

// ---- 1. Add a new task ----
async function handleFormSubmit(event) {
    event.preventDefault();
    const submitBtn = document.getElementById("submitBtn");
    submitBtn.disabled = true;
    showStatus("Adding task...", "loading");

    const userInput = {
        module: document.getElementById("module").value,
        taskType: document.getElementById("taskType").value,
        deadline: document.getElementById("deadline").value,
        gradeWeight: Number(document.getElementById("gradeWeight").value) || 0,
        effort: Number(document.getElementById("effort").value) || 1,
        difficulty: Number(document.getElementById("difficulty").value) || 3,
        isGroup: document.getElementById("isGroup").checked,
        progress: 0
    };

    try {
        const response = await fetch(`${API_URL}/tasks`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify(userInput)
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || "Failed to save task");
        }

        event.target.reset();
        document.getElementById("statusMsg").style.display = "none";
        loadTasksFromAWS();
    } catch (err) {
        console.error("Error sending input to AWS:", err);
        showStatus("Could not save your task: " + err.message, "error");
    } finally {
        submitBtn.disabled = false;
    }
}

// ---- 2. Fetch active tasks ----
async function loadTasksFromAWS() {
    const container = document.getElementById("taskContainer");
    try {
        const response = await fetch(`${API_URL}/tasks`, { headers: authHeaders() });
        if (!response.ok) throw new Error("Failed to load tasks");
        allTasks = await response.json();
        populateModuleFilter();
        renderTasks();
        updateStats();
    } catch (err) {
        console.error("Error loading tasks from AWS:", err);
        container.innerHTML = '<div class="empty-state">Could not load tasks. Check your API connection.</div>';
    }
}

function updateStats() {
    let urgent = 0, overdue = 0;
    allTasks.forEach(t => {
        if (t.daysUntil < 0) overdue++;
        else if (t.daysUntil <= 3) urgent++;
    });
    document.getElementById("totalCount").textContent = allTasks.length;
    document.getElementById("urgentCount").textContent = urgent;
    document.getElementById("overdueCount").textContent = overdue;

    // Completed count — fetched lazily from /tasks/all so the dashboard load stays fast
    fetch(`${API_URL}/tasks/all`, { headers: authHeaders() })
        .then(r => r.ok ? r.json() : [])
        .then(all => {
            const completed = all.filter(t => t.completed).length;
            document.getElementById("completedCount").textContent = completed;
        })
        .catch(() => {});
}

// ---- 3. Render tasks into the page ----
function renderTasks() {
    const container = document.getElementById("taskContainer");

    let filtered = allTasks;
    if (currentFilter === "soon") filtered = filtered.filter(t => t.daysUntil >= 0 && t.daysUntil <= 3);
    else if (currentFilter === "overdue") filtered = filtered.filter(t => t.daysUntil < 0);
    else if (currentFilter === "group") filtered = filtered.filter(t => t.isGroup);
    if (currentTypeFilter) filtered = filtered.filter(t => t.taskType === currentTypeFilter);
    if (currentModuleFilter) filtered = filtered.filter(t => t.module === currentModuleFilter);

    if (!filtered || filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">No tasks here yet.</div>';
        return;
    }

    // Rank badges reflect whatever order is actually on screen — if you sort
    // by deadline, #1 is the one due soonest, not necessarily the highest
    // priority score. That matches what the badge visually implies.
    filtered = sortTasks(filtered);

    container.innerHTML = filtered.map((task, index) => {
        return renderTaskRow(task, index + 1, false);
    }).join("");
}

function sortTasks(tasks) {
    const sorted = tasks.slice();
    if (currentSort === "deadline") {
        sorted.sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0));
    } else if (currentSort === "grade") {
        sorted.sort((a, b) => (b.gradeWeight || 0) - (a.gradeWeight || 0));
    }
    // "priority" is already the default order tasks arrive in from the API
    return sorted;
}

function renderTaskRow(task, rank, isCompleted) {
    const daysLeft = task.daysUntil;
    let rowClass = "", badgeClass = "", statusClass = "later", daysText = "";

    if (isCompleted) {
        rowClass = "done"; badgeClass = "done";
        daysText = `Completed ${task.completedAt ? formatDate(task.completedAt) : ""}`;
        statusClass = "later";
    } else if (daysLeft < 0) {
        rowClass = "urgent"; badgeClass = "urgent"; statusClass = "urgent";
        daysText = `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? "s" : ""}`;
    } else if (daysLeft === 0) {
        rowClass = "urgent"; badgeClass = "urgent"; statusClass = "urgent";
        daysText = "Due today";
    } else if (daysLeft <= 3) {
        rowClass = "urgent"; badgeClass = "urgent"; statusClass = "urgent";
        daysText = `Due in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`;
    } else if (daysLeft <= 7) {
        rowClass = "soon"; badgeClass = "soon"; statusClass = "soon";
        daysText = `Due in ${daysLeft} days`;
    } else {
        daysText = `Due in ${daysLeft} days`;
    }

    const progress = task.progress || 0;
    const why = isCompleted ? "Nice work — this one's done." : explainPriority(task, daysLeft);
    const fillColor = badgeClass === "urgent" ? "var(--clay)" : badgeClass === "soon" ? "var(--gold)" : "var(--moss)";

    return `
        <div class="task-row ${rowClass}">
            <div class="rank-badge ${badgeClass}">${isCompleted ? "✓" : rank}</div>
            <div class="task-content">
                <div class="task-head">
                    <span class="task-name">${escapeHtml(task.module)}</span>
                    <span class="task-tag">${escapeHtml(task.taskType)}</span>
                    ${task.isGroup ? '<span class="task-tag group">Group</span>' : ""}
                    ${isCompleted ? '<span class="task-tag done">Done</span>' : ""}
                </div>
                <div class="task-meta-row">${formatDate(task.deadline)}${task.gradeWeight ? ` · ${task.gradeWeight}% of grade` : ""}</div>
                <div class="task-status ${statusClass}">
                    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                    ${daysText}
                </div>
                <div class="progress-line">
                    <div class="progress-track"><div class="progress-fill" style="width:${progress}%; background:${fillColor};"></div></div>
                    <div class="progress-pct">${progress}%</div>
                </div>
                <div class="task-why">${why}</div>
            </div>
            ${isCompleted ? "" : `
            <div class="task-side">
                <input type="number" class="progress-input" min="0" max="100" value="${progress}" onchange="updateTaskProgress('${task.id}', this.value)">
                <button class="btn-edit" onclick='openEditModal(${JSON.stringify(task)})'>Edit</button>
                <button class="btn-done" onclick="markTaskComplete('${task.id}')">Done</button>
            </div>`}
        </div>
    `;
}

// Called by task-edit.js after a save or delete completes
window.onTaskEdited = function () {
    loadTasksFromAWS();
};

function explainPriority(task, daysLeft) {
    const reasons = [];
    if (daysLeft <= 3) reasons.push("deadline is very close");
    else if (daysLeft <= 7) reasons.push("deadline is coming up soon");
    if (task.gradeWeight >= 20) reasons.push(`worth ${task.gradeWeight}% of your grade`);
    if ((task.progress || 0) < 30) reasons.push("you've barely started");
    if (task.effort >= 5) reasons.push("needs significant effort");
    if (task.difficulty >= 4) reasons.push("rated as difficult");
    if (reasons.length === 0) return "Lower priority for now — keep an eye on it.";
    return "High priority — " + reasons.join(", ") + ".";
}

// ---- 4. Update progress ----
async function updateTaskProgress(taskId, newProgress) {
    try {
        await fetch(`${API_URL}/tasks/${taskId}`, {
            method: "PATCH",
            headers: authHeaders(),
            body: JSON.stringify({ progress: Number(newProgress) })
        });
        loadTasksFromAWS();
    } catch (err) {
        console.error("Error updating progress:", err);
    }
}

// ---- 5. Mark complete ----
async function markTaskComplete(taskId) {
    try {
        await fetch(`${API_URL}/tasks/${taskId}`, { method: "DELETE", headers: authHeaders() });
        loadTasksFromAWS();
    } catch (err) {
        console.error("Error completing task:", err);
        alert("Could not mark task as complete. Try again.");
    }
}

// ---- 6. AI Study Plan ----
async function generateStudyPlan() {
    const btn = document.getElementById("regenerateBtn");
    const content = document.getElementById("aiPlanContent");
    btn.disabled = true;
    btn.textContent = "Thinking...";
    content.innerHTML = '<div class="ai-empty">Generating your plan...</div>';

    try {
        const response = await fetch(`${API_URL}/study-plan`, {
            method: "POST",
            headers: authHeaders()
        });
        if (!response.ok) throw new Error("Failed to generate plan");
        const data = await response.json();
        renderStudyPlan(data);
    } catch (err) {
        console.error("Error generating study plan:", err);
        content.innerHTML = '<div class="ai-empty">Could not generate a plan right now. Try again.</div>';
    } finally {
        btn.disabled = false;
        btn.textContent = "Regenerate plan";
    }
}

function renderStudyPlan(data) {
    const content = document.getElementById("aiPlanContent");
    if (!data || !data.items || data.items.length === 0) {
        content.innerHTML = '<div class="ai-empty">Add a few tasks, then generate a plan.</div>';
        return;
    }
    const quote = data.quote ? `<div class="ai-quote">"${escapeHtml(data.quote)}"</div>` : "";
    const items = data.items.map(item => `
        <div class="ai-item">
            <div class="ai-day">${escapeHtml(item.day)}</div>
            <div class="ai-text">${escapeHtml(item.text)}</div>
        </div>
    `).join("");
    content.innerHTML = quote + items;
}

function showStatus(msg, type) {
    const el = document.getElementById("statusMsg");
    el.textContent = msg;
    el.className = "status-msg " + type;
    if (type !== "loading") {
        setTimeout(() => { el.style.display = "none"; }, 3000);
    }
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
}
