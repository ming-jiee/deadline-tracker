// all-tasks.js — view all tasks, active + completed

const token = localStorage.getItem("token");
if (!token) {
    window.location.href = "login.html";
}

let allTasksData = [];
let currentFilter = "all";
let currentTypeFilter = "";
let currentModuleFilter = "";
let currentSort = "priority";

window.addEventListener("load", () => {
    const name = localStorage.getItem("userName") || "Student";
    document.getElementById("avatarInitial").textContent = name.trim().charAt(0).toUpperCase() || "S";
    document.getElementById("logoutBtn").addEventListener("click", logout);

    document.querySelectorAll(".filter-item").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".filter-item").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentFilter = btn.dataset.filter;
            render();
        });
    });

    const typeSelect = document.getElementById("typeFilterSelect");
    if (typeSelect) {
        typeSelect.addEventListener("change", () => {
            currentTypeFilter = typeSelect.value;
            render();
        });
    }

    const moduleSelect = document.getElementById("moduleFilterSelect");
    if (moduleSelect) {
        moduleSelect.addEventListener("change", () => {
            currentModuleFilter = moduleSelect.value;
            render();
        });
    }

    const sortSelect = document.getElementById("sortSelect");
    if (sortSelect) {
        sortSelect.addEventListener("change", () => {
            currentSort = sortSelect.value;
            render();
        });
    }

    load();
});

function populateModuleFilter() {
    const select = document.getElementById("moduleFilterSelect");
    if (!select) return;
    const modules = Array.from(new Set(allTasksData.map(t => t.module).filter(Boolean))).sort();
    const previousValue = select.value;
    select.innerHTML = '<option value="">Module: Any</option>' +
        modules.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join("");
    if (modules.includes(previousValue)) select.value = previousValue;
    else currentModuleFilter = "";
}

function sortTasks(tasks) {
    const sorted = tasks.slice();
    if (currentSort === "deadline") {
        sorted.sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0));
    } else if (currentSort === "grade") {
        sorted.sort((a, b) => (b.gradeWeight || 0) - (a.gradeWeight || 0));
    }
    return sorted;
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

async function load() {
    const container = document.getElementById("taskContainer");
    try {
        const response = await fetch(`${API_URL}/tasks/all`, { headers: authHeaders() });
        if (!response.ok) throw new Error("Failed to load tasks");
        allTasksData = await response.json();
        populateModuleFilter();
        render();
    } catch (err) {
        console.error("Error loading tasks:", err);
        container.innerHTML = '<div class="empty-state">Could not load tasks. Check your API connection.</div>';
    }
}

function render() {
    const container = document.getElementById("taskContainer");
    let filtered = allTasksData;
    if (currentFilter === "active") filtered = filtered.filter(t => !t.completed);
    else if (currentFilter === "completed") filtered = filtered.filter(t => t.completed);
    if (currentTypeFilter) filtered = filtered.filter(t => t.taskType === currentTypeFilter);
    if (currentModuleFilter) filtered = filtered.filter(t => t.module === currentModuleFilter);

    if (!filtered || filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">Nothing here yet.</div>';
        return;
    }

    // rank badges follow on-screen order; completed tasks get a checkmark instead
    const displayList = sortTasks(filtered);
    let activeRank = 0;

    container.innerHTML = displayList.map((task) => {
        const rank = task.completed ? null : ++activeRank;
        return renderTaskRow(task, rank, !!task.completed);
    }).join("");
}

function renderTaskRow(task, rank, isCompleted) {
    const daysLeft = task.daysUntil;
    let rowClass = "", badgeClass = "", statusClass = "later", daysText = "";

    if (isCompleted) {
        rowClass = "done"; badgeClass = "done";
        daysText = `Completed ${task.completedAt ? formatDate(task.completedAt) : ""}`;
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
            ${isCompleted ? `
            <div class="task-side">
                <button class="btn-delete-row" onclick="deleteCompletedTask('${task.id}')">Delete</button>
            </div>` : `
            <div class="task-side">
                <input type="number" class="progress-input" min="0" max="100" value="${progress}" onchange="updateTaskProgress('${task.id}', this.value)">
                <button class="btn-edit" onclick='openEditModal(${JSON.stringify(task)})'>Edit</button>
                <button class="btn-done" onclick="markTaskComplete('${task.id}')">Done</button>
            </div>`}
        </div>
    `;
}

async function deleteCompletedTask(taskId) {
    if (!confirm("Delete this completed task permanently? This can't be undone.")) return;
    try {
        const response = await fetch(`${API_URL}/tasks/${taskId}/permanent`, {
            method: "DELETE",
            headers: authHeaders()
        });
        if (!response.ok) throw new Error("Failed to delete task");
        load();
    } catch (err) {
        console.error("Error deleting completed task:", err);
        alert("Could not delete task. Try again.");
    }
}

window.onTaskEdited = function () {
    load();
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

async function updateTaskProgress(taskId, newProgress) {
    try {
        await fetch(`${API_URL}/tasks/${taskId}`, {
            method: "PATCH",
            headers: authHeaders(),
            body: JSON.stringify({ progress: Number(newProgress) })
        });
        load();
    } catch (err) {
        console.error("Error updating progress:", err);
    }
}

async function markTaskComplete(taskId) {
    try {
        await fetch(`${API_URL}/tasks/${taskId}`, { method: "DELETE", headers: authHeaders() });
        load();
    } catch (err) {
        console.error("Error completing task:", err);
        alert("Could not mark task as complete. Try again.");
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
