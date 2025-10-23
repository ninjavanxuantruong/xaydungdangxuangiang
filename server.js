import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { getPDFList as rawGetPDFList, getUsers } from "./services/sheets.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====== View engine ======
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ====== Static files ======
app.use("/public", express.static(path.join(__dirname, "public")));

// ====== Middleware ======
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ====== Session (login khi AUTH_MODE=on) ======
app.use(
  session({
    secret: "xuangiang-secret",
    resave: false,
    saveUninitialized: false,
  })
);

// ====== Health check ======
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ====== Middleware check login ======
function requireLogin(req, res, next) {
  if (process.env.AUTH_MODE === "off") return next();
  if (req.session && req.session.user) return next();
  return res.redirect("/login");
}

// ====== Utils ======
function convertDriveLink(link) {
  if (!link) return null;
  // Link dạng https://drive.google.com/file/d/<ID>/view?usp=sharing
  const match = link.match(/\/d\/([^/]+)\//);
  if (match && match[1]) {
    return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  }
  // Nếu đã là link uc?export=download thì giữ nguyên
  if (link.includes("uc?export=download")) return link;
  return link;
}

// getPDFList wrapper: tự convert link
async function getPDFList() {
  const rows = await rawGetPDFList();
  return rows.map((r) => ({
    name: r.name,
    url: convertDriveLink(r.url),
  }));
}

// ====== Auth routes ======
app.get("/login", (req, res) => {
  if (process.env.AUTH_MODE === "off") return res.redirect("/");
  res.render("login", { error: null });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const users = await getUsers();
    const found = users.find(
      (u) => u.username === username && u.password === password
    );
    if (found) {
      req.session.user = { username };
      return res.redirect("/");
    }
    return res.render("login", { error: "Sai tài khoản hoặc mật khẩu" });
  } catch (err) {
    console.error("Login error:", err);
    return res.render("login", { error: "Lỗi server khi đăng nhập" });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// ====== Dashboard ======
app.get("/", requireLogin, async (req, res) => {
  try {
    const pdfs = await getPDFList();
    res.render("dashboard", { pdfs });
  } catch (err) {
    console.error("Home error:", err);
    res.status(500).send("Không tải được danh sách PDF");
  }
});

// ====== Flipbook ======
app.get("/flipbook", requireLogin, (req, res) => {
  const { url, name } = req.query;
  if (!url) return res.status(400).send("Thiếu link PDF");

  // Nếu url là link Google Drive direct, lấy ID
  const match = url.match(/id=([^&]+)/);
  const id = match ? match[1] : null;

  // Nếu có ID thì render với link proxy /pdf/:id
  const finalLink = id ? `/pdf/${id}` : url;

  res.render("flipbook", { name: name || "Flipbook", link: finalLink });
});

// ====== Proxy PDF ======
app.get("/pdf/:id", async (req, res) => {
  const fileId = req.params.id;
  const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Fetch failed");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/pdf");
    response.body.pipe(res);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Không tải được PDF");
  }
});

// ====== 404 ======
app.use((req, res) => {
  res.status(404).send("Not found");
});

// ====== Error handler ======
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).send("Internal server error");
});

// ====== Start server ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
