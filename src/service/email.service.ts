import nodemailer from "nodemailer";

// Confirmação rápida das variáveis no startup
console.log("⚙️ Configurando SMTP com os seguintes dados:");
console.log({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 465,
  user: process.env.SMTP_USER,
});

const isSecure = Number(process.env.SMTP_PORT || 465) === 465;

// Instância do transporter do Nodemailer
export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 465),
  secure: isSecure, // true para porta 465 (SSL), false para 587 (STARTTLS)
  requireTLS: !isSecure,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // Lembre-se: Use Senha de App do Google!
  },

  // 🚀 FORÇA O USO EXCLUSIVO DE IPV4 (Resolve a falha no IPv6 no Railway/Bun)
  family: 4,

  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,

  tls: {
    rejectUnauthorized: true,
  },
} as nodemailer.TransportOptions);

// Teste de conexão ao subir a aplicação
transporter.verify((err, success) => {
  if (err) {
    console.error("❌ Erro ao conectar no SMTP:", err);
  } else {
    console.log("✅ SMTP conectado com sucesso no Railway!");
  }
});

// Interface de parâmetros do e-mail
interface SendEmailOptions {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
  attachments?: nodemailer.SendMailOptions["attachments"];
}

// Função exportada para envio dos e-mails
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