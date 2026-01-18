// routes/auth.routes.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// ============================================
// LOGIN
// ============================================

router.post("/login", async (req, res, next) => {
  try {
    const { email, motDePasse } = req.body;

    // Validation
    if (!email || !motDePasse) {
      return res.status(400).json({
        error: "Email et mot de passe requis",
      });
    }

    // Trouver le compte
    const compte = await prisma.compte.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        directeur: true,
        formateur: true,
        etudiant: {
          include: {
            promotion: true,
          },
        },
      },
    });

    if (!compte) {
      return res.status(401).json({
        error: "Email ou mot de passe incorrect",
      });
    }

    // Vérifier si le compte est actif
    if (!compte.estActif) {
      return res.status(403).json({
        error: "Compte désactivé. Contactez l'administrateur.",
      });
    }

    // Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(motDePasse, compte.motDePasse);
    if (!isValidPassword) {
      return res.status(401).json({
        error: "Email ou mot de passe incorrect",
      });
    }

    // Mettre à jour la dernière connexion
    await prisma.compte.update({
      where: { id: compte.id },
      data: { derniereConnexion: new Date() },
    });

    // Préparer les données utilisateur
    let userData = {
      id: compte.id,
      email: compte.email,
      role: compte.role,
      premiereConnexion: compte.premiereConnexion,
    };

    if (compte.directeur) {
      userData.directeur = compte.directeur;
    } else if (compte.formateur) {
      userData.formateur = compte.formateur;
    } else if (compte.etudiant) {
      userData.etudiant = compte.etudiant;
    }

    // Générer le token JWT
    const token = jwt.sign(
      {
        userId: compte.id,
        role: compte.role,
      },
      process.env.JWT_SECRET || "votre-secret-jwt-super-securise",
      { expiresIn: "7d" },
    );

    res.json({
      message: "Connexion réussie",
      token,
      user: userData,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CHANGER MOT DE PASSE (PREMIÈRE CONNEXION)
// ============================================

router.post("/change-password", authenticateToken, async (req, res, next) => {
  try {
    const { nouveauMotDePasse } = req.body;
    const userId = req.user.userId;

    if (!nouveauMotDePasse || nouveauMotDePasse.length < 6) {
      return res.status(400).json({
        error: "Le mot de passe doit contenir au moins 6 caractères",
      });
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(nouveauMotDePasse, 10);

    // Mettre à jour le compte
    await prisma.compte.update({
      where: { id: userId },
      data: {
        motDePasse: hashedPassword,
        premiereConnexion: false,
      },
    });

    res.json({
      message: "Mot de passe modifié avec succès",
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// MOT DE PASSE OUBLIÉ
// ============================================

router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: "Email requis",
      });
    }

    const compte = await prisma.compte.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!compte) {
      // Ne pas révéler si l'email existe ou non
      return res.json({
        message:
          "Si cet email existe, un lien de réinitialisation a été envoyé.",
      });
    }

    // TODO: Implémenter l'envoi d'email
    // Pour l'instant, on génère juste un token temporaire
    const resetToken = jwt.sign(
      { userId: compte.id },
      process.env.JWT_SECRET || "votre-secret-jwt-super-securise",
      { expiresIn: "1h" },
    );

    // En production, envoyer cet email
    console.log(`Reset token for ${email}: ${resetToken}`);

    res.json({
      message: "Si cet email existe, un lien de réinitialisation a été envoyé.",
      // En dev uniquement, retourner le token
      ...(process.env.NODE_ENV === "development" && { resetToken }),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// RÉINITIALISER MOT DE PASSE
// ============================================

router.post("/reset-password", async (req, res, next) => {
  try {
    const { token, nouveauMotDePasse } = req.body;

    if (!token || !nouveauMotDePasse) {
      return res.status(400).json({
        error: "Token et nouveau mot de passe requis",
      });
    }

    if (nouveauMotDePasse.length < 6) {
      return res.status(400).json({
        error: "Le mot de passe doit contenir au moins 6 caractères",
      });
    }

    // Vérifier le token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "votre-secret-jwt-super-securise",
    );

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(nouveauMotDePasse, 10);

    // Mettre à jour le compte
    await prisma.compte.update({
      where: { id: decoded.userId },
      data: {
        motDePasse: hashedPassword,
      },
    });

    res.json({
      message: "Mot de passe réinitialisé avec succès",
    });
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        error: "Token invalide ou expiré",
      });
    }
    next(error);
  }
});

// ============================================
// VÉRIFIER TOKEN
// ============================================

router.get("/verify", authenticateToken, async (req, res, next) => {
  try {
    const compte = await prisma.compte.findUnique({
      where: { id: req.user.userId },
      include: {
        directeur: true,
        formateur: true,
        etudiant: {
          include: {
            promotion: true,
          },
        },
      },
    });

    if (!compte || !compte.estActif) {
      return res.status(401).json({
        error: "Compte invalide ou désactivé",
      });
    }

    let userData = {
      id: compte.id,
      email: compte.email,
      role: compte.role,
      premiereConnexion: compte.premiereConnexion,
    };

    if (compte.directeur) {
      userData.directeur = compte.directeur;
    } else if (compte.formateur) {
      userData.formateur = compte.formateur;
    } else if (compte.etudiant) {
      userData.etudiant = compte.etudiant;
    }

    res.json({
      valid: true,
      user: userData,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
