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

// ====== Session ======
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
  const match = link.match(/\/d\/([^/]+)\//);
  if (match && match[1]) {
    return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  }
  if (link.includes("uc?export=download")) return link;
  return link;
}

async function getFileList() {
  const rows = await rawGetPDFList();
  return rows.map((r) => {
    let url = r.url || "";
    if (url.includes("drive.google.com/file")) {
      url = convertDriveLink(url);
    }
    return { name: r.name, url, type: r.type || "Khác" };
  });
}

function convertYouTubeLink(inputUrl) {
  try {
    const u = new URL(inputUrl);
    let videoId = null;
    if (u.searchParams.get("v")) videoId = u.searchParams.get("v");
    if (!videoId && u.hostname.includes("youtu.be")) {
      videoId = u.pathname.split("/")[1];
    }
    if (!videoId && u.pathname.includes("/shorts/")) {
      videoId = u.pathname.split("/shorts/")[1];
    }
    if (!videoId) return null;
    return `https://www.youtube.com/embed/${videoId}`;
  } catch {
    return null;
  }
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

// ====== Dashboard (hiển thị danh sách type) ======
app.get("/", requireLogin, async (req, res) => {
  try {
    const files = await getFileList();
    const types = [...new Set(files.map(f => f.type))];
    res.render("dashboard", { types });
  } catch (err) {
    console.error("Home error:", err);
    res.status(500).send("Không tải được danh sách tài liệu");
  }
});

// ====== Route hiển thị tài liệu theo type ======
app.get("/type/:type", requireLogin, async (req, res) => {
  try {
    const { type } = req.params;
    const files = await getFileList();
    const docs = files.filter(f => f.type === type);
    res.render("type", { type, docs });
  } catch (err) {
    console.error("Type error:", err);
    res.status(500).send("Không tải được tài liệu theo loại");
  }
});

// ====== Viewer route ======
app.get("/viewer", requireLogin, async (req, res) => {
  const { url, name } = req.query;
  if (!url) return res.status(400).send("Thiếu link tài liệu");

  try {
    if (url.includes("docs.google.com/document")) {
      const match = url.match(/\/d\/([^/]+)\//);
      const fileId = match && match[1] ? match[1] : null;
      if (!fileId) return res.status(400).send("Không xác định được tài liệu Google Docs");
      const pdfUrl = `/pdf/${fileId}?type=gdoc`;
      return res.render("flipbook", { name: name || "Tài liệu Word (PDF)", link: pdfUrl });
    }

    if (url.endsWith(".pdf") || url.includes("/pdf/") || url.includes("drive.google.com")) {
      const idMatch = url.match(/id=([^&]+)/);
      const id = idMatch ? idMatch[1] : null;
      const finalLink = id ? `/pdf/${id}` : url;
      return res.render("flipbook", { name: name || "Tài liệu PDF", link: finalLink });
    }

    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      const embedUrl = convertYouTubeLink(url);
      if (!embedUrl) return res.status(400).send("Không lấy được video ID từ link YouTube");
      return res.render("youtube", { name: name || "Video YouTube", link: embedUrl });
    }

    return res.status(400).send("Định dạng không được hỗ trợ");
  } catch (err) {
    console.error("Viewer error:", err);
    res.status(500).send("Không thể hiển thị tài liệu");
  }
});

// ====== Proxy PDF ======
app.get("/pdf/:id", async (req, res) => {
  const fileId = req.params.id;
  const isGDoc = req.query.type === "gdoc";
  const url = isGDoc
    ? `https://docs.google.com/document/d/${fileId}/export?format=pdf`
    : `https://drive.google.com/uc?export=download&id=${fileId}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
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
