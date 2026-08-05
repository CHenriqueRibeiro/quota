import dns from "node:dns";
import nodemailer from "nodemailer";

// Prefere IPv4 antes de IPv6
dns.setDefaultResultOrder("ipv4first");

console.log({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER,
});
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465, // true apenas se usar 465
  requireTLS: Number(process.env.SMTP_PORT) === 587, // TLS para 587

  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },

  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,

  tls: {
    rejectUnauthorized: true,
  },
});

// Verifica a conexão ao iniciar
transporter.verify((err, success) => {
  if (err) {
    console.error("❌ Erro ao conectar no SMTP:", err);
  } else {
    console.log("✅ SMTP conectado com sucesso.");
  }
});

export async function sendEmail({
  to,
  cc,
  subject,
  html,
  attachments,
}: {
  to: string;
  cc?: string | string[];
  subject: string;
  html: string;
  attachments?: nodemailer.SendMailOptions["attachments"];
}) {
  return transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    cc,
    subject,
    html,
    attachments,
  });
}