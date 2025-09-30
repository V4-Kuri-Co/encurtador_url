import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import shortid from "shortid";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const api_token = process.env.API_TOKEN;
const mongoUri = process.env.DATABASE_URL;

// Cache da conexão para reutilizar entre invocações
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }
  
  const db = await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 5000,
  });
  
  cachedDb = db;
  return db;
}

const urlSchema = new mongoose.Schema({
  originalUrl: { type: String, required: true },
  shortUrl: { type: String, required: true, unique: true },
  completeUrl: { type: String },
});

const Url = mongoose.models.Url || mongoose.model("Url", urlSchema);

app.post("/api/shorten", async (req, res) => {
  try {
    await connectToDatabase();
    
    const { originalUrl, token } = req.body;

    if (!token) {
      return res
        .status(400)
        .json({ error: true, error_txt: "API Token obrigatório" });
    }

    if (token != api_token) {
      return res
        .status(401)
        .json({ error: true, error_txt: "API Token inválido" });
    }

    const shortUrl = shortid.generate();
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const completeUrl = `${baseUrl}/${shortUrl}`;
    const newUrl = new Url({ originalUrl, shortUrl, completeUrl });
    await newUrl.save();
    res.status(201).json({ error: false, originalUrl, shortUrl, completeUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: true, error_txt: error.message });
  }
});

app.get("/:shortUrl", async (req, res) => {
  try {
    await connectToDatabase();
    
    const { shortUrl } = req.params;
    const url = await Url.findOne({ shortUrl });
    if (url) {
      return res.redirect(url.originalUrl);
    } else {
      return res.status(404).json({ error: true, error_txt: "URL não encontrada!" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: true, error_txt: error.message });
  }
});

// Para desenvolvimento local
if (process.env.NODE_ENV !== 'production') {
  const PORT = 3000;
  app.listen(PORT, () => console.log(`Servidor rodando na porta: ${PORT}`));
}

// Exportar para Vercel
export default app;