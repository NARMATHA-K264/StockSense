const crypto = require("crypto");
const nodemailer = require("nodemailer");

const DEFAULT_INVITATION_TTL_MS = 24 * 60 * 60 * 1000;

const generateInvitationToken = () => crypto.randomBytes(32).toString("hex");

const hashInvitationToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const getInvitationExpiry = () => new Date(Date.now() + (Number(process.env.INVITATION_EXPIRES_IN_MS) || DEFAULT_INVITATION_TTL_MS));

const buildInvitationUrl = (token) => {
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${normalizedBase}/set-password?token=${encodeURIComponent(token)}`;
};

const getSmtpConfig = () => ({
  host: process.env.SMTP_HOST || process.env.EMAIL_HOST,
  port: Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587),
  user: process.env.SMTP_USER || process.env.EMAIL_USER,
  pass: process.env.SMTP_PASS || process.env.EMAIL_PASSWORD,
  from: process.env.SMTP_FROM || process.env.EMAIL_FROM || "StockSense <noreply@stocksense.local>",
});

const mailTransport = () => {
  const { host, port, user, pass } = getSmtpConfig();

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: Number(port) === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
};

const verifySmtpTransport = async () => {
  const transport = mailTransport();
  if (!transport) {
    throw new Error("SMTP configuration is missing. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.");
  }

  await transport.verify();
  return true;
};

const sendInvitationEmail = async ({ name, email, role, invitationUrl }) => {
  const transport = mailTransport();
  const appName = "StockSense";

  if (!transport) {
    if (process.env.NODE_ENV === "development") {
      return {
        accepted: false,
        invitationUrl,
        message: "Email delivery not configured; invitation URL shown in development.",
      };
    }

    return { accepted: false, invitationUrl: null, message: "Email delivery is not configured." };
  }

  try {
    const mail = {
      from: getSmtpConfig().from,
      to: email,
      subject: "You're invited to StockSense",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #0f172a; max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #dfe7f5; border-radius: 12px; background: #f8fafc;">
          <h2 style="margin: 0 0 12px; color: #0f172a;">Welcome to ${appName}</h2>
          <p style="margin: 0 0 12px;">Hello ${name || "there"},</p>
          <p style="margin: 0 0 12px;">You have been invited to join StockSense as a <strong>${role}</strong>.</p>
          <p style="margin: 0 0 12px;">Please use the invitation link below to access your StockSense account:</p>
          <p style="margin: 0 0 18px;">
            <a href="${invitationUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 22px; border-radius: 8px; text-decoration: none; font-weight: bold;">Activate your account</a>
          </p>
          <p style="margin: 0 0 12px;">${invitationUrl}</p>
          <p style="margin: 0 0 12px;">If you were not expecting this invitation, please contact your administrator.</p>
          <p style="margin: 16px 0 0; color: #475569;">Regards,<br />StockSense Team</p>
        </div>
      `,
    };

    await transport.sendMail(mail);

    return {
      accepted: true,
      invitationUrl,
      message: "Invitation sent successfully.",
    };
  } catch (error) {
    console.error("Invitation email sending failed:", error.message);
    return {
      accepted: false,
      invitationUrl,
      message: "Invitation email could not be sent.",
    };
  }
};

const sendRemovalEmail = async ({ name, email }) => {
  const transport = mailTransport();

  if (!transport) {
    return { accepted: false, message: "Removal email delivery is not configured." };
  }

  try {
    await transport.sendMail({
      from: getSmtpConfig().from,
      to: email,
      subject: "Your StockSense access has been removed",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #0f172a; max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #dfe7f5; border-radius: 12px; background: #f8fafc;">
          <h2 style="margin: 0 0 12px; color: #0f172a;">StockSense access update</h2>
          <p style="margin: 0 0 12px;">Hello ${name || "there"},</p>
          <p style="margin: 0 0 12px;">Your StockSense account access has been removed by the administrator.</p>
          <p style="margin: 0 0 12px;">You will no longer be able to access the StockSense system using this account.</p>
          <p style="margin: 0 0 12px;">If you believe this was done by mistake, please contact your administrator.</p>
          <p style="margin: 16px 0 0; color: #475569;">Regards,<br />StockSense Team</p>
        </div>
      `,
    });

    return { accepted: true, message: "Removal email sent successfully." };
  } catch (error) {
    console.error("Removal email sending failed:", error.message);
    return { accepted: false, message: "Removal email could not be sent." };
  }
};

module.exports = {
  generateInvitationToken,
  hashInvitationToken,
  buildInvitationUrl,
  getInvitationExpiry,
  sendInvitationEmail,
  sendRemovalEmail,
  verifySmtpTransport,
};
