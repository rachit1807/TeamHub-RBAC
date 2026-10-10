(() => {
  const API = "/api";
  const tokenKey = "teamhub.token";
  if (sessionStorage.getItem(tokenKey)) location.replace("/dashboard.html");
  const setMessage = (form, message, type = "error") => {
    const box = form.querySelector(".form-message");
    box.textContent = message;
    box.className = `form-message ${type}`;
  };
  async function request(path, body) {
    const response = await fetch(`${API}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Something went wrong. Please try again.");
    return result;
  }
  const loginForm = document.getElementById("login-form");
  if (loginForm) loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = loginForm.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      const data = new FormData(loginForm);
      const result = await request("/auth/login", { email: data.get("email"), password: data.get("password") });
      sessionStorage.setItem(tokenKey, result.data.token);
      location.replace("/dashboard.html");
    } catch (error) { setMessage(loginForm, error.message); button.disabled = false; }
  });
  const registerForm = document.getElementById("register-form");
  if (registerForm) registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = registerForm.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      const data = new FormData(registerForm);
      const payload = { name: data.get("name"), email: data.get("email"), password: data.get("password") };
      await request("/auth/register", payload);
      const login = await request("/auth/login", { email: payload.email, password: payload.password });
      sessionStorage.setItem(tokenKey, login.data.token);
      location.replace("/dashboard.html");
    } catch (error) { setMessage(registerForm, error.message); button.disabled = false; }
  });
})();
