const Brevo = require('@getbrevo/brevo');

const apiKey = process.env.BREVO_API_KEY;
if (!apiKey) {
  // Fail fast so callers see a clear error
  throw new Error('Missing BREVO_API_KEY environment variable');
}

const client = new Brevo.TransactionalEmailsApi();
client.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);

const defaultSender = {
  email: process.env.EMAIL_FROM || process.env.EMAIL_USER,
  name: process.env.EMAIL_FROM_NAME || 'WasteWise',
};

function parseAddress(addr) {
  if (!addr) return defaultSender;
  if (typeof addr === 'string') return { email: addr, name: defaultSender.name };
  if (addr.email) return { email: addr.email, name: addr.name || defaultSender.name };
  return defaultSender;
}

function normalizeRecipients(to) {
  if (!to) throw new Error("Missing 'to' email");
  const arr = Array.isArray(to) ? to : [to];
  return arr
    .filter(Boolean)
    .map(r => (typeof r === 'string' ? { email: r } : { email: r.email, name: r.name }))
    .filter(r => !!r.email);
}

async function sendMail({ from, to, subject, html, text }) {
  const payload = new Brevo.SendSmtpEmail();
  payload.sender = parseAddress(from) || defaultSender;
  payload.to = normalizeRecipients(to);
  payload.subject = subject || '';
  if (html) payload.htmlContent = html;
  if (text) payload.textContent = text;

  const res = await client.sendTransacEmail(payload);
  return { messageId: res?.messageId || null };
}

module.exports = { sendMail };