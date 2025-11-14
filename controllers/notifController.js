const reportModel = require("../models/reportsModel");
const mailer = require("../services/mailer"); // <-- use shared mailer config

exports.sendReportEmailDirect = async ({ to, reportId, report, subject }) => {
  if (!to) throw new Error("Missing 'to' email");
  if (!report && !reportId) throw new Error("Provide 'report' or 'reportId'");

  const rep =
    report ||
    (await reportModel.findById(reportId).lean().exec()) ||
    null;
  if (!rep) throw new Error("Report not found");

  const { html, title } = buildReportEmailHtml(rep);

  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  const info = await mailer.sendMail({
    from,
    to,
    subject: subject || `WasteWise Report: ${title || "Report"}`,
    html,
  });

  return { messageId: info.messageId };
};

function buildReportEmailHtml(report) {
  const title = report.title || "Untitled Report";
  const description = report.description || "No description provided.";
  const status = report.status || "Pending";
  const when = new Date(report.createdAt || report.date || Date.now()).toLocaleString();

  // Image URL
  let imageUrl = "";
  if (Array.isArray(report.image) && report.image.length > 0) imageUrl = report.image[0];
  else if (report.imageUrl) imageUrl = report.imageUrl;
  else if (typeof report.image === "string") imageUrl = report.image;

  // Coordinates (support [lat,lng] or [lng,lat])
  let lat, lng;
  if (report?.locCoords?.coordinates && Array.isArray(report.locCoords.coordinates)) {
    const [a, b] = report.locCoords.coordinates;
    if (Math.abs(a) <= 90 && Math.abs(b) <= 180) {
      lat = a; lng = b;
    } else {
      lat = b; lng = a;
    }
  }

  // Static map or OSM link
  let mapImgHtml = "";
  let mapLinkHtml = "";
  if (typeof lat === "number" && typeof lng === "number") {
    const googleKey = process.env.GOOGLE_MAPS_API_KEY;
    const zoom = 16;
    const size = "600x300";
    if (googleKey) {
      const staticMapUrl =
        `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}` +
        `&zoom=${zoom}&size=${size}&markers=color:red|${lat},${lng}&key=${googleKey}`;
      mapImgHtml = `<img src="${staticMapUrl}" alt="Report Location Map" style="width:100%;max-width:600px;border-radius:8px;border:1px solid #e5e7eb;" />`;
    }
    const osmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
    mapLinkHtml = `<div style="margin-top:6px"><a href="${osmUrl}" target="_blank" rel="noopener noreferrer">View on OpenStreetMap</a></div>`;
  }

  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;color:#111827;">
      <div style="padding:16px;border-radius:12px;border:1px solid #e5e7eb;background:#ffffff;box-shadow:0 2px 8px rgba(4,120,87,0.10);">
        <h2 style="margin:0 0 10px 0;color:#047857;">WasteWise Report</h2>
        <div style="font-size:13px;color:#6b7280;margin-bottom:16px;">${when}</div>

        <div style="margin-bottom:10px;">
          <div style="font-weight:700;color:#047857;">Title</div>
          <div>${escapeHtml(title)}</div>
        </div>

        <div style="margin-bottom:10px;">
          <div style="font-weight:700;color:#047857;">Description</div>
          <div>${escapeHtml(description)}</div>
        </div>

        <div style="margin-bottom:10px;">
          <div style="font-weight:700;color:#047857;">Status</div>
          <div>Resolved</div>
        </div>

        ${mapImgHtml ? `<div style="margin:16px 0;">
            <div style="font-weight:700;color:#047857;margin-bottom:6px;">Location Map</div>
            ${mapImgHtml}
            ${mapLinkHtml}
          </div>` : ""}

        <div style="margin:16px 0;">
          <div style="font-weight:700;color:#047857;margin-bottom:6px;">Image</div>
          ${imageUrl
            ? `<img src="${imageUrl}" alt="Report Image" style="max-width:100%;border-radius:8px;border:1px solid #e5e7eb;" />`
            : `<div style="color:#6b7280;font-size:13px;">No image provided.</div>`}
        </div>
      </div>
    </div>
  `;

  return { html, title };
}

// Basic HTML escaping
function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}