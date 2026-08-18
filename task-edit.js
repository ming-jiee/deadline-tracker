// task-edit.js — shared edit modal for main.html and all-tasks.html
// Injects its own markup, calls window.onTaskEdited() after save/delete

(function () {
    const modalHtml = `
        <div class="modal-overlay" id="editModalOverlay">
            <div class="modal-card">
                <div class="modal-header">
                    <div class="card-title" style="margin:0;">Edit task</div>
                    <button class="modal-close" id="editModalClose">&times;</button>
                </div>
                <form id="editTaskForm">
                    <div class="field">
                        <label>Module</label>
                        <input type="text" id="editModule" required>
                    </div>
                    <div class="field-row">
                        <div class="field">
                            <label>Type</label>
                            <select id="editTaskType" required>
                                <option value="Assignment">Assignment</option>
                                <option value="Test">Test</option>
                                <option value="Project">Project</option>
                                <option value="Presentation">Presentation</option>
                            </select>
                        </div>
                        <div class="field">
                            <label>Deadline</label>
                            <input type="date" id="editDeadline" required>
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field">
                            <label>Grade %</label>
                            <input type="number" id="editGradeWeight" min="0" max="100">
                        </div>
                        <div class="field">
                            <label>Effort, hrs</label>
                            <input type="number" id="editEffort" min="0" step="0.5">
                        </div>
                    </div>
                    <div class="field">
                        <label>Difficulty <span style="font-weight:400;">(1-5)</span></label>
                        <input type="number" id="editDifficulty" min="1" max="5">
                    </div>
                    <div class="checkbox-row">
                        <input type="checkbox" id="editIsGroup"><label for="editIsGroup">Group task</label>
                    </div>
                    <button type="submit" class="btn-primary" id="editSaveBtn">Save changes</button>
                </form>
                <button class="btn-delete-permanent" id="editDeleteBtn">Delete task permanently</button>
                <div class="status-msg" id="editStatusMsg"></div>
            </div>
        </div>
    `;
    document.addEventListener("DOMContentLoaded", () => {
        document.body.insertAdjacentHTML("beforeend", modalHtml);

        document.getElementById("editModalClose").addEventListener("click", closeEditModal);
        document.getElementById("editModalOverlay").addEventListener("click", (e) => {
            if (e.target.id === "editModalOverlay") closeEditModal();
        });
        document.getElementById("editTaskForm").addEventListener("submit", saveEditedTask);
        document.getElementById("editDeleteBtn").addEventListener("click", deleteTaskPermanently);
    });

    let editingTaskId = null;

    window.openEditModal = function (task) {
        editingTaskId = task.id;
        document.getElementById("editModule").value = task.module || "";
        document.getElementById("editTaskType").value = task.taskType || "Assignment";
        document.getElementById("editDeadline").value = task.deadline || "";
        document.getElementById("editGradeWeight").value = task.gradeWeight || 0;
        document.getElementById("editEffort").value = task.effort || 1;
        document.getElementById("editDifficulty").value = task.difficulty || 3;
        document.getElementById("editIsGroup").checked = !!task.isGroup;
        document.getElementById("editStatusMsg").style.display = "none";
        document.getElementById("editModalOverlay").classList.add("open");
    };

    function closeEditModal() {
        document.getElementById("editModalOverlay").classList.remove("open");
        editingTaskId = null;
    }
    window.closeEditModal = closeEditModal;

    function authHeadersLocal() {
        return {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("token")}`
        };
    }

    async function saveEditedTask(event) {
        event.preventDefault();
        if (!editingTaskId) return;
        const btn = document.getElementById("editSaveBtn");
        btn.disabled = true;

        const payload = {
            module: document.getElementById("editModule").value,
            taskType: document.getElementById("editTaskType").value,
            deadline: document.getElementById("editDeadline").value,
            gradeWeight: Number(document.getElementById("editGradeWeight").value) || 0,
            effort: Number(document.getElementById("editEffort").value) || 1,
            difficulty: Number(document.getElementById("editDifficulty").value) || 3,
            isGroup: document.getElementById("editIsGroup").checked
        };

        try {
            const response = await fetch(`${API_URL}/tasks/${editingTaskId}`, {
                method: "PUT",
                headers: authHeadersLocal(),
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || "Failed to save changes");
            }
            closeEditModal();
            if (typeof window.onTaskEdited === "function") window.onTaskEdited();
        } catch (err) {
            console.error("Error saving task:", err);
            const el = document.getElementById("editStatusMsg");
            el.textContent = "Could not save: " + err.message;
            el.className = "status-msg error";
        } finally {
            btn.disabled = false;
        }
    }

    async function deleteTaskPermanently() {
        if (!editingTaskId) return;
        if (!confirm("Delete this task permanently? This can't be undone.")) return;

        try {
            const response = await fetch(`${API_URL}/tasks/${editingTaskId}/permanent`, {
                method: "DELETE",
                headers: authHeadersLocal()
            });
            if (!response.ok) throw new Error("Failed to delete task");
            closeEditModal();
            if (typeof window.onTaskEdited === "function") window.onTaskEdited();
        } catch (err) {
            console.error("Error deleting task:", err);
            alert("Could not delete task. Try again.");
        }
    }
})();
