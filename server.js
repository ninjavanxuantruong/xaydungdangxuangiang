import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { getPDFList as rawGetPDFList, getUsers, getReports, fetchSheetColumnsFromGoogleLink } from "./services/sheets.js";



dotenv.config();

import admin from "firebase-admin";

const serviceAccount = {
  type: "service_account",
  project_id: "xuangiangxdd",
  private_key_id: "1c461f9679f05571af3ba777fc25694669dc0557",
  private_key: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDsaDscPWQnU1J6
pbQ+S+D2JUZdBhrU9U9XodCEuq9W62oRCdYve3r63/u5v6bjTmb5BEIzoG0C+Gqe
XlnhEUZpWj8fMd90K6pFjD+6zKb19P4Gry27kleZDDDXpqtQdlrzmPDUoqIoPsx9
HbnLzAE6aiHKzbmt50WtgtLUGypeRSP0lTkxGqSxN0AYD/N5Xr+h0j/AGlNbGQda
gpg0Yxz4HYVwynH4EujAbbJmBNz3Ff33lnO8tWJya/th8EEQ8b3wKMwx2TEGLneh
yjK8p+BpknlAQlaxJbMGGymwt9/oqLvpuhaw+SxqoXXzwvQTJJw9mMwv5nogZw5O
GsY1bx1rAgMBAAECggEAI9qlCGHpNCunaTGDdiVE75/0nXwlCqJPz78bZF355Mlc
c0wWH2pvWugogeHmuje0V1UFg1Xz4ozxgqZVpFRd5PGKfD0woipTLywXqEmMkuX+
tt3PplCKF4ypRbOh7Nieb66E7ALkbA0mL12YRafhkc3x5ROxcwYN48RhHEkoclZo
euLGWCfmluq8Dwyj1hAi17R4Xqg9gquElxIdCNv31GczZOQtfsjwg8D9hGV3aWBo
faQ9VxpUZsrY1ynXFGERp/eycxmf2sJyN89VXen8VXNw3EfesIo9GveO2M/gRipp
wLRtwWAfvulQBz5JNNjW3P2yIene9WlF+z3UsAn78QKBgQD7vlG0Z0y7RNDcIGyn
5ZBiFyPkSr1rnd37Ez7sadmVapjS3p545320MKfkvX8Fvs2t17G12Q+t8OuDxOfF
h4CuMHTqsqJ1o5NJHILr79+WzU0fc+Bokm6f/t8YWl/vhkeH7MD8Je6vloTX6/b/
I4Z/v/tp6Djsdbq2+kXvX0ICewKBgQDwZ4cvqsZvsXf+xzzQ1TAfwfHs/QqwNkGs
Yx0wa+W7AN1xx6OV+6u4mAb7/vW0BAQDD9d6XI257+xrWnZqP8Nm59WB2FO4qHYK
2ub/Kqc8hzIQhHDKwnJd7wuz/RgGEdLTtbpP4Cd5AL7Ac6DUd6VUlA84scQeaDrn
AYVIAtUV0QKBgD34gtp7F2t+LEAUB0tpepp7Ac3gDDMiwJNfEH1YLUTX4dj/DlnK
+qnR1HK9pzg92RnzX/7Y+UAjb4aXgUqh6a53pUBlSxLUepxj1WLJQOw5i8OzXcnA
SlU+g6LWFIm9L3ypbnRjzhcRYZBZuQrjrudh1j0i+mhTLux+PZsIgxJjAoGARvNn
FIxkUGaiMZF/w2qH73d//R+ZXfRFYalG3hmaDZztvjzbbNKAFdTYitrujRh6TqUI
RVa3hV7n+a8TL7xt4RsfCllcLC2b2QxODJT8EoMcJX/RAiZtNofsfkx+IJx2CoGh
4R0YyT+NDKOTneFJ7DJeY68jYI4GhFMQkPY1CWECgYEAzfrE4XAuH4fuUzDNC+4u
oDgHRwF1ETqTADFnyyZZLo76aqWbokoojm/q0fatspo8YamhQWDBvjkB7D0es2Ps
C1y8TxIfz+TKJBIKP6SrwfWcPn+b7wMdNbFfmCx0S7nB1+IpvDezmOl9/R0QZ9eX
UcVpfS5AEGsad/uYZuy7S9w=
-----END PRIVATE KEY-----`,
  client_email: "firebase-adminsdk-fbsvc@xuangiangxdd.iam.gserviceaccount.com",
  client_id: "116176810800342076802",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40xuangiangxdd.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
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

    res.redirect("/reports");
  } catch (err) {
    console.error("POST /reports/:name error:", err);
    res.status(500).send("Không lưu được báo cáo");
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
