// routes/evaluation.routes.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// ============================================
// ÉVALUER UNE LIVRAISON (Formateur)
// ============================================

router.post(
  "/",
  authorizeRoles("FORMATEUR", "DIRECTEUR"),
  async (req, res, next) => {
    try {
      const { userId, role } = req.user;
      const { livraisonId, note, commentaire } = req.body;

      if (!livraisonId || note === undefined) {
        return res.status(400).json({
          error: "ID de livraison et note requis",
        });
      }

      if (note < 0 || note > 20) {
        return res.status(400).json({
          error: "La note doit être entre 0 et 20",
        });
      }

      // Vérifier la livraison
      const livraison = await prisma.livraison.findUnique({
        where: { id: parseInt(livraisonId) },
        include: {
          evaluations: true,
        },
      });

      if (!livraison) {
        return res.status(404).json({
          error: "Livraison non trouvée",
        });
      }

      // Vérifier si déjà évaluée
      if (livraison.evaluations.length > 0) {
        return res.status(400).json({
          error:
            "Cette livraison a déjà été évaluée. Utilisez la modification d'évaluation.",
        });
      }

      // Récupérer l'évaluateur
      const formateur = await prisma.formateur.findUnique({
        where: { compteId: userId },
      });

      if (!formateur && role !== "DIRECTEUR") {
        return res.status(404).json({
          error: "Profil formateur non trouvé",
        });
      }

      // Créer l'évaluation
      const evaluation = await prisma.evaluation.create({
        data: {
          livraisonId: parseInt(livraisonId),
          note: parseFloat(note),
          commentaire,
          evaluateurId: formateur?.id,
        },
        include: {
          livraison: {
            include: {
              affectation: {
                include: {
                  etudiant: true,
                  travail: {
                    include: {
                      espacePedagogique: {
                        include: {
                          matiere: true,
                        },
                      },
                    },
                  },
                },
              },
              groupe: {
                include: {
                  membres: {
                    include: {
                      etudiant: true,
                    },
                  },
                  travail: {
                    include: {
                      espacePedagogique: {
                        include: {
                          matiere: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      res.status(201).json({
        message: "Évaluation créée avec succès",
        evaluation,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// MODIFIER UNE ÉVALUATION (Directeur uniquement)
// ============================================

router.put("/:id", authorizeRoles("DIRECTEUR"), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;
    const { note, commentaire, raisonModification } = req.body;

    if (!raisonModification) {
      return res.status(400).json({
        error: "Raison de modification requise",
      });
    }

    if (note !== undefined && (note < 0 || note > 20)) {
      return res.status(400).json({
        error: "La note doit être entre 0 et 20",
      });
    }

    // Récupérer le directeur
    const directeur = await prisma.directeur.findUnique({
      where: { compteId: userId },
    });

    if (!directeur) {
      return res.status(404).json({
        error: "Profil directeur non trouvé",
      });
    }

    const evaluation = await prisma.evaluation.update({
      where: { id: parseInt(id) },
      data: {
        ...(note !== undefined && { note: parseFloat(note) }),
        ...(commentaire !== undefined && { commentaire }),
        dateModification: new Date(),
        modificateurId: directeur.id,
        raisonModification,
      },
      include: {
        livraison: {
          include: {
            affectation: {
              include: {
                etudiant: true,
                travail: true,
              },
            },
            groupe: {
              include: {
                membres: {
                  include: {
                    etudiant: true,
                  },
                },
                travail: true,
              },
            },
          },
        },
        evaluateur: {
          select: {
            nom: true,
            prenom: true,
          },
        },
        modificateur: {
          select: {
            nom: true,
            prenom: true,
          },
        },
      },
    });

    res.json({
      message: "Évaluation modifiée avec succès",
      evaluation,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DÉTAILS D'UNE ÉVALUATION
// ============================================

router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const evaluation = await prisma.evaluation.findUnique({
      where: { id: parseInt(id) },
      include: {
        livraison: {
          include: {
            affectation: {
              include: {
                etudiant: {
                  include: {
                    compte: {
                      select: {
                        email: true,
                      },
                    },
                  },
                },
                travail: {
                  include: {
                    espacePedagogique: {
                      include: {
                        matiere: true,
                        promotion: true,
                      },
                    },
                  },
                },
              },
            },
            groupe: {
              include: {
                membres: {
                  include: {
                    etudiant: true,
                  },
                },
                travail: {
                  include: {
                    espacePedagogique: {
                      include: {
                        matiere: true,
                        promotion: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        evaluateur: {
          select: {
            nom: true,
            prenom: true,
            specialite: true,
          },
        },
        modificateur: {
          select: {
            nom: true,
            prenom: true,
          },
        },
      },
    });

    if (!evaluation) {
      return res.status(404).json({
        error: "Évaluation non trouvée",
      });
    }

    res.json(evaluation);
  } catch (error) {
    next(error);
  }
});

// ============================================
// MES NOTES (Étudiant)
// ============================================

router.get(
  "/student/my-grades",
  authorizeRoles("ETUDIANT"),
  async (req, res, next) => {
    try {
      const { userId } = req.user;

      const etudiant = await prisma.etudiant.findUnique({
        where: { compteId: userId },
      });

      if (!etudiant) {
        return res.status(404).json({ error: "Profil étudiant non trouvé" });
      }

      // Évaluations individuelles
      const evaluationsIndividuelles = await prisma.evaluation.findMany({
        where: {
          livraison: {
            affectation: {
              etudiantId: etudiant.id,
            },
          },
        },
        include: {
          livraison: {
            include: {
              affectation: {
                include: {
                  travail: {
                    include: {
                      espacePedagogique: {
                        include: {
                          matiere: true,
                          promotion: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          evaluateur: {
            select: {
              nom: true,
              prenom: true,
            },
          },
          modificateur: {
            select: {
              nom: true,
              prenom: true,
            },
          },
        },
        orderBy: {
          dateEvaluation: "desc",
        },
      });

      // Évaluations de groupe
      const evaluationsGroupes = await prisma.evaluation.findMany({
        where: {
          livraison: {
            groupe: {
              membres: {
                some: {
                  etudiantId: etudiant.id,
                },
              },
            },
          },
        },
        include: {
          livraison: {
            include: {
              groupe: {
                include: {
                  travail: {
                    include: {
                      espacePedagogique: {
                        include: {
                          matiere: true,
                          promotion: true,
                        },
                      },
                    },
                  },
                  membres: {
                    include: {
                      etudiant: true,
                    },
                  },
                },
              },
            },
          },
          evaluateur: {
            select: {
              nom: true,
              prenom: true,
            },
          },
          modificateur: {
            select: {
              nom: true,
              prenom: true,
            },
          },
        },
        orderBy: {
          dateEvaluation: "desc",
        },
      });

      // Calculer les statistiques
      const toutesNotes = [
        ...evaluationsIndividuelles,
        ...evaluationsGroupes,
      ].map((e) => e.note);
      const moyenne =
        toutesNotes.length > 0
          ? (
              toutesNotes.reduce((a, b) => a + b, 0) / toutesNotes.length
            ).toFixed(2)
          : 0;

      res.json({
        individuelles: evaluationsIndividuelles,
        groupes: evaluationsGroupes,
        stats: {
          totalEvaluations: toutesNotes.length,
          moyenne: parseFloat(moyenne),
          noteMin: toutesNotes.length > 0 ? Math.min(...toutesNotes) : 0,
          noteMax: toutesNotes.length > 0 ? Math.max(...toutesNotes) : 0,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// HISTORIQUE DES NOTES PAR MATIÈRE (Étudiant)
// ============================================

router.get(
  "/student/grades-by-subject",
  authorizeRoles("ETUDIANT"),
  async (req, res, next) => {
    try {
      const { userId } = req.user;

      const etudiant = await prisma.etudiant.findUnique({
        where: { compteId: userId },
      });

      if (!etudiant) {
        return res.status(404).json({ error: "Profil étudiant non trouvé" });
      }

      // Toutes les évaluations de l'étudiant
      const evaluationsIndividuelles = await prisma.evaluation.findMany({
        where: {
          livraison: {
            affectation: {
              etudiantId: etudiant.id,
            },
          },
        },
        include: {
          livraison: {
            include: {
              affectation: {
                include: {
                  travail: {
                    include: {
                      espacePedagogique: {
                        include: {
                          matiere: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const evaluationsGroupes = await prisma.evaluation.findMany({
        where: {
          livraison: {
            groupe: {
              membres: {
                some: {
                  etudiantId: etudiant.id,
                },
              },
            },
          },
        },
        include: {
          livraison: {
            include: {
              groupe: {
                include: {
                  travail: {
                    include: {
                      espacePedagogique: {
                        include: {
                          matiere: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Grouper par matière
      const parMatiere = {};

      evaluationsIndividuelles.forEach((evaluations) => {
        const matiere =
          evaluations.livraison.affectation.travail.espacePedagogique.matiere;
        if (!parMatiere[matiere.id]) {
          parMatiere[matiere.id] = {
            matiere: matiere,
            notes: [],
          };
        }
        parMatiere[matiere.id].notes.push(evaluations.note);
      });

      evaluationsGroupes.forEach((evaluations) => {
        const matiere =
          evaluations.livraison.groupe.travail.espacePedagogique.matiere;
        if (!parMatiere[matiere.id]) {
          parMatiere[matiere.id] = {
            matiere: matiere,
            notes: [],
          };
        }
        parMatiere[matiere.id].notes.push(evaluations.note);
      });

      // Calculer les moyennes
      const resultat = Object.values(parMatiere).map((item) => ({
        matiere: item.matiere,
        notes: item.notes,
        moyenne: (
          item.notes.reduce((a, b) => a + b, 0) / item.notes.length
        ).toFixed(2),
        nombreNotes: item.notes.length,
      }));

      res.json({
        parMatiere: resultat,
        moyenneGenerale:
          resultat.length > 0
            ? (
                resultat.reduce(
                  (sum, item) => sum + parseFloat(item.moyenne),
                  0,
                ) / resultat.length
              ).toFixed(2)
            : 0,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// STATISTIQUES GLOBALES (Directeur)
// ============================================

router.get(
  "/stats/global",
  authorizeRoles("DIRECTEUR"),
  async (req, res, next) => {
    try {
      const { promotionId, matiereId } = req.query;

      let where = {};

      if (promotionId || matiereId) {
        where.livraison = {
          OR: [
            {
              affectation: {
                travail: {
                  espacePedagogique: {
                    ...(promotionId && { promotionId: parseInt(promotionId) }),
                    ...(matiereId && { matiereId: parseInt(matiereId) }),
                  },
                },
              },
            },
            {
              groupe: {
                travail: {
                  espacePedagogique: {
                    ...(promotionId && { promotionId: parseInt(promotionId) }),
                    ...(matiereId && { matiereId: parseInt(matiereId) }),
                  },
                },
              },
            },
          ],
        };
      }

      const evaluations = await prisma.evaluation.findMany({
        where,
        select: {
          note: true,
          dateEvaluation: true,
        },
      });

      const notes = evaluations.map((e) => e.note);
      const moyenne =
        notes.length > 0
          ? (notes.reduce((a, b) => a + b, 0) / notes.length).toFixed(2)
          : 0;

      // Distribution des notes
      const distribution = {
        "0-5": notes.filter((n) => n < 5).length,
        "5-10": notes.filter((n) => n >= 5 && n < 10).length,
        "10-15": notes.filter((n) => n >= 10 && n < 15).length,
        "15-20": notes.filter((n) => n >= 15).length,
      };

      res.json({
        totalEvaluations: notes.length,
        moyenne: parseFloat(moyenne),
        noteMin: notes.length > 0 ? Math.min(...notes) : 0,
        noteMax: notes.length > 0 ? Math.max(...notes) : 0,
        distribution,
        tauxReussite:
          notes.length > 0
            ? (
                (notes.filter((n) => n >= 10).length / notes.length) *
                100
              ).toFixed(2)
            : 0,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
