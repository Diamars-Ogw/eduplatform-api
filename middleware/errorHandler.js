// middleware/errorHandler.js

export const errorHandler = (err, req, res, next) => {
  console.error("❌ Error:", err);

  // Erreur Prisma
  if (err.code) {
    if (err.code === "P2002") {
      return res.status(400).json({
        error: "Cette valeur existe déjà dans la base de données",
        field: err.meta?.target,
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({
        error: "Ressource non trouvée",
      });
    }
    if (err.code === "P2003") {
      return res.status(400).json({
        error: "Référence invalide vers une autre ressource",
      });
    }
  }

  // Erreur de validation
  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Erreur de validation",
      details: err.message,
    });
  }

  // Erreur JWT
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      error: "Token invalide",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      error: "Token expiré",
    });
  }

  // Erreur générique
  res.status(err.status || 500).json({
    error: err.message || "Erreur interne du serveur",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
