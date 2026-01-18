// routes/submission.routes.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// ============================================
// SOUMETTRE UN TRAVAIL INDIVIDUEL (Étudiant)
// ============================================

router.post(
  "/individual/:affectationId",
  authorizeRoles("ETUDIANT"),
  async (req, res, next) => {
    try {
      const { affectationId } = req.params;
      const { userId } = req.user;
      const { contenu, fichierUrl } = req.body;

      if (!contenu && !fichierUrl) {
        return res.status(400).json({
          error: "Contenu ou fichier requis",
        });
      }

      // Vérifier l'affectation
      const affectation = await prisma.affectationIndividuelle.findUnique({
        where: { id: parseInt(affectationId) },
        include: {
          etudiant: {
            include: {
              compte: true,
            },
          },
          travail: true,
        },
      });

      if (!affectation) {
        return res.status(404).json({
          error: "Affectation non trouvée",
        });
      }

      // Vérifier que c'est le bon étudiant
      if (affectation.etudiant.compte.id !== userId) {
        return res.status(403).json({
          error: "Vous n'êtes pas autorisé à soumettre ce travail",
        });
      }

      // Vérifier les dates
      const now = new Date();
      if (now < affectation.travail.dateDebut) {
        return res.status(400).json({
          error: "Le travail n'a pas encore commencé",
        });
      }

      const statut = now > affectation.travail.dateFin ? "EN_RETARD" : "LIVRE";

      // Créer ou mettre à jour la livraison
      const existingLivraison = await prisma.livraison.findFirst({
        where: { affectationId: parseInt(affectationId) },
      });

      let livraison;
      if (existingLivraison) {
        livraison = await prisma.livraison.update({
          where: { id: existingLivraison.id },
          data: {
            contenu,
            fichierUrl,
            dateLivraison: new Date(),
            statut,
          },
        });
      } else {
        livraison = await prisma.livraison.create({
          data: {
            affectationId: parseInt(affectationId),
            contenu,
            fichierUrl,
            statut,
          },
        });
      }

      res.status(201).json({
        message: "Travail soumis avec succès",
        livraison,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// SOUMETTRE UN TRAVAIL DE GROUPE (Étudiant)
// ============================================

router.post(
  "/group/:groupeId",
  authorizeRoles("ETUDIANT"),
  async (req, res, next) => {
    try {
      const { groupeId } = req.params;
      const { userId } = req.user;
      const { contenu, fichierUrl } = req.body;

      if (!contenu && !fichierUrl) {
        return res.status(400).json({
          error: "Contenu ou fichier requis",
        });
      }

      // Vérifier le groupe et que l'étudiant en fait partie
      const etudiant = await prisma.etudiant.findUnique({
        where: { compteId: userId },
      });

      const membre = await prisma.membreGroupe.findFirst({
        where: {
          groupeId: parseInt(groupeId),
          etudiantId: etudiant.id,
        },
      });

      if (!membre) {
        return res.status(403).json({
          error: "Vous ne faites pas partie de ce groupe",
        });
      }

      const groupe = await prisma.groupeEtudiant.findUnique({
        where: { id: parseInt(groupeId) },
        include: {
          travail: true,
        },
      });

      if (!groupe) {
        return res.status(404).json({
          error: "Groupe non trouvé",
        });
      }

      // Vérifier les dates
      const now = new Date();
      if (now < groupe.travail.dateDebut) {
        return res.status(400).json({
          error: "Le travail n'a pas encore commencé",
        });
      }

      const statut = now > groupe.travail.dateFin ? "EN_RETARD" : "LIVRE";

      // Créer ou mettre à jour la livraison
      const existingLivraison = await prisma.livraison.findFirst({
        where: { groupeId: parseInt(groupeId) },
      });

      let livraison;
      if (existingLivraison) {
        livraison = await prisma.livraison.update({
          where: { id: existingLivraison.id },
          data: {
            contenu,
            fichierUrl,
            dateLivraison: new Date(),
            statut,
          },
        });
      } else {
        livraison = await prisma.livraison.create({
          data: {
            groupeId: parseInt(groupeId),
            contenu,
            fichierUrl,
            statut,
          },
        });
      }

      res.status(201).json({
        message: "Travail soumis avec succès",
        livraison,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// LISTE DES LIVRAISONS D'UN TRAVAIL (Formateur)
// ============================================

router.get(
  "/work/:travailId",
  authorizeRoles("FORMATEUR", "DIRECTEUR"),
  async (req, res, next) => {
    try {
      const { travailId } = req.params;

      const travail = await prisma.travail.findUnique({
        where: { id: parseInt(travailId) },
        include: {
          affectations: {
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
              livraisons: {
                include: {
                  evaluations: true,
                },
              },
            },
            where: { estSupprime: false },
          },
          groupes: {
            include: {
              membres: {
                include: {
                  etudiant: true,
                },
              },
              livraisons: {
                include: {
                  evaluations: true,
                },
              },
            },
          },
        },
      });

      if (!travail) {
        return res.status(404).json({
          error: "Travail non trouvé",
        });
      }

      // Formater la réponse
      let livraisons = [];

      if (travail.typeTravail === "INDIVIDUEL") {
        livraisons = travail.affectations.map((aff) => ({
          type: "INDIVIDUEL",
          affectationId: aff.id,
          etudiant: aff.etudiant,
          livraison: aff.livraisons[0] || null,
          evaluation: aff.livraisons[0]?.evaluations[0] || null,
        }));
      } else {
        livraisons = travail.groupes.map((grp) => ({
          type: "COLLECTIF",
          groupeId: grp.id,
          nomGroupe: grp.nomGroupe,
          membres: grp.membres,
          livraison: grp.livraisons[0] || null,
          evaluation: grp.livraisons[0]?.evaluations[0] || null,
        }));
      }

      res.json({
        travail: {
          id: travail.id,
          titre: travail.titre,
          typeTravail: travail.typeTravail,
          dateDebut: travail.dateDebut,
          dateFin: travail.dateFin,
        },
        livraisons,
        stats: {
          total: livraisons.length,
          soumises: livraisons.filter((l) => l.livraison !== null).length,
          evaluees: livraisons.filter((l) => l.evaluation !== null).length,
          enRetard: livraisons.filter(
            (l) => l.livraison?.statut === "EN_RETARD",
          ).length,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// DÉTAILS D'UNE LIVRAISON
// ============================================

router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, userId } = req.user;

    const livraison = await prisma.livraison.findUnique({
      where: { id: parseInt(id) },
      include: {
        affectation: {
          include: {
            etudiant: {
              include: {
                compte: true,
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
        evaluations: {
          include: {
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
        },
      },
    });

    if (!livraison) {
      return res.status(404).json({
        error: "Livraison non trouvée",
      });
    }

    // Vérifier les permissions
    if (role === "ETUDIANT") {
      const etudiant = await prisma.etudiant.findUnique({
        where: { compteId: userId },
      });

      const hasAccess =
        (livraison.affectation &&
          livraison.affectation.etudiantId === etudiant.id) ||
        (livraison.groupe &&
          livraison.groupe.membres.some((m) => m.etudiantId === etudiant.id));

      if (!hasAccess) {
        return res.status(403).json({
          error: "Vous n'avez pas accès à cette livraison",
        });
      }
    }

    res.json(livraison);
  } catch (error) {
    next(error);
  }
});

// ============================================
// MES LIVRAISONS (Étudiant)
// ============================================

router.get(
  "/student/my-submissions",
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

      // Livraisons individuelles
      const livraisonsIndividuelles = await prisma.livraison.findMany({
        where: {
          affectation: {
            etudiantId: etudiant.id,
            estSupprime: false,
          },
        },
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
          evaluations: {
            include: {
              evaluateur: {
                select: {
                  nom: true,
                  prenom: true,
                },
              },
            },
          },
        },
      });

      // Livraisons de groupe
      const livraisonsGroupes = await prisma.livraison.findMany({
        where: {
          groupe: {
            membres: {
              some: {
                etudiantId: etudiant.id,
              },
            },
          },
        },
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
              membres: {
                include: {
                  etudiant: true,
                },
              },
            },
          },
          evaluations: {
            include: {
              evaluateur: {
                select: {
                  nom: true,
                  prenom: true,
                },
              },
            },
          },
        },
      });

      res.json({
        individuelles: livraisonsIndividuelles,
        groupes: livraisonsGroupes,
        stats: {
          totalLivraisons:
            livraisonsIndividuelles.length + livraisonsGroupes.length,
          evaluees: [...livraisonsIndividuelles, ...livraisonsGroupes].filter(
            (l) => l.evaluations.length > 0,
          ).length,
          enRetard: [...livraisonsIndividuelles, ...livraisonsGroupes].filter(
            (l) => l.statut === "EN_RETARD",
          ).length,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// MODIFIER UNE LIVRAISON (Étudiant - avant évaluation)
// ============================================

router.put("/:id", authorizeRoles("ETUDIANT"), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;
    const { contenu, fichierUrl } = req.body;

    const livraison = await prisma.livraison.findUnique({
      where: { id: parseInt(id) },
      include: {
        affectation: {
          include: {
            etudiant: {
              include: {
                compte: true,
              },
            },
          },
        },
        groupe: {
          include: {
            membres: {
              include: {
                etudiant: {
                  include: {
                    compte: true,
                  },
                },
              },
            },
          },
        },
        evaluations: true,
      },
    });

    if (!livraison) {
      return res.status(404).json({
        error: "Livraison non trouvée",
      });
    }

    // Vérifier les permissions
    const etudiant = await prisma.etudiant.findUnique({
      where: { compteId: userId },
    });

    const hasAccess =
      (livraison.affectation &&
        livraison.affectation.etudiant.compte.id === userId) ||
      (livraison.groupe &&
        livraison.groupe.membres.some((m) => m.etudiant.compte.id === userId));

    if (!hasAccess) {
      return res.status(403).json({
        error: "Vous n'avez pas accès à cette livraison",
      });
    }

    // Vérifier qu'elle n'a pas été évaluée
    if (livraison.evaluations.length > 0) {
      return res.status(400).json({
        error: "Impossible de modifier une livraison déjà évaluée",
      });
    }

    const updated = await prisma.livraison.update({
      where: { id: parseInt(id) },
      data: {
        ...(contenu !== undefined && { contenu }),
        ...(fichierUrl !== undefined && { fichierUrl }),
        dateLivraison: new Date(),
      },
    });

    res.json({
      message: "Livraison modifiée avec succès",
      livraison: updated,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// SUPPRIMER UNE LIVRAISON (Étudiant - avant évaluation)
// ============================================

router.delete("/:id", authorizeRoles("ETUDIANT"), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;

    const livraison = await prisma.livraison.findUnique({
      where: { id: parseInt(id) },
      include: {
        affectation: {
          include: {
            etudiant: {
              include: {
                compte: true,
              },
            },
          },
        },
        groupe: {
          include: {
            membres: {
              include: {
                etudiant: {
                  include: {
                    compte: true,
                  },
                },
              },
            },
          },
        },
        evaluations: true,
      },
    });

    if (!livraison) {
      return res.status(404).json({
        error: "Livraison non trouvée",
      });
    }

    // Vérifier les permissions
    const hasAccess =
      (livraison.affectation &&
        livraison.affectation.etudiant.compte.id === userId) ||
      (livraison.groupe &&
        livraison.groupe.membres.some((m) => m.etudiant.compte.id === userId));

    if (!hasAccess) {
      return res.status(403).json({
        error: "Vous n'avez pas accès à cette livraison",
      });
    }

    // Vérifier qu'elle n'a pas été évaluée
    if (livraison.evaluations.length > 0) {
      return res.status(400).json({
        error: "Impossible de supprimer une livraison déjà évaluée",
      });
    }

    await prisma.livraison.delete({
      where: { id: parseInt(id) },
    });

    res.json({
      message: "Livraison supprimée avec succès",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
