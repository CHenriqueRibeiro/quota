import crypto from "crypto";


const publicKey =
  crypto
    .randomBytes(32)
    .toString("hex");


console.log("\nPublic Key gerada:");
console.log(publicKey);
console.log("\nUse essa chave no HTML do widget.");