const nodemailer = require("nodemailer");

// If SMTP isn't set up in .env, emails are printed in the terminal instead.
const configured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const port = Number(process.env.SMTP_PORT) || 587;

const transporter = configured
  ? nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  })
  : null;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function frontendLink(page, token) {
  const base = (process.env.FRONTEND_URL || "http://127.0.0.1:5500/frontend").replace(/\/+$/, "");
  return base + "/" + page + "?token=" + encodeURIComponent(token);
}

async function sendMail({ to, subject, text, html }) {
  // Render's free plan blocks SMTP ports, so there we send through Brevo's HTTPS API instead
  if (process.env.BREVO_API_KEY) {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify({
        sender: { email: process.env.BREVO_SENDER, name: "ExamMatrix" },
        to: [{ email: to }],
        subject: subject,
        htmlContent: html
      }),
      signal: AbortSignal.timeout(10000)   // give up after 10 s instead of hanging
    });
    if (!res.ok) {
      throw new Error("Brevo refused the email (" + res.status + "): " + (await res.text()).slice(0, 200));
    }
    return;
  }
  if (!transporter) {
    console.log("\n[mail] SMTP not set up, printing instead of sending");
    console.log("[mail] To: " + to);
    console.log("[mail] Subject: " + subject);
    console.log(text + "\n");
    return;
  }
  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to, subject, text, html
  });
}

function sendVerificationEmail(to, name, token) {
  const link = frontendLink("verify-email.html", token);
  return sendMail({
    to,
    subject: "Verify your ExamMatrix admin email",
    text: "Hi " + name + ",\n\nConfirm your admin email by opening this link (valid for 24 hours):\n" +
      link + "\n\nIf you didn't register, you can ignore this email.",
    html: "<p>Hi " + escapeHtml(name) + ",</p>" +
      "<p>Confirm your admin email for ExamMatrix. The link is valid for 24 hours.</p>" +
      "<p><a href=\"" + link + "\">Verify my email</a></p>" +
      "<p>If you didn't register, you can ignore this email.</p>"
  });
}

function sendResetEmail(to, name, token) {
  const link = frontendLink("reset-password.html", token);
  return sendMail({
    to,
    subject: "Reset your ExamMatrix password",
    text: "Hi " + name + ",\n\nReset your password with this link (valid for 30 minutes):\n" +
      link + "\n\nIf you didn't ask for this, ignore this email. Your password won't change.",
    html: "<p>Hi " + escapeHtml(name) + ",</p>" +
      "<p>Reset your ExamMatrix password. The link is valid for 30 minutes.</p>" +
      "<p><a href=\"" + link + "\">Choose a new password</a></p>" +
      "<p>If you didn't ask for this, ignore this email. Your password won't change.</p>"
  });
}

function sendWelcomeEmail(to, name, universityId) {
  const link = (process.env.FRONTEND_URL || "http://127.0.0.1:5500/frontend").replace(/\/+$/, "") + "/login.html";
  return sendMail({
    to,
    subject: "Your ExamMatrix University ID: " + universityId,
    text: "Hi " + name + ",\n\nYour email is verified and your university is registered.\n\n" +
      "University ID: " + universityId + "\n\nStudents use this ID in Find My Seat. " +
      "Log in with your admin email and password:\n" + link,
    html: "<p>Hi " + escapeHtml(name) + ",</p>" +
      "<p>Your email is verified and your university is registered.</p>" +
      "<p style=\"font-size:20px\"><strong>" + escapeHtml(universityId) + "</strong></p>" +
      "<p>Students use this ID in Find My Seat.</p>" +
      "<p><a href=\"" + link + "\">Log in to ExamMatrix</a></p>"
  });
}

module.exports = { sendVerificationEmail, sendResetEmail, sendWelcomeEmail, escapeHtml };