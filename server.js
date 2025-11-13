atus(400).send("Thiếu link tài liệu");

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








// ====== Helper: chuẩn hóa tên báo cáo ======
function normalizeReportName(name) {
  return (name || "")
    .trim()
    .replace(/\s+/g, " ");
}
// báo cáo
// ====== API: lấy dữ liệu mới nhất của đơn vị cho báo cáo ======
app.get("/api/reports/:name/latest", requireLogin, async (req, res) => {
  try {
    const reportName = req.params.name;
    const unit = req.session?.user?.unit;

    if (!unit) return res.json({ data: null });

    const doc = await firestore.collection("report_submissions").doc(reportName).get();
    if (!doc.exists) return res.json({ data: null });

    const { submissions = {} } = doc.data() || {};
    const sub = submissions[unit];

    let latest = null;
    if (Array.isArray(sub) && sub.length > 0) {
      const sorted = [...sub].sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
      latest = sorted[sorted.length - 1];
    } else if (sub && sub.data) {
      latest = sub;
    }

    res.json({ data: latest ? latest.data : null });
  } catch (err) {
    console.error("GET /api/reports/:name/latest error:", err);
    res.json({ data: null });
  }
});

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
      return res.render("report_result_form", {
        reportName, fields, units,
        submissions: {}, latest: [], history: []
      });
    }

    const { submissions = {} } = doc.data();

    // Chuẩn hóa: mỗi đơn vị có thể là 1 object (cũ) hoặc mảng (mới). Ta chuyển hết thành mảng.
    const grouped = {};
    units.forEach(u => {
      const sub = submissions[u];
      if (!sub) {
        grouped[u] = [];
      } else if (Array.isArray(sub)) {
        grouped[u] = sub.filter(x => !!x && !!x.submittedAt);
      } else {
        grouped[u] = sub.submittedAt ? [sub] : [];
      }
    });

    // Sắp xếp mỗi mảng theo thời gian tăng dần
    Object.values(grouped).forEach(arr =>
      arr.sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))
    );

    // Tách latest và history
    const latest = {};
    const history = {};
    for (const u of units) {
      const arr = grouped[u];
      if (arr.length > 0) {
        latest[u] = arr[arr.length - 1]; // bản mới nhất
        if (arr.length > 1) {
          history[u] = arr.slice(0, -1); // các bản cũ
        }
      }
    }

    // Render ra EJS với dữ liệu đã tách
    res.render("report_result_form", { reportName, fields, units, submissions, latest, history });
  } catch (err) {
    console.error("GET /reports/results/:reportName error:", err);
    res.status(500).send("Không tải được kết quả báo cáo");
  }
});

// ====== Điểm danh báo cáo ======
// ====== Điểm danh báo cáo (chỉ Ban XDĐ) ======
// ====== Điểm danh báo cáo ======
// ====== Attendance matrix (units × reports, names only) ======
// TEST: fixed attendance render
app.get("/reports/attendance", requireLogin, async (req, res) => {
  try {
    const unit = req.session?.user?.unit;
    if (unit !== "Ban XDĐ") {
      return res.status(403).send("Bạn không có quyền xem điểm danh");
    }

    // 1) Danh sách đơn vị
    const users = await getUsers(); // giữ nguyên hàm của project
    const units = users.map(u => u.name).filter(Boolean);

    // 2) Danh sách báo cáo (tên document)
    const snapshot = await firestore.collection("report_submissions").get();
    const reports = snapshot.docs.map(doc => doc.id);

    // 3) Gom dữ liệu: mapReportToUnits[reportName] = { unitName: true, ... }
    const mapReportToUnits = {};
    snapshot.forEach(doc => {
      const reportName = doc.id;
      const data = doc.data() || {};
      const submissions = data.submissions || {};
      mapReportToUnits[reportName] = {};
      Object.keys(submissions).forEach(unitName => {
        const sub = submissions[unitName];
        let has = false;
        if (Array.isArray(sub) && sub.length > 0) {
          // nếu mảng, có ít nhất 1 bản có submittedAt hoặc data
          has = sub.some(x => x && (x.submittedAt || x.data));
        } else if (sub && (sub.submittedAt || sub.data)) {
          has = true;
        }
        if (has) mapReportToUnits[reportName][unitName] = true;
      });
    });

    console.log("Attendance: units", units.length, "reports", reports.length);

    // 4) Render view với 3 biến: units, reports, mapReportToUnits
    res.render("report_attendance", { units, reports, mapReportToUnits });
  } catch (err) {
    console.error("GET /reports/attendance error:", err);
    res.status(500).send("Không tải được điểm danh");
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
// ====== Submit report (1 báo cáo = 1 document, trong data có cả tên người) ======
// ====== Submit report (1 báo cáo = 1 document, trong data có cả tên người) ======
app.post("/reports/:name", requireLogin, async (req, res) => {
  try {
    const unit = req.session?.user?.unit || "Unknown unit";
    const username = req.session?.user?.username || "Unknown user";
    const reportName = normalizeReportName(req.params.name);

    // Data từ form động + thêm tên người
    const data = {
      ...req.body,
      user: username,
      submittedAt: new Date().toISOString()
    };

    // Document ID = reportName
    const docRef = firestore.collection("report_submissions").doc(reportName);

    // Giữ cấu trúc submissions như cũ, nhưng biến mỗi đơn vị thành MẢNG các lần nộp
    await docRef.set({
      reportName,
      submissions: {
        [unit]: admin.firestore.FieldValue.arrayUnion({
          data,
          submittedAt: data.submittedAt
        })
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
