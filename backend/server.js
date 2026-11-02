const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const frontendPath = path.join(__dirname, "../frontend");

app.use(express.static(frontendPath));

app.get("/about", (req, res) => {
  res.sendFile(path.join(frontendPath, "about.html"));
});
const PORT = process.env.PORT || 3000;
const FRONTEND = path.join(__dirname, "..", "frontend");
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "codecraft-data.json");
const SECRET = process.env.JWT_SECRET || "codecraft-local-development-secret";
fs.mkdirSync(DATA_DIR, { recursive: true });

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return { users: [], progress: [], nextUserId: 1 };
  }
}
let data = loadData();
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.created_at,
  };
}
function auth(req, res, next) {
  const token = req.cookies?.cc_token;
  if (!token) return res.status(401).json({ error: "Please log in first." });
  try {
    const payload = jwt.verify(token, SECRET);
    req.user = data.users.find((u) => u.id === Number(payload.sub));
    if (!req.user) return res.status(401).json({ error: "User not found." });
    next();
  } catch {
    return res
      .status(401)
      .json({ error: "Session expired. Please log in again." });
  }
}

app.disable("x-powered-by");
app.use(express.json());
app.use((req, res, next) => {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)cc_token=([^;]+)/);
  req.cookies = {};
  if (match) req.cookies.cc_token = decodeURIComponent(match[1]);
  next();
});
app.use("/assets", express.static(path.join(FRONTEND, "assets")));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.get("/login", (req, res) =>
  res.sendFile(path.join(FRONTEND, "login.html")),
);
app.get("/register", (req, res) =>
  res.sendFile(path.join(FRONTEND, "register.html")),
);

app.post("/api/auth/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");
    if (name.length < 2)
      return res.status(400).json({ error: "Please enter your name." });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return res.status(400).json({ error: "Enter a valid email." });
    if (password.length < 8)
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters." });
    if (data.users.some((u) => u.email === email))
      return res.status(409).json({ error: "Email is already registered." });

    const user = {
      id: data.nextUserId++,
      name,
      email,
      password_hash: await bcrypt.hash(password, 10),
      created_at: new Date().toISOString(),
    };
    data.users.push(user);
    saveData();
    res.setHeader(
      "Set-Cookie",
      `cc_token=${encodeURIComponent(jwt.sign({ sub: String(user.id) }, SECRET, { expiresIn: "7d" }))}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`,
    );
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");
    const user = data.users.find((u) => u.email === email);
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: "Incorrect email or password." });

    const token = jwt.sign({ sub: String(user.id) }, SECRET, {
      expiresIn: "7d",
    });
    res.setHeader(
      "Set-Cookie",
      `cc_token=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`,
    );
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed." });
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.setHeader(
    "Set-Cookie",
    "cc_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
  );
  res.json({ ok: true });
});

app.get("/api/auth/me", auth, (req, res) =>
  res.json({ user: publicUser(req.user) }),
);
app.get("/api/progress", auth, (req, res) => {
  res.json({
    progress: data.progress.filter((p) => p.user_id === req.user.id),
  });
});
app.put("/api/progress/:moduleId", auth, (req, res) => {
  const moduleId = String(req.params.moduleId);
  let item = data.progress.find(
    (p) => p.user_id === req.user.id && p.module_id === moduleId,
  );
  if (!item) {
    item = { user_id: req.user.id, module_id: moduleId, completed: false };
    data.progress.push(item);
  }
  item.completed = req.body.completed === true;
  item.updated_at = new Date().toISOString();
  saveData();
  res.json({ moduleId, completed: item.completed });
});

app.get("/", (req, res) => res.sendFile(path.join(FRONTEND, "index.html")));
app.get(["/courses", "/courses.html"], (req, res) =>
  res.sendFile(path.join(FRONTEND, "courses.html")),
);
app.get(["/notes", "/notes.html"], (req, res) =>
  res.sendFile(path.join(FRONTEND, "notes.html")),
);
app.get(["/projects", "/projects.html"], (req, res) =>
  res.sendFile(path.join(FRONTEND, "projects.html")),
);
app.get("/profile", (req, res) =>
  res.sendFile(path.join(FRONTEND, "profile.html")),
);

app.listen(PORT, () =>
  console.log(`CodeCraft running at http://localhost:${PORT}`),
);
