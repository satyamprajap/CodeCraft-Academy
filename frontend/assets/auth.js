async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
function showMessage(message, type = "error") {
  const el = document.getElementById("message");
  if (el) {
    el.textContent = message;
    el.className = "message " + type;
  }
}
(async () => {
  try {
    await request("/api/auth/me");
    location.replace("/");
  } catch {}
})();
document.querySelectorAll("form[data-auth]").forEach((form) =>
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Please wait…";
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      await request(
        form.dataset.auth === "register"
          ? "/api/auth/register"
          : "/api/auth/login",
        { method: "POST", body: JSON.stringify(payload) },
      );
      location.replace("/");
    } catch (err) {
      showMessage(err.message);
      button.disabled = false;
      button.textContent =
        form.dataset.auth === "register" ? "Create account" : "Log in";
    }
  }),
);
