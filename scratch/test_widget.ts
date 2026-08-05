import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function main() {
  const widget = await prisma.widget.findFirst({
    include: {
      assistant: true,
    },
  });

  if (!widget) {
    console.log("Nenhum widget encontrado no banco de dados.");
    return;
  }

  console.log("=== TESTANDO WIDGET ===");
  console.log("Widget ID:", widget.id);
  console.log("Nome:", widget.name);
  console.log("Public Key:", widget.publicKey);

  // 1. Testar se o arquivo public/widget.js é servido pelo backend
  try {
    const jsRes = await fetch(`${BASE_URL}/widget.js`);
    console.log(`1. Status do script /widget.js: ${jsRes.status} ${jsRes.statusText}`);
    if (jsRes.ok) {
      const text = await jsRes.text();
      console.log(`   /widget.js carregado com sucesso (${text.length} bytes)`);
    } else {
      console.error("   [FALHA] Não foi possível carregar /widget.js");
    }
  } catch (err: any) {
    console.error("   [ERRO] Falha de conexão ao buscar /widget.js:", err.message);
  }

  // 2. Testar endpoint público de informações do widget
  try {
    const infoRes = await fetch(`${BASE_URL}/widget/public/${widget.publicKey}`);
    console.log(`2. Status info pública (/widget/public/...): ${infoRes.status}`);
    if (infoRes.ok) {
      const data = await infoRes.json();
      console.log("   Dados recebidos:", JSON.stringify(data, null, 2));
    }
  } catch (err: any) {
    console.error("   [ERRO] Falha ao consultar endpoint público:", err.message);
  }

  // 3. Testar endpoint de inicialização de sessão (/widget/init/...)
  try {
    const initRes = await fetch(`${BASE_URL}/widget/init/${widget.publicKey}`);
    console.log(`3. Status init sessão (/widget/init/...): ${initRes.status}`);
    if (initRes.ok) {
      const data = await initRes.json();
      console.log("   Sessão criada com sucesso!");
      console.log("   Session token:", data.sessionToken);
    }
  } catch (err: any) {
    console.error("   [ERRO] Falha ao inicializar sessão do widget:", err.message);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
