// Optional email notifications. Works when SMTP_* variables are set; otherwise logs only.
const nodemailer = require('nodemailer');
const site = require('../config/site');

let transport = null;
if (process.env.SMTP_HOST) {
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });
}
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LABEL = { contact: 'Message', care_request: 'Care request', application: 'Job application' };

async function notify(row) {
  const subject = `[Vierra] New ${LABEL[row.type]} from ${row.name}`;
  const lines = Object.entries(row.payload).filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${esc(k)}</td><td>${esc(Array.isArray(v) ? v.join(', ') : v)}</td></tr>`).join('');
  const html = `<h2 style="color:#134e45">${esc(subject)}</h2>
    <p><b>${esc(row.name)}</b><br>${esc(row.email || '')} ${esc(row.phone || '')}</p><table>${lines}</table>`;
  if (!transport) { console.log(`[mail:disabled] ${subject}`); return; }
  const to = process.env.NOTIFY_TO || site.email;
  try {
    await transport.sendMail({ from: process.env.MAIL_FROM || `"${site.name}" <${site.email}>`, to, replyTo: row.email || undefined, subject, html });
    if (row.email && row.type !== 'application') {
      await transport.sendMail({
        from: process.env.MAIL_FROM || `"${site.name}" <${site.email}>`, to: row.email,
        subject: `We've received your message — ${site.name}`,
        html: `<p>Hello ${esc(row.name.split(' ')[0])},</p><p>Thank you for reaching out to ${esc(site.name)}. A member of our team will contact you shortly.</p><p>${esc(site.motto)}</p>`
      });
    }
  } catch (e) { console.error('[mail] failed:', e.message); }
}
module.exports = { notify };
