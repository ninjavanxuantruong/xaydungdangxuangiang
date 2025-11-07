import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { getPDFList as rawGetPDFList, getUsers, getReports, fetchSheetColumnsFromGoogleLink } from "./services/sheets.js";



dotenv.config();

import admin from "firebase-admin";

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const firestore = admin.firestore();








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
app.get("/login", async (req, res) => {
  try {
    const users = await getUsers();
    const units = users.map(u => u.name).filter(Boolean);
    res.render("login", { error: null, units });
  } catch (err) {
    console.error("GET /login error:", err);
    res.render("login", { error: "Không tải được danh sách đơn vị", units: [] });
  }
});



app.post("/login", async (req, res) => {
  const { unit, password } = req.body;
  try {
    const users = await getUsers();
    const found = users.find(u => u.name === unit);

    if (found.password && found.password.trim() !== "") {
      // Có mật khẩu trong sheet -> bắt buộc kiểm tra
      if (found.password === password) {
        req.session.user = { unit: found.name };
        return res.redirect("/");
      } else {
        const units = users.map(u => u.name).filter(Boolean);
        return res.render("login", { error: "Sai mật khẩu", units });
      }
    } else {
      // Không có mật khẩu (ô trống) -> cho login luôn
      req.session.user = { unit: found.name };
      return res.redirect("/");
    }


    const units = users.map(u => u.name).filter(Boolean);
    return res.render("login", { error: "Không tìm thấy đơn vị", units });
  } catch (err) {
    console.error("POST /login error:", err);
    res.render("login", { error: "Lỗi server khi đăng nhập", units: [] });
  }
});



app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// ====== Dashboard (hiển thị danh sách type) ======
// ====== Dashboard (hiển thị danh sách type + báo cáo) ======
app.get("/", requireLogin, async (req, res) => {
  try {
    const files = await getFileList();
    const types = [...new Set(files.map(f => f.type))];
    const reports = await getReports();

    let submissions = [];
    if (req.session?.user?.unit === "Ban XDĐ") {
      const snapshot = await firestore.collection("report_submissions").get();
      submissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    res.render("dashboard", { types, reports, submissions, user: req.session.user });
  } catch (err) {
    console.error("Home error:", err);
    res.status(500).send("Không tải được dashboard");
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

// ====== TTS proxy (Google Translate) ======
app.get("/tts", async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || !q.trim()) {
      return res.status(400).send("Thiếu tham số q");
    }

    // Giới hạn độ dài để tránh bị từ chối
    const text = q.trim().slice(0, 200);

    const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=vi&client=tw-ob`;

    const response = await fetch(googleUrl, {
      method: "GET",
      headers: {
        // Giả lập truy cập thật từ trình duyệt
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36",
        "Referer": "https://translate.google.com/",
        "Accept": "*/*",
      },
    });

    if (!response.ok) {
      throw new Error(`Google TTS fetch failed: ${response.status}`);
    }

    // Trả audio về cho client
    res.setHeader("Content-Type", "audio/mpeg");
    // Cho phép phát từ trang của anh (nếu cần dùng ở domain khác, tuỳ chỉnh lại)
    res.setHeader("Access-Control-Allow-Origin", "*");

    response.body.pipe(res);
  } catch (err) {
    console.error("TTS proxy error:", err);
    res.status(500).send("Không lấy được audio TTS");
  }
});




// ====== Reports list ======
// ====== Danh sách báo cáo ======
app.get("/reports", requireLogin, async (req, res) => {
  try {
    const reports = await getReports();
    res.render("reports", { reports });
  } catch (err) {
    console.error("GET /reports error:", err);
    res.status(500).send("Không tải được danh sách báo cáo");
  }
});

// ====== Dynamic report form ======
app.get("/reports/:name", requireLogin, async (req, res) => {
  try {
    const reportName = req.params.name;
    const reports = await getReports();
    const report = reports.find(r => r.name === reportName);
    if (!report) return res.status(404).send("Không tìm thấy báo cáo");

    const fields = await fetchSheetColumnsFromGoogleLink(report.url);
    if (!fields.length) {
      return res.status(400).send("Không đọc được cấu trúc báo cáo từ Google Sheet");
    }

    res.render("report_form", {
      reportName,
      fields
    });
  } catch (err) {
    console.error("GET /reports/:name error:", err);
    res.status(500).send("Không hiển thị được form báo cáo");
  }
});

// ====== Submit report (1 báo cáo = 1 document, trong data có cả tên người) ======
app.post("/reports/:name", requireLogin, async (req, res) => {
  try {
    const unit = req.session?.user?.unit || "Unknown unit";
    const username = req.session?.user?.username || "Unknown user";
    const reportName = normalizeReportName(req.params.name);

    // Data từ form động + thêm tên người
    const data = { ...req.body, user: username };

    // Document ID = reportName
    const docRef = firestore.collection("report_submissions").doc(reportName);

    await docRef.set({
      reportName,
      submissions: {
        [unit]: {
          data,
          submittedAt: new Date().toISOString()
        }
      }
    }, { merge: true });

    // ✅ Sau khi lưu thành công: render lại form với status=success
    const reports = await getReports();
    const report = reports.find(r => normalizeReportName(r.name) === reportName);
    const fields = report ? await fetchSheetColumnsFromGoogleLink(report.url) : [];

    res.render("report_form", { reportName, fields, status: "success" });

  } catch (err) {
    console.error("POST /reports/:name error:", err);

    // ❌ Nếu lỗi: render lại form với status=error
    const reportName = normalizeReportName(req.params.name);
    const reports = await getReports();
    const report = reports.find(r => normalizeReportName(r.name) === reportName);
    const fields = report ? await fetchSheetColumnsFromGoogleLink(report.url) : [];

    res.render("report_form", { reportName, fields, status: "error" });
  }
});


// ====== Helper: chuẩn hóa tên báo cáo ======
function normalizeReportName(name) {
  return (name || "")
    .trim()
    .replace(/\s+/g, " ");
}

// ====== Danh sách kết quả báo cáo ======
app.get("/reports/results", requireLogin, async (req, res) => {
  try {
    const unit = req.session?.user?.unit;
    if (unit !== "Ban XDĐ") {
      return res.status(403).send("Bạn không có quyền xem kết quả báo cáo");
    }

    const snapshot = await firestore.collection("report_submissions").get();
    const reports = snapshot.docs.map(doc => ({ name: doc.id }));

    res.render("report_results", { reports });
  } catch (err) {
    console.error("GET /reports/results error:", err);
    res.status(500).send("Không tải được danh sách báo cáo kết quả");
  }
});

// ====== Kết quả tổng hợp theo tên báo cáo ======
// ====== Kết quả tổng hợp theo tên báo cáo ======
app.get("/reports/results/:reportName", requireLogin, async (req, res) => {
  try {
    const unit = req.session?.user?.unit;
    if (unit !== "Ban XDĐ") {
      return res.status(403).send("Bạn không có quyền xem kết quả báo cáo");
    }

    const rawName = decodeURIComponent(req.params.reportName);
    const reportName = normalizeReportName(rawName);

    // Lấy danh sách báo cáo để tìm link Google Sheet
    const reports = await getReports();
    const report = reports.find(r => normalizeReportName(r.name) === reportName);
    if (!report) return res.status(404).send("Không tìm thấy báo cáo");

    // Lấy danh sách cột (fields) từ Google Sheet
    const fields = await fetchSheetColumnsFromGoogleLink(report.url);

    // Lấy danh sách đơn vị từ file tên đăng nhập (đúng thứ tự)
    const users = await getUsers();
    const units = users.map(u => u.name).filter(Boolean);

    // Lấy document của báo cáo này trong Firestore
    const doc = await firestore.collection("report_submissions").doc(reportName).get();
    if (!doc.exists) {
      return res.render("report_result_form", { reportName, fields, units, submissions: {} });
    }

    const { submissions = {} } = doc.data();

    // Render ra EJS với đủ dữ liệu
    res.render("report_result_form", { reportName, fields, units, submissions });
  } catch (err) {
    console.error("GET /reports/results/:reportName error:", err);
    res.status(500).send("Không tải được kết quả báo cáo");
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
