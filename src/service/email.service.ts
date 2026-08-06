import { Resend } from "resend";

// Instancia o cliente do Resend usando a chave das variáveis de ambiente
const resend = new Resend(process.env.RESEND_API_KEY);

export interface SendEmailOptions {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
  }>;
}

// 🚀 Função exportada de envio
export async function sendEmail({
  to,
  cc,
  subject,
  html,
  attachments,
}: SendEmailOptions) {
  const recipients = Array.isArray(to) ? to : [to];
  const ccRecipients = cc ? (Array.isArray(cc) ? cc : [cc]) : undefined;

  // Se ainda não configurou domínio próprio no Resend, use "onboarding@resend.dev"
  const fromAddress = process.env.SMTP_FROM || "Quota <notificacoes@quota.app.br>";

  const { data, error } = await resend.emails.send({
    from: fromAddress,
    to: recipients,
    cc: ccRecipients,
    subject,
    html,
    attachments: attachments?.map((att) => ({
      filename: att.filename,
      content: typeof att.content === "string" ? Buffer.from(att.content) : att.content,
    })),
  });

  if (error) {
    console.error("❌ Erro ao enviar e-mail via Resend:", error);
    throw new Error(error.message);
  }

  console.log("✅ E-mail enviado com sucesso via Resend! ID:", data?.id);
  return data;
}