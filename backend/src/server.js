import dotenv from "dotenv";
import app from "./app.js";

dotenv.config();

const PORT = process.env.PORT || 6001;
const HOST = process.env.HOST || undefined;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('Configura JWT_SECRET con al menos 32 caracteres.');
}

app.listen(PORT, HOST, () => {
  console.log(`Servidor corriendo en http://${HOST || 'localhost'}:${PORT}`);
});
