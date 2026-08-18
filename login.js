// ============================================================
// login.js — sends Email/Password to AWS (POST /auth/login)
// ============================================================

document.getElementById("loginForm").addEventListener("submit", handleLogin);

async function handleLogin(e) {
    e.preventDefault();
    const submitBtn = document.getElementById("submitBtn");
    submitBtn.disabled = true;
    showStatus("Logging in...", "loading");

    const payload = {
        email: document.getElementById("email").value.trim().toLowerCase(),
        password: document.getElementById("password").value
    };

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
            showStatus(data.error || "Invalid email or password.", "error");
            submitBtn.disabled = false;
            return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("userName", data.name);
        localStorage.setItem("userEmail", data.email);

        showStatus("Logged in! Redirecting...", "success");
        setTimeout(() => { window.location.href = "main.html"; }, 500);
    } catch (err) {
        console.error("Login error:", err);
        showStatus("Could not connect to server. Try again.", "error");
        submitBtn.disabled = false;
    }
}

function showStatus(msg, type) {
    const el = document.getElementById("statusMsg");
    el.textContent = msg;
    el.className = "status-msg " + type;
}
