const nodemailer = require("nodemailer");
const {
  smtpHost,
  smtpPort,
  smtpUser,
  smtpPass,
  emailFrom,
  frontendUrl,
  allowEmailPreview,
  contactToEmail,
} = require("../config");
const { logger, serializeError } = require("../utils/logger");

let cachedTransporter;

function redactEmail(value) {
  const [localPart = "", domain = ""] = String(value || "").split("@");

  if (!localPart || !domain) {
    return value;
  }

  const visibleLocalPart = localPart.slice(0, 2);
  return `${visibleLocalPart}***@${domain}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  if (smtpHost && smtpUser && smtpPass) {
    cachedTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
    return cachedTransporter;
  }

  if (!allowEmailPreview) {
    const error = new Error(
      "Email delivery is not configured. Configure SMTP or explicitly enable preview mode."
    );
    error.status = 503;
    throw error;
  }

  cachedTransporter = nodemailer.createTransport({
    jsonTransport: true,
  });

  return cachedTransporter;
}

async function sendMail({ to, subject, text, html, replyTo }) {
  const transporter = getTransporter();
  const result = await transporter.sendMail({
    from: emailFrom || "ValidationEngine <no-reply@example.com>",
    to,
    subject,
    text,
    html,
    ...(replyTo ? { replyTo } : {}),
  });

  logger.info("email.dispatched", {
    to: redactEmail(to),
    subject,
    previewMode: Boolean(result.message),
    messageId: result.messageId || null,
  });

  return result;
}

async function sendWelcomeEmail(email) {
  const loginUrl = frontendUrl ? `${frontendUrl.replace(/\/$/, "")}/signin` : "ValidationEngine";

  return sendMail({
    to: email,
    subject: "Welcome to ValidationEngine",
    text: `Welcome to ValidationEngine. Your account is verified and ready. Sign in from ${loginUrl}.`,
    html: `<p>Welcome to <strong>ValidationEngine</strong>.</p><p>Your account is verified and ready. Sign in from <a href="${loginUrl}">${loginUrl}</a>.</p>`,
  });
}

async function sendVerificationEmail({ email, verificationUrl }) {
  return sendMail({
    to: email,
    subject: "Verify your ValidationEngine account",
    text: `Verify your email by opening this link: ${verificationUrl}`,
    html: `<p>Verify your <strong>ValidationEngine</strong> account by opening this link:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p>`,
  });
}

async function sendInviteEmail({ to, inviterEmail, teamName, inviteCode }) {
  const appUrl = frontendUrl ? `${frontendUrl.replace(/\/$/, "")}/` : "TeamPulse";

  return sendMail({
    to,
    subject: `${inviterEmail} invited you to ${teamName} on TeamPulse`,
    text: `${inviterEmail} invited you to join ${teamName} on TeamPulse. Use invite code ${inviteCode} after signing in at ${appUrl}.`,
    html: `<p><strong>${inviterEmail}</strong> invited you to join <strong>${teamName}</strong> on TeamPulse.</p><p>Use invite code <strong>${inviteCode}</strong> after signing in at <a href="${appUrl}">${appUrl}</a>.</p>`,
  });
}

async function sendContactEmail({ name, email, message }) {
  if (!contactToEmail) {
    const error = new Error("Contact delivery is not configured yet.");
    error.status = 503;
    throw error;
  }

  try {
    return await sendMail({
      to: contactToEmail,
      replyTo: email,
      subject: `ValidationEngine contact from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
      html: `<p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>`,
    });
  } catch (error) {
    logger.error("email.contact_failed", {
      to: redactEmail(contactToEmail),
      replyTo: redactEmail(email),
      error: serializeError(error),
    });
    throw error;
  }
}

module.exports = {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendInviteEmail,
  sendContactEmail,
};
