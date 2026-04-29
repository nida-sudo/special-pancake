// Custom Playwright reporter — emits an HTML pass/fail report and emails it
// via SMTP after the run. Reads SMTP_USER, SMTP_PASS, MAIL_TO from env.
// Designed to be a no-op locally if SMTP envs aren't set.

const nodemailer = require("nodemailer");

class EmailReporter {
  constructor(options = {}) {
    this.options = options;
    this.results = [];
    this.startTime = null;
    this.totalTests = 0;
  }

  onBegin(config, suite) {
    this.startTime = Date.now();
    this.totalTests = suite.allTests().length;
  }

  onTestEnd(test, result) {
    this.results.push({
      title: test.title,
      file: test.location?.file || "",
      line: test.location?.line || 0,
      status: result.status,
      duration: result.duration,
      error: result.error?.message || null,
    });
  }

  async onEnd() {
    const duration = Date.now() - this.startTime;
    const passed = this.results.filter((r) => r.status === "passed").length;
    const failed = this.results.filter((r) =>
      ["failed", "timedOut"].includes(r.status)
    ).length;
    const skipped = this.results.filter((r) => r.status === "skipped").length;
    const total = this.results.length;
    const pct = total > 0 ? Math.round((passed / total) * 100) : 0;

    const html = this.buildHtml({ total, passed, failed, skipped, duration, pct });
    const text = this.buildText({ total, passed, failed, skipped, duration, pct });

    await this.sendEmail({ html, text, passed, failed, total, pct });
  }

  buildHtml({ total, passed, failed, skipped, duration, pct }) {
    const rows = this.results
      .map((r) => {
        const icon =
          r.status === "passed" ? "&#10003;" : r.status === "skipped" ? "&#8211;" : "&#10007;";
        const color =
          r.status === "passed" ? "#2e7d32" : r.status === "skipped" ? "#666" : "#c62828";
        const tcMatch = r.title.match(/^TC-\d+/);
        const tc = tcMatch ? tcMatch[0] : "&mdash;";
        const scenario = r.title.replace(/^TC-\d+:\s*/, "");
        const errCell = r.error
          ? `<div style="color:#c62828;font-size:11px;margin-top:4px;font-family:monospace">${escapeHtml(
              r.error.split("\n")[0].slice(0, 200)
            )}</div>`
          : "";
        return `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;color:${color};font-weight:bold">${icon}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;font-family:monospace;color:#333">${tc}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee">${escapeHtml(scenario)}${errCell}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;color:${color};text-transform:uppercase;font-size:11px">${r.status}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;color:#666">${(r.duration / 1000).toFixed(1)}s</td>
        </tr>`;
      })
      .join("");

    const runUrl =
      process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
        ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
        : null;

    const headerColor = pct >= 90 ? "#2e7d32" : pct >= 75 ? "#f57c00" : "#c62828";

    return `<!doctype html>
<html><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif;background:#f5f5f5;margin:0;padding:24px">
<div style="max-width:960px;margin:auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
  <div style="padding:24px;background:${headerColor};color:white">
    <h1 style="margin:0;font-size:22px">Ruh AI Campaign E2E &mdash; ${pct}% pass</h1>
    <p style="margin:6px 0 0 0;font-size:13px;opacity:0.9">${new Date().toUTCString()}</p>
  </div>
  <div style="padding:24px">
    <table style="width:100%;border-collapse:separate;border-spacing:6px;margin-bottom:20px;table-layout:fixed">
      <tr>
        <td style="padding:14px;background:#f5f5f5;text-align:center;border-radius:6px"><div style="font-size:11px;color:#666">TOTAL</div><div style="font-size:22px;font-weight:bold">${total}</div></td>
        <td style="padding:14px;background:#e8f5e9;text-align:center;border-radius:6px"><div style="font-size:11px;color:#2e7d32">PASSED</div><div style="font-size:22px;font-weight:bold;color:#2e7d32">${passed}</div></td>
        <td style="padding:14px;background:#ffebee;text-align:center;border-radius:6px"><div style="font-size:11px;color:#c62828">FAILED</div><div style="font-size:22px;font-weight:bold;color:#c62828">${failed}</div></td>
        <td style="padding:14px;background:#f5f5f5;text-align:center;border-radius:6px"><div style="font-size:11px;color:#666">SKIPPED</div><div style="font-size:22px;font-weight:bold;color:#666">${skipped}</div></td>
        <td style="padding:14px;background:#f5f5f5;text-align:center;border-radius:6px"><div style="font-size:11px;color:#666">RUNTIME</div><div style="font-size:22px;font-weight:bold">${(duration / 60000).toFixed(1)} min</div></td>
      </tr>
    </table>
    <h3 style="margin:24px 0 8px 0;color:#333;font-size:15px">Per-test results</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f5f5f5">
        <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #ddd;width:30px">  </th>
        <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #ddd;width:70px">TC</th>
        <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #ddd">Scenario</th>
        <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #ddd;width:80px">Status</th>
        <th style="padding:8px 10px;text-align:right;border-bottom:2px solid #ddd;width:80px">Duration</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${runUrl
      ? `<p style="margin-top:24px;padding:12px;background:#f5f5f5;border-radius:6px;font-size:13px"><strong>&#128279; Full run with traces &amp; screenshots:</strong> <a href="${runUrl}" style="color:#1976d2">${runUrl}</a></p>`
      : ""}
    <p style="margin-top:24px;color:#999;font-size:11px;text-align:center">Generated by Ruh E2E Automation &middot; <code>ruh-e2e-automation</code></p>
  </div>
</div>
</body></html>`;
  }

  buildText({ total, passed, failed, skipped, duration, pct }) {
    const lines = [
      `Ruh AI Campaign E2E - ${pct}% pass`,
      new Date().toUTCString(),
      "",
      `Total: ${total} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`,
      `Runtime: ${(duration / 60000).toFixed(1)} min`,
      "",
      "--- Test Results ---",
    ];
    for (const r of this.results) {
      const icon =
        r.status === "passed" ? "[PASS]" : r.status === "skipped" ? "[SKIP]" : "[FAIL]";
      lines.push(`${icon} ${r.title} (${(r.duration / 1000).toFixed(1)}s)`);
      if (r.error) {
        lines.push(`       ${r.error.split("\n")[0].slice(0, 200)}`);
      }
    }
    return lines.join("\n");
  }

  async sendEmail({ html, text, passed, failed, total, pct }) {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const to = process.env.MAIL_TO;

    if (!user || !pass || !to) {
      console.warn(
        "[EmailReporter] SMTP_USER / SMTP_PASS / MAIL_TO not set — skipping email."
      );
      return;
    }

    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass },
      });

      const tag = failed > 0 ? `[FAIL]` : `[PASS]`;
      const subject = `${tag} Ruh E2E ${passed}/${total} (${pct}% pass${failed > 0 ? `, ${failed} failed` : ""})`;

      const info = await transporter.sendMail({
        from: `Ruh E2E Bot <${user}>`,
        to,
        subject,
        text,
        html,
      });

      console.log(`[EmailReporter] Sent report to ${to} (messageId=${info.messageId})`);
    } catch (err) {
      console.error("[EmailReporter] Failed to send email:", err.message);
    }
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = EmailReporter;
