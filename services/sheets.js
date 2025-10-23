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
 * Lấy danh sách PDF từ sheet
 * @returns {Promise<Array<{name: string, url: string}>>}
 */
export async function getPDFList() {
  const url = process.env.PDF_SHEET_URL;
  if (!url) return [];
  const records = await fetchSheet(url);
  // Chuẩn hóa dữ liệu
  return records.map(r => ({
    name: r.name || r.Name || "Untitled",
    url: r.url || r.URL || r.link || ""
  })).filter(item => item.url);
}

/**
 * Lấy danh sách user từ sheet
 * @returns {Promise<Array<{username: string, password: string}>>}
 */
export async function getUsers() {
  const url = process.env.USER_SHEET_URL;
  if (!url) return [];
  const records = await fetchSheet(url);
  return records.map(r => ({
    username: r.username || r.user || r.email || "",
    password: r.password || r.pass || ""
  })).filter(u => u.username && u.password);
}
