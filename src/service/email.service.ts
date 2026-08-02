import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail({
  to,
  cc,
  subject,
  html,
}: {
  to: string;
  cc?: string | string[];
  subject: string;
  html: string;
}) {
  return transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    cc,
    subject,
    html,
  });
}