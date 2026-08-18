// notifications.js — shared bell icon + dropdown, loaded on every post-login page

let notifTasks = []; // close-deadline list from the API

window.addEventListener("load", () => {
    const bell = document.getElementById("notifBell");
    const dropdown = document.getElementById("notifDropdown");
    const clearBtn = document.getElementById("notifClearBtn");
    if (!bell || !dropdown) return; // auth pages don't have a bell

    bell.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("open");
        if (dropdown.classList.contains("open")) {
            markNotificationsSeen();
        }
    });

    if (clearBtn) {
        clearBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            clearAllNotifications();
        });
    }

    document.addEventListener("click", (e) => {
        if (!dropdown.contains(e.target) && e.target !== bell) {
            dropdown.classList.remove("open");
        }
    });

    loadNotifications();
});

function getDismissedIds() {
    try {
        return JSON.parse(localStorage.getItem("dismissedNotifIds") || "[]");
    } catch {
        return [];
    }
}

function setDismissedIds(ids) {
    localStorage.setItem("dismissedNotifIds", JSON.stringify(ids));
}

async function loadNotifications() {
    const list = document.getElementById("notifList");
    const badge = document.getElementById("notifBadge");
    if (!list || !badge) return;

    try {
        const response = await fetch(`${API_URL}/tasks`, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            }
        });
        if (!response.ok) throw new Error("Failed to load tasks");
        const tasks = await response.json();

        // close deadlines = overdue or due within 3 days
        notifTasks = tasks.filter(t => t.daysUntil <= 3).sort((a, b) => a.daysUntil - b.daysUntil);

        renderNotifList();
        updateBadge();
    } catch (err) {
        console.error("Error loading notifications:", err);
        list.innerHTML = '<div class="notif-empty">Could not load notifications.</div>';
    }
}

function renderNotifList() {
    const list = document.getElementById("notifList");
    const dismissed = new Set(getDismissedIds());
    const visible = notifTasks.filter(t => !dismissed.has(t.id));

    if (visible.length === 0) {
        list.innerHTML = '<div class="notif-empty">Nothing urgent right now.</div>';
        return;
    }

    list.innerHTML = visible.map(t => {
        const days = t.daysUntil;
        let sub, dotClass;
        if (days < 0) {
            sub = `Overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""}`;
            dotClass = "urgent";
        } else if (days === 0) {
            sub = "Due today";
            dotClass = "urgent";
        } else {
            sub = `Due in ${days} day${days !== 1 ? "s" : ""}`;
            dotClass = days <= 1 ? "urgent" : "soon";
        }
        if (t.gradeWeight) sub += ` · ${t.gradeWeight}% of grade`;

        return `
            <div class="notif-item">
                <div class="notif-dot ${dotClass}"></div>
                <div class="notif-text">
                    <div class="notif-title">${escapeNotifHtml(t.module)}</div>
                    <div class="notif-sub">${sub}</div>
                </div>
            </div>
        `;
    }).join("");
}

// badge = undismissed + unseen; opening the bell marks items seen, Clear all dismisses them
function updateBadge() {
    const badge = document.getElementById("notifBadge");
    if (!badge) return;
    const dismissed = new Set(getDismissedIds());
    const seen = new Set(getSeenIds());
    const unseenCount = notifTasks.filter(t => !dismissed.has(t.id) && !seen.has(t.id)).length;

    if (unseenCount === 0) {
        badge.style.display = "none";
    } else {
        badge.style.display = "flex";
        badge.textContent = unseenCount > 9 ? "9+" : unseenCount;
    }
}

function getSeenIds() {
    try {
        return JSON.parse(localStorage.getItem("seenNotifIds") || "[]");
    } catch {
        return [];
    }
}

function markNotificationsSeen() {
    const ids = notifTasks.map(t => t.id);
    setSeenIds(ids);
    updateBadge();
}

function setSeenIds(ids) {
    localStorage.setItem("seenNotifIds", JSON.stringify(ids));
}

function clearAllNotifications() {
    const dismissed = new Set(getDismissedIds());
    notifTasks.forEach(t => dismissed.add(t.id));
    setDismissedIds(Array.from(dismissed));
    renderNotifList();
    updateBadge();
}

function escapeNotifHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
}
