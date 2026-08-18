// ============================================================
// settings.js — account settings: display name + reminder preferences
// ============================================================

const token = localStorage.getItem("token");
if (!token) {
    window.location.href = "login.html";
}

window.addEventListener("load", () => {
    const name = localStorage.getItem("userName") || "Student";
    document.getElementById("avatarInitial").textContent = name.trim().charAt(0).toUpperCase() || "S";
    document.getElementById("logoutBtn").addEventListener("click", logout);
    document.getElementById("profileForm").addEventListener("submit", saveProfile);
    document.getElementById("passwordForm").addEventListener("submit", changePassword);
    document.getElementById("reminderForm").addEventListener("submit", saveReminders);

    loadAccount();
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

async function loadAccount() {
    try {
        const response = await fetch(`${API_URL}/account`, { headers: authHeaders() });
        if (!response.ok) throw new Error("Failed to load account");
        const data = await response.json();

        document.getElementById("settingsName").value = data.name || "";
        document.getElementById("settingsEmail").value = data.email || "";
        document.getElementById("remindersEnabled").checked = data.remindersEnabled !== false;
        document.getElementById("reminderDaysBefore").value = data.reminderDaysBefore || 3;
    } catch (err) {
        console.error("Error loading account:", err);
        showStatus("Could not load account settings.", "error");
    }
}

async function saveProfile(event) {
    event.preventDefault();
    const btn = document.getElementById("profileSaveBtn");
    btn.disabled = true;

    const name = document.getElementById("settingsName").value.trim();

    try {
        const response = await fetch(`${API_URL}/account`, {
            method: "PATCH",
            headers: authHeaders(),
            body: JSON.stringify({ name })
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || "Failed to save profile");
        }
        const data = await response.json();
        localStorage.setItem("userName", data.name);
        document.getElementById("avatarInitial").textContent = data.name.trim().charAt(0).toUpperCase() || "S";
        showStatus("Profile updated.", "success");
    } catch (err) {
        console.error("Error saving profile:", err);
        showStatus("Could not save: " + err.message, "error");
    } finally {
        btn.disabled = false;
    }
}

async function changePassword(event) {
    event.preventDefault();
    const btn = document.getElementById("passwordSaveBtn");
    btn.disabled = true;

    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPassword").value;

    try {
        const response = await fetch(`${API_URL}/account/password`, {
            method: "PATCH",
            headers: authHeaders(),
            body: JSON.stringify({ currentPassword, newPassword })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || "Failed to update password");
        }

        // The backend rotates the session token on password change, so we
        // need to update localStorage or the next API call will 401.
        if (data.token) localStorage.setItem("token", data.token);

        document.getElementById("passwordForm").reset();
        showStatus("Password updated.", "success");
    } catch (err) {
        console.error("Error changing password:", err);
        showStatus("Could not update password: " + err.message, "error");
    } finally {
        btn.disabled = false;
    }
}

async function saveReminders(event) {
    event.preventDefault();
    const btn = document.getElementById("reminderSaveBtn");
    btn.disabled = true;

    const remindersEnabled = document.getElementById("remindersEnabled").checked;
    const reminderDaysBefore = Number(document.getElementById("reminderDaysBefore").value) || 3;

    try {
        const response = await fetch(`${API_URL}/account`, {
            method: "PATCH",
            headers: authHeaders(),
            body: JSON.stringify({ remindersEnabled, reminderDaysBefore })
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || "Failed to save preferences");
        }
        showStatus("Reminder preferences updated.", "success");
    } catch (err) {
        console.error("Error saving reminder prefs:", err);
        showStatus("Could not save: " + err.message, "error");
    } finally {
        btn.disabled = false;
    }
}

function showStatus(msg, type) {
    const el = document.getElementById("settingsStatusMsg");
    el.textContent = msg;
    el.className = "status-msg " + type;
    setTimeout(() => { el.style.display = "none"; }, 3000);
}
