// routes/promotion.routes.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// ============================================
// LISTE DES PROMOTIONS
// ============================================

router.get("/", async (req, res, next) => {
  try {
    const { estActive } = req.query;

    let where = {};
    if (estActive !== undefined) {
      where.estActive = estActive === "true";
    }

    const promotions = await prisma.promotion.findMany({
      where,
      include: {
        _count: {
          select: {
            etudiants: true,
            espaces: true,
          },
        },
      },
      orderBy: {
        anneeAcademique: "desc",
      },
    });

    res.json({
      total: promotions.length,
      promotions: promotions.map((p) => ({
        ...p,
        nombreEtudiants: p._count.etudiants,
        nombreEspaces: p._count.espaces,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CRÉER UNE PROMOTION (Directeur)
// ============================================

router.post("/", authorizeRoles("DIRECTEUR"), async (req, res, next) => {
  try {
    const {
      nom,
      code,
      anneeAcademique,
      niveauEtudes,
      dateDebut,
      dateFin,
      capaciteMax,
      description,
    } = req.body;

    // Validation
    if (!nom || !code || !anneeAcademique || !dateDebut || !dateFin) {
      return res.status(400).json({
        error: "Nom, code, année académique, date début et date fin requis",
      });
    }

    const promotion = await prisma.promotion.create({
      data: {
        nom,
        code: code.toUpperCase(),
        anneeAcademique: parseInt(anneeAcademique),
        niveauEtudes,
        dateDebut: new Date(dateDebut),
        dateFin: new Date(dateFin),
        capaciteMax: capaciteMax ? parseInt(capaciteMax) : null,
        description,
        estActive: true,
      },
    });

    res.status(201).json({
      message: "Promotion créée avec succès",
      promotion,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DÉTAILS D'UNE PROMOTION
// ============================================

router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const promotion = await prisma.promotion.findUnique({
      where: { id: parseInt(id) },
      include: {
        etudiants: {
          include: {
            compte: {
              select: {
                email: true,
                estActif: true,
              },
            },
          },
        },
        espaces: {
          include: {
            matiere: true,
            formateur: true,
          },
        },
      },
    });

    if (!promotion) {
      return res.status(404).json({
        error: "Promotion non trouvée",
      });
    }

    res.json(promotion);
  } catch (error) {
    next(error);
  }
});

// ============================================
// MODIFIER UNE PROMOTION (Directeur)
// ============================================

router.put("/:id", authorizeRoles("DIRECTEUR"), async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      nom,
      code,
      anneeAcademique,
      niveauEtudes,
      dateDebut,
      dateFin,
      capaciteMax,
      description,
      estActive,
    } = req.body;

    const promotion = await prisma.promotion.update({
      where: { id: parseInt(id) },
      data: {
        ...(nom && { nom }),
        ...(code && { code: code.toUpperCase() }),
        ...(anneeAcademique && { anneeAcademique: parseInt(anneeAcademique) }),
        ...(niveauEtudes !== undefined && { niveauEtudes }),
        ...(dateDebut && { dateDebut: new Date(dateDebut) }),
        ...(dateFin && { dateFin: new Date(dateFin) }),
        ...(capaciteMax !== undefined && {
          capaciteMax: capaciteMax ? parseInt(capaciteMax) : null,
        }),
        ...(description !== undefined && { description }),
        ...(estActive !== undefined && { estActive }),
      },
    });

    res.json({
      message: "Promotion modifiée avec succès",
      promotion,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// SUPPRIMER UNE PROMOTION (Directeur)
// ============================================

router.delete("/:id", authorizeRoles("DIRECTEUR"), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Vérifier si la promotion a des étudiants
    const promotion = await prisma.promotion.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            etudiants: true,
          },
        },
      },
    });

    if (!promotion) {
      return res.status(404).json({
        error: "Promotion non trouvée",
      });
    }

    if (promotion._count.etudiants > 0) {
      return res.status(400).json({
        error: "Impossible de supprimer une promotion contenant des étudiants",
      });
    }

    await prisma.promotion.delete({
      where: { id: parseInt(id) },
    });

    res.json({
      message: "Promotion supprimée avec succès",
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ACTIVER/DÉSACTIVER UNE PROMOTION (Directeur)
// ============================================

router.patch(
  "/:id/toggle-status",
  authorizeRoles("DIRECTEUR"),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const promotion = await prisma.promotion.findUnique({
        where: { id: parseInt(id) },
      });

      if (!promotion) {
        return res.status(404).json({
          error: "Promotion non trouvée",
        });
      }

      const updated = await prisma.promotion.update({
        where: { id: parseInt(id) },
        data: {
          estActive: !promotion.estActive,
        },
      });

      res.json({
        message: `Promotion ${updated.estActive ? "activée" : "désactivée"} avec succès`,
        estActive: updated.estActive,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
