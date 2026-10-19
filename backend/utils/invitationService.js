const crypto = require("crypto");

const DEFAULT_INVITATION_TTL_MS = 24 * 60 * 60 * 1000;

const generateInvitationToken = () => crypto.randomBytes(32).toString("hex");

const hashInvitationToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const getInvitationExpiry = () => new Date(Date.now() + (Number(process.env.INVITATION_EXPIRES_IN_MS) || DEFAULT_INVITATION_TTL_MS));

const buildInvitationUrl = (token) => {
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${normalizedBase}/set-password?token=${encodeURIComponent(token)}`;
};

const getEmailConfig = () => ({
  apiKey: process.env.RESEND_API_KEY,
  from: process.env.EMAIL_FROM,
});

const hasEmailConfig = () => {
  const { apiKey, from } = getEmailConfig();
  return Boolean(apiKey && from);
};

const verifyEmailProvider = async () => {
  if (!hasEmailConfig()) {
    throw new Error("Email provider configuration is missing. Set RESEND_API_KEY and EMAIL_FROM.");
  }

  return true;
};

const sendEmail = async ({ to, subject, html }) => {
  const { apiKey, from } = getEmailConfig();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!response.ok) {
    throw new Error(`Email provider request failed with status ${response.status}`);
  }
};

const sendInvitationEmail = async ({ name, email, role, invitationUrl }) => {
  const appName = "StockSense";

  if (!hasEmailConfig()) {
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
    const html = `
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
      `;

    await sendEmail({
      to: email,
      subject: "You're invited to StockSense",
      html,
    });

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
  if (!hasEmailConfig()) {
    return { accepted: false, message: "Removal email delivery is not configured." };
  }

  try {
    await sendEmail({
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
  verifyEmailProvider,
};
