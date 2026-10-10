(() => {
  const tokenKey = "teamhub.token";
  let token = sessionStorage.getItem(tokenKey);
  if (!token) { location.replace("/login.html"); return; }
  const state = { user: null, view: "overview", workspaces: [], workspaceRoles: {}, selectedWorkspaceId: null, selectedWorkspace: null, workspaceRole: null, workspaceMembers: [], projects: [], tasks: [], board: {}, search: "", status: "", priority: "" };
  const content = document.getElementById("page-content");
  const dialog = document.getElementById("app-dialog");
  const form = document.getElementById("dialog-form");
  let submitAction = null;
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const initials = (value) => String(value || "U").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const dateLabel = (value) => value ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`)) : "No due date";
  const api = async (path, options = {}) => {
    const response = await fetch(`/api${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) { sessionStorage.removeItem(tokenKey); location.replace("/login.html"); }
    if (!response.ok) throw new Error(result.message || "The request could not be completed.");
    return result.data;
  };
  const toast = (message, kind = "success") => {
    const region = document.getElementById("toast-region");
    const node = document.createElement("div");
    node.className = `toast ${kind}`;
    node.textContent = message;
    region.append(node);
    window.setTimeout(() => node.remove(), 3400);
  };
  const showError = (error) => { content.innerHTML = `<section class="empty-state"><span class="empty-icon">!</span><h2>We couldn’t load that</h2><p>${escape(error.message)}</p><button class="button button-primary" data-action="reload-view">Try again</button></section>`; };
  const setHeader = (title) => { document.getElementById("breadcrumb-current").textContent = title; };
  const statusLabel = (status) => ({ todo: "To do", in_progress: "In progress", review: "In review", completed: "Completed", planning: "Planning", active: "Active", on_hold: "On hold" }[status] || status);
  const statusClass = (status) => String(status || "").replaceAll("_", "-");
  const empty = (icon, title, message, button = "") => `<div class="empty-state"><span class="empty-icon">${icon}</span><h3>${title}</h3><p>${message}</p>${button}</div>`;
  const statCard = (label, value, note, icon, tint = "violet") => `<article class="stat-card"><div class="stat-icon ${tint}">${icon}</div><span>${label}</span><strong>${value ?? 0}</strong><small>${note}</small></article>`;
  const workspaceCard = (workspace) => `<article class="workspace-card"><div class="workspace-card-top"><div class="workspace-glyph">${escape(initials(workspace.name))}</div><span class="status-pill status-active">${workspace.ownerId === state.user.id ? "Owner" : "Member"}</span></div><h3>${escape(workspace.name)}</h3><p>${escape(workspace.description || "A shared place for this team's work.")}</p><div class="workspace-card-foot"><span><i class="tiny-dot"></i>${escape(workspace.owner?.name || "Team space")}</span><button class="button button-quiet button-small" data-action="open-workspace" data-id="${workspace.id}">Open workspace <span>→</span></button></div></article>`;
  const taskRow = (task, compact = false) => {
    const role = state.workspaceRoles[task.project?.workspaceId] || (task.project?.workspaceId === state.selectedWorkspaceId ? state.workspaceRole : null);
    const canManage = state.user.role === "admin" || ["owner", "manager"].includes(role);
    const canChange = task.assignedTo === state.user.id || canManage;
    const statuses = ["todo", "in_progress", "review", "completed"];
    const status = canChange ? `<select class="inline-status status-${statusClass(task.status)}" data-action="task-status" data-id="${task.id}" aria-label="Update status for ${escape(task.title)}">${statuses.map((s) => `<option value="${s}" ${task.status === s ? "selected" : ""}>${statusLabel(s)}</option>`).join("")}</select>` : `<span class="status-pill status-${statusClass(task.status)}">${statusLabel(task.status)}</span>`;
    const controls = `<div class="task-controls">${status}${canManage ? `<button class="icon-button task-edit" data-action="edit-task" data-id="${task.id}" title="Edit task" aria-label="Edit ${escape(task.title)}">✎</button><button class="icon-button task-delete" data-action="delete-task" data-id="${task.id}" title="Delete task" aria-label="Delete ${escape(task.title)}">×</button>` : ""}</div>`;
    return `<article class="task-row ${compact ? "compact" : ""}"><div class="task-main"><span class="task-check ${task.status === "completed" ? "checked" : ""}">${task.status === "completed" ? "✓" : ""}</span><div><b>${escape(task.title)}</b><small>${escape(task.project?.name || "Task")} · ${escape(task.assignee?.name || "Unassigned")}</small></div></div><span class="priority-pill priority-${escape(task.priority)}"><i></i>${escape(task.priority)}</span><span class="due-label">${escape(dateLabel(task.dueDate))}</span>${controls}</article>`;
  };
  const headerBlock = (eyebrow, title, description, action = "") => `<div class="page-heading"><div><span class="card-kicker">${eyebrow}</span><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
  function openDialog({ title, kicker = "TEAMHUB", submit = "Save", fields = [], onSubmit }) {
    document.getElementById("dialog-kicker").textContent = kicker;
    document.getElementById("dialog-title").textContent = title;
    document.getElementById("dialog-submit").textContent = submit;
    document.getElementById("dialog-fields").innerHTML = fields.map((field) => {
      const required = field.required ? "required" : "";
      const max = field.maxLength ? `maxlength="${field.maxLength}"` : "";
      if (field.type === "textarea") return `<label>${escape(field.label)}<textarea name="${escape(field.name)}" rows="4" ${required} ${max} placeholder="${escape(field.placeholder || "")}">${escape(field.value || "")}</textarea></label>`;
      if (field.type === "select") return `<label>${escape(field.label)}<select name="${escape(field.name)}" ${required}>${(field.options || []).map((option) => `<option value="${escape(option.value)}" ${String(field.value) === String(option.value) ? "selected" : ""}>${escape(option.label)}</option>`).join("")}</select></label>`;
      return `<label>${escape(field.label)}<input name="${escape(field.name)}" type="${escape(field.type || "text")}" value="${escape(field.value || "")}" ${required} ${max} placeholder="${escape(field.placeholder || "")}"></label>`;
    }).join("") + `<div class="dialog-error form-message" aria-live="polite"></div>`;
    submitAction = onSubmit;
    dialog.showModal();
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!submitAction) return;
    const button = document.getElementById("dialog-submit");
    button.disabled = true;
    const payload = Object.fromEntries(new FormData(form).entries());
    try { await submitAction(payload); dialog.close(); }
    catch (error) { const box = form.querySelector(".dialog-error"); box.textContent = error.message; box.classList.add("error"); }
    finally { button.disabled = false; }
  });
  const closeDialog = () => dialog.close();
  document.getElementById("dialog-close").addEventListener("click", closeDialog);
  document.getElementById("dialog-cancel").addEventListener("click", closeDialog);

  async function loadBase() {
    const profile = await api("/auth/profile");
    state.user = profile.user;
    const [workspaces, dashboard, tasks] = await Promise.all([api("/workspaces"), api("/user/dashboard"), api(`/tasks?assignedTo=${state.user.id}&limit=100&sortBy=dueDate&order=asc`)]);
    state.workspaces = workspaces.workspaces;
    state.workspaceRoles = Object.fromEntries(state.workspaces.map((workspace) => [workspace.id, workspace.workspaceRole]));
    state.summary = dashboard.summary;
    state.myTasks = tasks.tasks;
    state.selectedWorkspaceId = state.selectedWorkspaceId && state.workspaces.some((w) => w.id === state.selectedWorkspaceId) ? state.selectedWorkspaceId : null;
    document.getElementById("user-name").textContent = state.user.name;
    document.getElementById("user-role").textContent = state.user.role;
    document.getElementById("user-initials").textContent = initials(state.user.name);
    document.getElementById("task-count-badge").textContent = state.myTasks.filter((task) => task.status !== "completed").length;
    document.querySelectorAll(".admin-only").forEach((node) => node.classList.toggle("hidden", state.user.role !== "admin"));
  }

  async function renderOverview() {
    setHeader("Overview");
    const tasks = state.myTasks.slice(0, 5);
    content.innerHTML = `${headerBlock(`GOOD ${new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(new Date()).toUpperCase()}`, `Hello, ${escape(state.user.name.split(" ")[0])} <span class="wave">✦</span>`, "Here’s what’s happening across your team today.", `<button class="button button-primary" data-action="create-workspace">＋ New workspace</button>`)}<section class="stats-grid">${statCard("Workspaces", state.summary.workspaces, "Spaces you can access", "◈", "violet")}${statCard("Projects", state.summary.projects, "Across your workspaces", "▧", "peach")}${statCard("My open tasks", state.summary.myTasks, "Assigned to you", "☷", "mint")}${statCard("Completed tasks", state.summary.completed, "Team-wide progress", "✓", "blue")}</section><section class="content-grid"><div class="panel task-panel"><div class="panel-heading"><div><span class="card-kicker">YOUR FOCUS</span><h2>My tasks</h2></div><button class="text-button" data-view="tasks">See all <span>→</span></button></div>${tasks.length ? tasks.map((task) => taskRow(task, true)).join("") : empty("☷", "A little breathing room", "Tasks assigned to you will appear here.")}</div><div class="panel workspace-panel"><div class="panel-heading"><div><span class="card-kicker">YOUR TEAM</span><h2>Workspaces</h2></div><button class="text-button" data-view="workspaces">View all <span>→</span></button></div>${state.workspaces.length ? state.workspaces.slice(0, 3).map((workspace) => `<button class="workspace-mini" data-action="open-workspace" data-id="${workspace.id}"><span class="workspace-glyph">${escape(initials(workspace.name))}</span><span><b>${escape(workspace.name)}</b><small>${escape(workspace.description || "Shared workspace")}</small></span><span class="mini-arrow">↗</span></button>`).join("") : empty("◈", "Start a workspace", "Create a shared home for your next project.", `<button class="button button-primary button-small" data-action="create-workspace">Create workspace</button>`)}</div></section>`;
  }

  async function loadWorkspace(id) {
    state.selectedWorkspaceId = Number(id);
    const [details, projects] = await Promise.all([api(`/workspaces/${id}`), api(`/workspaces/${id}/projects?limit=100`)]);
    state.selectedWorkspace = details.workspace;
    state.workspaceMembers = details.members;
    const memberRole = details.members.find((member) => member.id === state.user.id)?.workspaceRole;
    state.workspaceRole = state.user.role === "admin" ? "admin" : state.user.role === "manager" && memberRole === "member" ? "manager" : memberRole || null;
    state.projects = projects.projects;
    await renderWorkspaces();
  }

  async function renderWorkspaces() {
    setHeader("Workspaces");
    if (!state.selectedWorkspaceId) {
      content.innerHTML = `${headerBlock("YOUR TEAM SPACES", "Workspaces", "Organize people and projects in one shared space.", `<button class="button button-primary" data-action="create-workspace">＋ New workspace</button>`)}<div class="workspace-grid">${state.workspaces.length ? state.workspaces.map(workspaceCard).join("") : empty("◈", "No workspaces yet", "Create a workspace and invite teammates to get started.", `<button class="button button-primary" data-action="create-workspace">Create workspace</button>`)}</div>`;
      return;
    }
    const workspace = state.selectedWorkspace;
    const isLead = ["owner", "manager", "admin"].includes(state.workspaceRole);
    const isOwner = ["owner", "admin"].includes(state.workspaceRole);
    const projects = state.projects.map((project) => `<article class="project-card"><div class="project-card-top"><span class="project-symbol">▧</span><span class="status-pill status-${statusClass(project.status)}">${statusLabel(project.status)}</span></div><h3>${escape(project.name)}</h3><p>${escape(project.description || "No project description yet.")}</p><div class="project-meta"><span>◷ ${escape(dateLabel(project.deadline))}</span><span>Created by ${escape(project.creator?.name || "teammate")}</span></div>${isLead ? `<div class="project-actions"><button class="text-button" data-action="create-task" data-project="${project.id}">＋ Add task</button><button class="text-button" data-action="edit-project" data-id="${project.id}">Edit</button><button class="text-button danger-text" data-action="delete-project" data-id="${project.id}">Delete</button></div>` : ""}</article>`).join("");
    const members = state.workspaceMembers.map((member) => {
      const canRemove = isLead && member.workspaceRole !== "owner" && (state.workspaceRole !== "manager" || member.workspaceRole === "member");
      const canChangeRole = isOwner && member.workspaceRole !== "owner";
      const roleControl = canChangeRole ? `<select class="member-role-select" data-action="member-role" data-user="${member.id}" aria-label="Role for ${escape(member.name)}"><option value="member" ${member.workspaceRole === "member" ? "selected" : ""}>Member</option><option value="manager" ${member.workspaceRole === "manager" ? "selected" : ""}>Manager</option></select>` : `<span class="role-tag">${escape(member.workspaceRole)}</span>`;
      const transfer = isOwner && member.workspaceRole !== "owner" ? `<button class="text-button" data-action="transfer-owner" data-user="${member.id}">Make owner</button>` : "";
      return `<div class="member-row"><span class="user-avatar avatar-small">${escape(initials(member.name))}</span><span><b>${escape(member.name)}</b><small>${escape(member.email)}</small></span>${roleControl}${transfer}${canRemove ? `<button class="icon-button member-remove" data-action="remove-member" data-user="${member.id}" title="Remove member" aria-label="Remove ${escape(member.name)}">×</button>` : `<span></span>`}</div>`;
    }).join("");
    const headerActions = `${isOwner ? `<button class="button button-quiet" data-action="edit-workspace">Edit details</button>` : ""}${isLead ? `<button class="button button-primary" data-action="create-project">＋ New project</button>` : ""}`;
    const workspaceDelete = isOwner ? `<div class="workspace-danger-zone"><span>Workspace settings</span><button class="text-button danger-text" data-action="delete-workspace">Delete workspace</button></div>` : "";
    content.innerHTML = `<div class="back-row"><button class="text-button" data-action="back-workspaces">← All workspaces</button></div>${headerBlock("WORKSPACE", escape(workspace.name), escape(workspace.description || "A shared space for this team’s projects."), headerActions)}<section class="workspace-detail-grid"><div class="panel project-panel"><div class="panel-heading"><div><span class="card-kicker">BUILD TOGETHER</span><h2>Projects <span class="count-chip">${state.projects.length}</span></h2></div></div><div class="project-grid">${projects || empty("▧", "No projects yet", isLead ? "Create a project to give your team a clear goal." : "Projects created in this workspace will appear here.", isLead ? `<button class="button button-primary button-small" data-action="create-project">New project</button>` : "")}</div>${workspaceDelete}</div><div class="panel member-panel"><div class="panel-heading"><div><span class="card-kicker">THE PEOPLE</span><h2>Members <span class="count-chip">${state.workspaceMembers.length}</span></h2></div>${isLead ? `<button class="icon-button add-member" data-action="add-member" title="Add member" aria-label="Add member">＋</button>` : ""}</div><div class="member-list">${members}</div><div class="permission-note"><span>◈</span> Workspace roles control who can manage projects and invite teammates.</div></div></section>`;
  }

  async function renderTasks() {
    setHeader("My tasks");
    const params = new URLSearchParams({ page: "1", limit: "100", sortBy: "dueDate", order: "asc", assignedTo: String(state.user.id) });
    if (state.search) params.set("search", state.search);
    if (state.status) params.set("status", state.status);
    if (state.priority) params.set("priority", state.priority);
    const data = await api(`/tasks?${params.toString()}`);
    state.tasks = data.tasks;
    const cards = state.tasks.map((task) => taskRow(task)).join("");
    content.innerHTML = `${headerBlock("KEEP YOUR MOMENTUM", "My tasks", "See what’s moving and update the work assigned to you.")}<section class="panel task-list-panel"><div class="filter-bar"><label class="search-input"><span>⌕</span><input id="task-search" value="${escape(state.search)}" placeholder="Search tasks"></label><select id="task-status-filter"><option value="">All statuses</option>${["todo", "in_progress", "review", "completed"].map((s) => `<option value="${s}" ${state.status === s ? "selected" : ""}>${statusLabel(s)}</option>`).join("")}</select><select id="task-priority-filter"><option value="">All priorities</option>${["low", "medium", "high", "urgent"].map((p) => `<option value="${p}" ${state.priority === p ? "selected" : ""}>${p[0].toUpperCase() + p.slice(1)}</option>`).join("")}</select></div><div class="task-table-head"><span>TASK</span><span>PRIORITY</span><span>DUE DATE</span><span>STATUS</span></div><div id="task-list">${cards || empty("☷", "No tasks match", "Try a different search or filter.")}</div></section>`;
    document.getElementById("task-search").addEventListener("input", debounce((event) => { state.search = event.target.value.trim(); renderTasks().catch(showError); }, 220));
    document.getElementById("task-status-filter").addEventListener("change", (event) => { state.status = event.target.value; renderTasks().catch(showError); });
    document.getElementById("task-priority-filter").addEventListener("change", (event) => { state.priority = event.target.value; renderTasks().catch(showError); });
  }

  async function renderBoard() {
    setHeader("Team board");
    const workspaceOptions = state.workspaces.map((workspace) => `<option value="${workspace.id}" ${String(state.selectedWorkspaceId || "") === String(workspace.id) ? "selected" : ""}>${escape(workspace.name)}</option>`).join("");
    const query = state.selectedWorkspaceId ? `?workspaceId=${state.selectedWorkspaceId}` : "";
    const data = await api(`/tasks/board${query}`);
    state.board = data.board;
    const statuses = ["todo", "in_progress", "review", "completed"];
    const columns = statuses.map((status) => {
      const tasks = state.board[status] || [];
      const cards = tasks.map((task) => {
        const role = state.workspaceRoles[task.project?.workspaceId];
        const canManage = state.user.role === "admin" || ["owner", "manager"].includes(role);
        const canChange = task.assignedTo === state.user.id || canManage;
        const statusControl = canChange ? `<select class="inline-status status-${statusClass(task.status)}" data-action="task-status" data-id="${task.id}" aria-label="Move ${escape(task.title)}">${statuses.map((value) => `<option value="${value}" ${value === task.status ? "selected" : ""}>${statusLabel(value)}</option>`).join("")}</select>` : "";
        return `<article class="kanban-card"><div class="kanban-card-top"><span class="priority-pill priority-${escape(task.priority)}"><i></i>${escape(task.priority)}</span><span class="kanban-due">${escape(dateLabel(task.dueDate))}</span></div><h3>${escape(task.title)}</h3><p>${escape(task.project?.name || "Project")}</p><div class="kanban-card-bottom"><span class="kanban-assignee"><i class="user-avatar avatar-small">${escape(initials(task.assignee?.name || "Unassigned"))}</i>${escape(task.assignee?.name || "Unassigned")}</span>${statusControl}</div>${canManage ? `<div class="kanban-actions"><button class="text-button" data-action="edit-task" data-id="${task.id}">Edit task</button><button class="text-button danger-text" data-action="delete-task" data-id="${task.id}">Delete</button></div>` : ""}</article>`;
      }).join("");
      return `<section class="kanban-column"><div class="kanban-column-head"><h2>${statusLabel(status)}</h2><span class="count-chip">${tasks.length}</span></div><div class="kanban-card-list">${cards || `<div class="kanban-empty">No tasks here</div>`}</div></section>`;
    }).join("");
    content.innerHTML = `${headerBlock("TEAM PROGRESS", "Team board", "Track tasks across your workspaces and move work forward.", `<label class="board-workspace-filter"><span>Workspace</span><select id="board-workspace"><option value="">All workspaces</option>${workspaceOptions}</select></label>`)}<div class="kanban-board">${columns}</div>`;
    document.getElementById("board-workspace").addEventListener("change", (event) => {
      state.selectedWorkspaceId = event.target.value ? Number(event.target.value) : null;
      renderBoard().catch(showError);
    });
  }

  function renderProfile() {
    setHeader("Profile");
    content.innerHTML = `${headerBlock("YOUR DETAILS", "Profile", "Manage your account and keep your sign-in secure.")}<section class="profile-grid"><div class="panel profile-card"><div class="profile-hero"><span class="profile-avatar">${escape(initials(state.user.name))}</span><div><h2>${escape(state.user.name)}</h2><p>${escape(state.user.email)}</p></div></div><div class="profile-detail"><span>Account role</span><b class="role-tag">${escape(state.user.role)}</b></div><div class="profile-detail"><span>Member since</span><b>${escape(dateLabel(String(state.user.createdAt || "").slice(0, 10)))}</b></div><button class="button button-quiet" data-action="edit-profile">Edit profile</button></div><div class="panel security-card"><span class="security-icon">⌑</span><span class="card-kicker">ACCOUNT SECURITY</span><h2>Keep your account safe</h2><p>Choose a strong password you don’t use anywhere else.</p><button class="button button-primary" data-action="change-password">Change password</button></div></section>`;
  }

  async function renderAdmin() {
    setHeader("Admin");
    const [dashboard, result] = await Promise.all([api("/admin/dashboard"), api("/admin/users?page=1&limit=100")]);
    const users = result.users;
    content.innerHTML = `${headerBlock("ADMINISTRATION", "Team overview", "Manage TeamHub accounts and review workspace activity.")}<section class="stats-grid admin-stats">${statCard("Users", dashboard.summary.users, "Registered accounts", "♙", "violet")}${statCard("Workspaces", dashboard.summary.workspaces, "Shared team spaces", "◈", "peach")}${statCard("Projects", dashboard.summary.projects, "Active and completed", "▧", "mint")}${statCard("Completed tasks", dashboard.summary.completedTasks, `Of ${dashboard.summary.tasks} total tasks`, "✓", "blue")}</section><section class="panel admin-user-panel"><div class="panel-heading"><div><span class="card-kicker">ACCESS CONTROL</span><h2>Users</h2></div><span class="count-chip">${users.length} accounts</span></div><div class="admin-table-head"><span>PERSON</span><span>EMAIL</span><span>GLOBAL ROLE</span><span>JOINED</span></div>${users.map((user) => `<div class="admin-user-row"><span class="admin-person"><i class="user-avatar avatar-small">${escape(initials(user.name))}</i><b>${escape(user.name)}</b></span><span>${escape(user.email)}</span><select data-action="user-role" data-id="${user.id}" ${user.id === state.user.id ? "disabled title='You cannot change your own administrator role here'" : ""}>${["admin", "manager", "member"].map((role) => `<option value="${role}" ${user.role === role ? "selected" : ""}>${role[0].toUpperCase() + role.slice(1)}</option>`).join("")}</select><span>${escape(dateLabel(String(user.createdAt || "").slice(0, 10)))}</span></div>`).join("")}</section>`;
  }

  async function render() {
    try {
      await loadBase();
      if (state.view === "overview") await renderOverview();
      else if (state.view === "workspaces") await renderWorkspaces();
      else if (state.view === "tasks") await renderTasks();
      else if (state.view === "board") await renderBoard();
      else if (state.view === "profile") renderProfile();
      else if (state.view === "admin" && state.user.role === "admin") await renderAdmin();
      else { state.view = "overview"; await renderOverview(); }
      document.querySelectorAll(".nav-item").forEach((node) => node.classList.toggle("active", node.dataset.view === state.view));
    } catch (error) { showError(error); }
  }
  const debounce = (callback, wait) => { let timeout; return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => callback(...args), wait); }; };
  const createWorkspace = () => openDialog({ title: "Create a workspace", kicker: "A PLACE FOR YOUR TEAM", submit: "Create workspace", fields: [{ name: "name", label: "Workspace name", required: true, maxLength: 80, placeholder: "e.g. Design team" }, { name: "description", label: "Description", type: "textarea", placeholder: "What is this workspace for?" }], onSubmit: async (values) => { await api("/workspaces", { method: "POST", body: JSON.stringify(values) }); toast("Workspace created."); state.selectedWorkspaceId = null; state.view = "workspaces"; await render(); } });
  const createProject = () => openDialog({ title: "Create a project", kicker: state.selectedWorkspace?.name || "WORKSPACE PROJECT", submit: "Create project", fields: [{ name: "name", label: "Project name", required: true, maxLength: 100, placeholder: "e.g. Website refresh" }, { name: "description", label: "Description", type: "textarea", placeholder: "A short overview of the project" }, { name: "status", label: "Status", type: "select", value: "planning", options: [{ value: "planning", label: "Planning" }, { value: "active", label: "Active" }, { value: "on_hold", label: "On hold" }, { value: "completed", label: "Completed" }] }, { name: "deadline", label: "Deadline", type: "date" }], onSubmit: async (values) => { values.deadline = values.deadline || null; await api(`/workspaces/${state.selectedWorkspaceId}/projects`, { method: "POST", body: JSON.stringify(values) }); toast("Project created."); await loadWorkspace(state.selectedWorkspaceId); } });
  const createTask = (projectId) => openDialog({ title: "Add a task", kicker: "MAKE THE NEXT STEP CLEAR", submit: "Create task", fields: [{ name: "title", label: "Task title", required: true, maxLength: 160, placeholder: "What needs to be done?" }, { name: "description", label: "Description", type: "textarea", placeholder: "Add useful context" }, { name: "priority", label: "Priority", type: "select", value: "medium", options: ["low", "medium", "high", "urgent"].map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) })) }, { name: "dueDate", label: "Due date", type: "date" }, { name: "assignedTo", label: "Assign to", type: "select", value: "", options: [{ value: "", label: "Unassigned" }, ...state.workspaceMembers.map((member) => ({ value: String(member.id), label: member.name }))] }], onSubmit: async (values) => { values.dueDate = values.dueDate || null; values.assignedTo = values.assignedTo ? Number(values.assignedTo) : null; await api(`/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify(values) }); toast("Task created."); await loadWorkspace(state.selectedWorkspaceId); } });
  const addMember = () => openDialog({ title: "Invite a teammate", kicker: state.selectedWorkspace?.name || "WORKSPACE MEMBERS", submit: "Add teammate", fields: [{ name: "email", label: "Their account email", type: "email", required: true, placeholder: "teammate@company.com" }, { name: "role", label: "Workspace role", type: "select", value: "member", options: [{ value: "member", label: "Member — work on projects and tasks" }, ...(state.workspaceRole === "manager" ? [] : [{ value: "manager", label: "Manager — manage projects and members" }])] }], onSubmit: async (values) => { await api(`/workspaces/${state.selectedWorkspaceId}/members`, { method: "POST", body: JSON.stringify(values) }); toast("Teammate added."); await loadWorkspace(state.selectedWorkspaceId); } });
  const editWorkspace = () => openDialog({ title: "Edit workspace", kicker: "WORKSPACE DETAILS", submit: "Save changes", fields: [{ name: "name", label: "Workspace name", required: true, maxLength: 80, value: state.selectedWorkspace.name }, { name: "description", label: "Description", type: "textarea", value: state.selectedWorkspace.description || "" }], onSubmit: async (values) => { await api(`/workspaces/${state.selectedWorkspaceId}`, { method: "PATCH", body: JSON.stringify(values) }); toast("Workspace updated."); await loadWorkspace(state.selectedWorkspaceId); } });
  const editProject = (projectId) => {
    const project = state.projects.find((item) => item.id === projectId);
    if (!project) return;
    openDialog({ title: "Edit project", kicker: "PROJECT DETAILS", submit: "Save project", fields: [{ name: "name", label: "Project name", required: true, maxLength: 100, value: project.name }, { name: "description", label: "Description", type: "textarea", value: project.description || "" }, { name: "status", label: "Status", type: "select", value: project.status, options: [{ value: "planning", label: "Planning" }, { value: "active", label: "Active" }, { value: "on_hold", label: "On hold" }, { value: "completed", label: "Completed" }] }, { name: "deadline", label: "Deadline", type: "date", value: project.deadline || "" }], onSubmit: async (values) => { values.deadline = values.deadline || null; await api(`/projects/${projectId}`, { method: "PATCH", body: JSON.stringify(values) }); toast("Project updated."); await loadWorkspace(state.selectedWorkspaceId); } });
  };
  const editTask = async (taskId) => {
    const { task } = await api(`/tasks/${taskId}`);
    const members = state.workspaceMembers.length && task.project?.workspaceId === state.selectedWorkspaceId ? state.workspaceMembers : (await api(`/workspaces/${task.project.workspaceId}`)).members;
    openDialog({ title: "Edit task", kicker: task.project?.name || "TASK DETAILS", submit: "Save task", fields: [{ name: "title", label: "Task title", required: true, maxLength: 160, value: task.title }, { name: "description", label: "Description", type: "textarea", value: task.description || "" }, { name: "priority", label: "Priority", type: "select", value: task.priority, options: ["low", "medium", "high", "urgent"].map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) })) }, { name: "dueDate", label: "Due date", type: "date", value: task.dueDate || "" }, { name: "assignedTo", label: "Assign to", type: "select", value: task.assignedTo ? String(task.assignedTo) : "", options: [{ value: "", label: "Unassigned" }, ...members.map((member) => ({ value: String(member.id), label: member.name }))] }], onSubmit: async (values) => { values.dueDate = values.dueDate || null; values.assignedTo = values.assignedTo ? Number(values.assignedTo) : null; await api(`/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(values) }); toast("Task updated."); await render(); } });
  };
  const changeMemberRole = async (memberId, role) => { await api(`/workspaces/${state.selectedWorkspaceId}/members/${memberId}`, { method: "PATCH", body: JSON.stringify({ role }) }); toast("Workspace role updated."); await loadWorkspace(state.selectedWorkspaceId); };
  const editProfile = () => openDialog({ title: "Edit your profile", kicker: "YOUR ACCOUNT", submit: "Save profile", fields: [{ name: "name", label: "Name", required: true, maxLength: 80, value: state.user.name }, { name: "email", label: "Email address", type: "email", required: true, value: state.user.email }], onSubmit: async (values) => { const result = await api("/auth/profile", { method: "PATCH", body: JSON.stringify(values) }); state.user = result.user; toast("Profile updated."); await render(); } });
  const changePassword = () => openDialog({ title: "Change your password", kicker: "ACCOUNT SECURITY", submit: "Update password", fields: [{ name: "currentPassword", label: "Current password", type: "password", required: true }, { name: "newPassword", label: "New password", type: "password", required: true }], onSubmit: async (values) => { await api("/auth/change-password", { method: "POST", body: JSON.stringify(values) }); sessionStorage.removeItem(tokenKey); toast("Password updated. Sign in again."); setTimeout(() => location.replace("/login.html"), 900); } });

  document.addEventListener("click", async (event) => {
    const nav = event.target.closest("[data-view]");
    if (nav) { state.view = nav.dataset.view; state.selectedWorkspaceId = null; state.workspaceRole = null; await render(); return; }
    const action = event.target.closest("[data-action]");
    if (!action) { if (event.target.closest("#profile-chip")) { state.view = "profile"; await render(); } return; }
    try {
      const kind = action.dataset.action;
      if (kind === "create-workspace") createWorkspace();
      else if (kind === "create-project") createProject();
      else if (kind === "create-task") createTask(Number(action.dataset.project));
      else if (kind === "add-member") addMember();
      else if (kind === "edit-workspace") editWorkspace();
      else if (kind === "edit-project") editProject(Number(action.dataset.id));
      else if (kind === "edit-task") await editTask(Number(action.dataset.id));
      else if (kind === "edit-profile") editProfile();
      else if (kind === "change-password") changePassword();
      else if (kind === "open-workspace") { state.view = "workspaces"; await loadWorkspace(action.dataset.id); }
      else if (kind === "back-workspaces") { state.selectedWorkspaceId = null; state.selectedWorkspace = null; state.workspaceRole = null; await renderWorkspaces(); }
      else if (kind === "reload-view") await render();
      else if (kind === "delete-workspace") {
        if (!confirm(`Delete “${state.selectedWorkspace.name}” and all of its projects and tasks? This cannot be undone.`)) return;
        await api(`/workspaces/${state.selectedWorkspaceId}`, { method: "DELETE" });
        toast("Workspace deleted."); state.selectedWorkspaceId = null; state.selectedWorkspace = null; state.view = "workspaces"; await render();
      }
      else if (kind === "delete-project") {
        const project = state.projects.find((item) => item.id === Number(action.dataset.id));
        if (!project || !confirm(`Delete “${project.name}” and all of its tasks? This cannot be undone.`)) return;
        await api(`/projects/${project.id}`, { method: "DELETE" }); toast("Project deleted."); await loadWorkspace(state.selectedWorkspaceId);
      }
      else if (kind === "delete-task") {
        if (!confirm("Delete this task and its comments? This cannot be undone.")) return;
        await api(`/tasks/${action.dataset.id}`, { method: "DELETE" }); toast("Task deleted."); await render();
      }
      else if (kind === "transfer-owner") {
        const member = state.workspaceMembers.find((item) => item.id === Number(action.dataset.user));
        if (!member || !confirm(`Make ${member.name} the workspace owner? You will become a manager.`)) return;
        await api(`/workspaces/${state.selectedWorkspaceId}/transfer-ownership`, { method: "POST", body: JSON.stringify({ newOwnerId: member.id }) }); toast("Workspace ownership transferred."); await loadWorkspace(state.selectedWorkspaceId);
      }
      else if (kind === "remove-member") {
        if (!confirm("Remove this person from the workspace?")) return;
        await api(`/workspaces/${state.selectedWorkspaceId}/members/${action.dataset.user}`, { method: "DELETE" }); toast("Member removed."); await loadWorkspace(state.selectedWorkspaceId);
      }
    } catch (error) { toast(error.message, "error"); }
  });
  document.addEventListener("change", async (event) => {
    const target = event.target;
    if (target.dataset.action === "task-status") {
      try { await api(`/tasks/${target.dataset.id}/status`, { method: "PATCH", body: JSON.stringify({ status: target.value }) }); toast("Task status updated."); await render(); }
      catch (error) { toast(error.message, "error"); await render(); }
    }
    if (target.dataset.action === "user-role") {
      const previous = target.querySelector("option[selected]")?.value;
      try { await api(`/admin/users/${target.dataset.id}/role`, { method: "PATCH", body: JSON.stringify({ role: target.value }) }); toast("Account role updated."); await renderAdmin(); }
      catch (error) { toast(error.message, "error"); if (previous) target.value = previous; }
    }
    if (target.dataset.action === "member-role") {
      const previous = target.querySelector("option[selected]")?.value;
      try { await changeMemberRole(Number(target.dataset.user), target.value); }
      catch (error) { toast(error.message, "error"); if (previous) target.value = previous; }
    }
  });
  document.getElementById("logout-button").addEventListener("click", () => { sessionStorage.removeItem(tokenKey); location.replace("/login.html"); });
  document.getElementById("today-label").textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date());
  render();
})();
