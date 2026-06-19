import fs from "fs";
import path from "path";

const src = path.join(process.cwd(), "certs/DATABASE_SSL_CERT.squarecloud.txt");
const lines = fs.readFileSync(src, "utf8").split(/\r?\n/);
const quoted = lines.find((l) => l.startsWith('"') || l.startsWith("'"));
if (!quoted) {
  console.error("Linha com certificado não encontrada.");
  process.exit(1);
}
const cert = JSON.parse(quoted);
const out = path.join(process.cwd(), "certs/DATABASE_SSL_CERT.base64.txt");
fs.writeFileSync(
  out,
  `# Cole em DATABASE_SSL_CERT_BASE64 no painel Square Cloud (sem aspas)\n\n${Buffer.from(cert, "utf8").toString("base64")}\n`
);
console.log("Gerado:", out);
