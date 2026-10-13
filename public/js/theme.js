(() => {
    const root = document.documentElement;
    const buttons = document.querySelectorAll("[data-theme-toggle]");
    const themeColor = document.querySelector('meta[name="theme-color"]');

    function applyTheme(theme, persist = false) {
        const isDark = theme === "dark";
        const selected = isDark ? "dark" : "light";
        const actionLabel = isDark ? "Switch to light theme" : "Switch to dark theme";

        root.dataset.theme = selected;
        buttons.forEach((button) => {
            button.setAttribute("aria-label", actionLabel);
            button.setAttribute("title", actionLabel);
            const icon = button.querySelector(".theme-icon");
            if (icon) icon.textContent = isDark ? "☀" : "☾";
        });

        if (themeColor) themeColor.content = isDark ? "#171622" : "#fbfafc";

        if (persist) {
            try {
                localStorage.setItem("teamhub-theme", selected);
            } catch {
                // Theme switching still works if storage is unavailable.
            }
        }
    }

    applyTheme(root.dataset.theme === "dark" ? "dark" : "light");

    buttons.forEach((button) => {
        button.addEventListener("click", () => {
            const current = root.dataset.theme === "dark" ? "dark" : "light";
            applyTheme(current === "dark" ? "light" : "dark", true);
        });
    });
})();
