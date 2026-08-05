import nodemailer from "nodemailer";
import tls from "node:tls";

const isSecure = Number(process.env.SMTP_PORT || 465) === 465;

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 465),
  secure: isSecure,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },

  // 🚀 Força o Bun a criar a conexão TCP puramente sobre IPv4
  getSocket: (options, callback) => {
    const socket = tls.connect({
      host: options.host,
      port: options.port,
      family: 4, // Força IPv4
      servername: options.host,
    }, () => {
      callback(null, { connection: socket });
    });

    socket.on("error", (err) => {
      callback(err, null);
    });
  },

  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 15000,
} as nodemailer.TransportOptions);