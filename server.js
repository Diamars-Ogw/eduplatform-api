// server.js - Serveur Express Principal
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import promotionRoutes from "./routes/promotion.routes.js";
import spaceRoutes from "./routes/space.routes.js";
import workRoutes from "./routes/work.routes.js";
import submissionRoutes from "./routes/submission.routes.js";
import evaluationRoutes from "./routes/evaluation.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// MIDDLEWARE
// ============================================

app.use(
  cors({
    origin: "http://localhost:3000", // Changez de 5173 à 3000
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Logs des requêtes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================
// ROUTES
// ============================================

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "EduPlatform API is running",
    timestamp: new Date().toISOString(),
  });
});

// Routes API
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/promotions", promotionRoutes);
app.use("/api/spaces", spaceRoutes);
app.use("/api/works", workRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/evaluations", evaluationRoutes);

// Route 404
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route non trouvée",
    path: req.originalUrl,
  });
});

// Gestionnaire d'erreurs global
app.use(errorHandler);

// ============================================
// DÉMARRAGE SERVEUR
// ============================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🚀 EduPlatform API Server Started   ║
╠════════════════════════════════════════╣
║  Port: ${PORT.toString().padEnd(31)}║
║  Environment: ${(process.env.NODE_ENV || "development").padEnd(22)}║
║  Time: ${new Date().toLocaleString("fr-FR").padEnd(31)}║
╚════════════════════════════════════════╝
  `);
});

// Gestion des erreurs non capturées
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

export default app;
