import nodemailer from "nodemailer";
import tls from "node:tls";

const isSecure = Number(process.env.SMTP_PORT || 465) === 465;

// Instância e configuração do Transporter
export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 465),
  secure: isSecure,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },

  // 🚀 Força conexão TCP sobre IPv4 no Bun/Railway
  getSocket: (options, callback) => {
    const socket = tls.connect(
      {
        host: options.host,
        port: options.port,
        family: 4,
        servername: options.host,
      },
      () => {
        callback(null, { connection: socket });
      }
    );

    socket.on("error", (err) => {
      callback(err, null);
    });
  },

  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 15000,
} as nodemailer.TransportOptions);

// Interface para os parâmetros de envio
export interface SendEmailOptions {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
  attachments?: nodemailer.SendMailOptions["attachments"];
}

// 🚀 EXPORT DA FUNÇÃO sendEmail (Resolve o erro de sintaxe)
export async function sendEmail({
  to,
  cc,
  subject,
  html,
  attachments,
}: SendEmailOptions) {
  return transporter.sendMail({
    from: process.env.SMTP_FROM || `"HubQuota" <${process.env.SMTP_USER}>`,
    to,
    cc,
    subject,
    html,
    attachments,
  });
}