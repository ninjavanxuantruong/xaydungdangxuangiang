import fetch from "node-fetch";
import { parse } from "csv-parse/sync";

/**
 * Fetch CSV từ Google Sheet publish link và parse thành mảng object
 * @param {string} url - link CSV (Google Sheet publish)
 * @returns {Promise<Array<Object>>}
 */
export async function fetchSheet(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
    }
    const csvText = await res.text();
    const records = parse(csvText, {
      columns: true, // dùng dòng đầu tiên làm header
      skip_empty_lines: true,
      trim: true
    });
    return records;
  } catch (err) {
    console.error("Error fetching sheet:", err);
    return [];
  }
}

/**
 * Lấy danh sách tài liệu PDF từ sheet
 * @returns {Promise<Array<{type: string, name: string, url: string}>>}
 */
export async function getPDFList() {
  const url = process.env.PDF_SHEET_URL;
  if (!url) return [];
  const records = await fetchSheet(url);

  return records
    .map(r => ({
      type: r.type || r.Type || r.loai || "Khác",
      name: r.name || r.Name || "Untitled",
      url: r.url || r.URL || r.link || ""
    }))
    .filter(item => item.url);
}

/**
 * Lấy danh sách user từ sheet
 * @returns {Promise<Array<{name: string, password: string}>>}
 */
export async function getUsers() {
  const url = process.env.USER_SHEET_URL;
  if (!url) return [];
  const records = await fetchSheet(url);
  return records
    .map(r => ({
      name: r.name || r.Name || "",
      password: r.password || r.Pass || ""
    }))
    .filter(u => u.name);
}

/**
 * Lấy danh sách báo cáo từ sheet nguồn (cột name, url)
 * @returns {Promise<Array<{name: string, url: string}>>}
 */
export async function getReports() {
  const url = process.env.REPORT_SHEET_URL;
  if (!url) return [];
  const records = await fetchSheet(url);

  return records
    .map(r => ({
      name: r.name || r.Name || "",
      url: r.url || r.URL || ""
    }))
    .filter(r => r.name && r.url);
}

/**
 * Đọc cột từ link Google Sheet (hàng đầu tiên làm tiêu đề)
 * @param {string} googleLink - link share Google Sheet
 * @returns {Promise<string[]>} - danh sách tiêu đề cột
 */
export async function fetchSheetColumnsFromGoogleLink(googleLink) {
  try {
    // Lấy spreadsheetId và gid từ link
    const idMatch = googleLink.match(/\/spreadsheets\/d\/([^/]+)/);
    const spreadsheetId = idMatch ? idMatch[1] : null;

    let gid = 0;
    const gidMatch = googleLink.match(/[?&]gid=(\d+)/);
    if (gidMatch) gid = gidMatch[1];

    if (!spreadsheetId) return [];

    // Tạo link export CSV
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error(`Fetch sheet csv failed: ${res.status}`);
    const csvText = await res.text();

    // Parse CSV, lấy hàng đầu tiên làm header
    const rows = parse(csvText, { skip_empty_lines: true, trim: true });
    if (!rows || rows.length === 0) return [];
    const headers = rows[0]
      .map(h => String(h).trim())
      .filter(h => h && h.length > 0);
    return headers;
  } catch (err) {
    console.error("fetchSheetColumnsFromGoogleLink error:", err);
    return [];
  }
}
