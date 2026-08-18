// ============================================================
// signup.js — sends Name/Email/Password to AWS (POST /auth/signup)
// ============================================================

document.getElementById("signupForm").addEventListener("submit", handleSignup);

async function handleSignup(e) {
    e.preventDefault();
    const submitBtn = document.getElementById("submitBtn");
    submitBtn.disabled = true;
    showStatus("Creating your account...", "loading");

    const payload = {
        name: document.getElementById("name").value.trim(),
        email: document.getElementById("email").value.trim().toLowerCase(),
        password: document.getElementById("password").value
    };

    try {
        const res = await fetch(`${API_URL}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
            showStatus(data.error || "Could not create account.", "error");
            submitBtn.disabled = false;
            return;
        }

        // Save session token + user info, then go straight to dashboard
        localStorage.setItem("token", data.token);
        localStorage.setItem("userName", data.name);
        localStorage.setItem("userEmail", data.email);

        showStatus("Account created! Redirecting...", "success");
        setTimeout(() => { window.location.href = "main.html"; }, 800);
    } catch (err) {
        console.error("Signup error:", err);
        showStatus("Could not connect to server. Try again.", "error");
        submitBtn.disabled = false;
    }
}

function showStatus(msg, type) {
    const el = document.getElementById("statusMsg");
    el.textContent = msg;
    el.className = "status-msg " + type;
}
