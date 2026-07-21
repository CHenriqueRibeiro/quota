import "dotenv/config";
import { sendEmail } from "../service/email.service";

await sendEmail({
  to: "chmr66@gmail.com",
  subject: "Teste Quota",
  html: `
    <h1>Seu sistema de alertas está funcionando!</h1>
    <p>Este é um teste enviado pelo Quota.</p>
  `,
});
