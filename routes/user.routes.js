// routes/user.routes.js
import express from "express";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// Toutes les routes nécessitent l'authentification
router.use(authenticateToken);

// ============================================
// LISTE DE TOUS LES UTILISATEURS (Directeur)
// ============================================

router.get("/", authorizeRoles("DIRECTEUR"), async (req, res, next) => {
  try {
    const { role, estActif, search } = req.query;

    let where = {};

    if (role) {
      where.role = role;
    }

    if (estActif !== undefined) {
      where.estActif = estActif === "true";
    }

    const comptes = await prisma.compte.findMany({
      where,
      include: {
        directeur: true,
        formateur: true,
        etudiant: {
          include: {
            promotion: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Formater la réponse
    const users = comptes.map((compte) => {
      let user = {
        id: compte.id,
        email: compte.email,
        role: compte.role,
        estActif: compte.estActif,
        premiereConnexion: compte.premiereConnexion,
        dateCreation: compte.dateCreation,
        derniereConnexion: compte.derniereConnexion,
      };

      if (compte.directeur) {
        user = { ...user, ...compte.directeur };
      } else if (compte.formateur) {
        user = { ...user, ...compte.formateur };
      } else if (compte.etudiant) {
        user = { ...user, ...compte.etudiant };
      }

      return user;
    });

    // Filtrer par recherche si nécessaire
    let filteredUsers = users;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredUsers = users.filter(
        (u) =>
          u.nom?.toLowerCase().includes(searchLower) ||
          u.prenom?.toLowerCase().includes(searchLower) ||
          u.email?.toLowerCase().includes(searchLower) ||
          u.matricule?.toLowerCase().includes(searchLower),
      );
    }

    res.json({
      total: filteredUsers.length,
      users: filteredUsers,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CRÉER UN UTILISATEUR (Directeur)
// ============================================

router.post("/", authorizeRoles("DIRECTEUR"), async (req, res, next) => {
  try {
    const { email, role, nom, prenom, ...otherData } = req.body;

    // Validation
    if (!email || !role || !nom || !prenom) {
      return res.status(400).json({
        error: "Email, rôle, nom et prénom requis",
      });
    }

    // Générer un mot de passe temporaire
    const motDePasseTemp = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(motDePasseTemp, 10);

    // Créer le compte et le profil utilisateur en une transaction
    const result = await prisma.$transaction(async (tx) => {
      // Créer le compte
      const compte = await tx.compte.create({
        data: {
          email: email.toLowerCase(),
          motDePasse: hashedPassword,
          role,
          estActif: true,
          premiereConnexion: true,
        },
      });

      // Créer le profil selon le rôle
      let profile;
      if (role === "DIRECTEUR") {
        profile = await tx.directeur.create({
          data: {
            compteId: compte.id,
            nom,
            prenom,
            telephone: otherData.telephone,
          },
        });
      } else if (role === "FORMATEUR") {
        profile = await tx.formateur.create({
          data: {
            compteId: compte.id,
            nom,
            prenom,
            telephone: otherData.telephone,
            specialite: otherData.specialite,
            grade: otherData.grade,
            departement: otherData.departement,
            bureau: otherData.bureau,
          },
        });
      } else if (role === "ETUDIANT") {
        // Générer un matricule unique
        const year = new Date().getFullYear();
        const count = await tx.etudiant.count();
        const matricule = `ETU${year}${String(count + 1).padStart(4, "0")}`;

        // ✅ FIX: Convertir la date en format ISO-8601 DateTime
        let dateNaissanceISO = null;
        if (otherData.dateNaissance) {
          // Si la date est au format "YYYY-MM-DD", ajouter l'heure
          const dateStr = otherData.dateNaissance.includes("T")
            ? otherData.dateNaissance
            : otherData.dateNaissance + "T00:00:00.000Z";
          dateNaissanceISO = new Date(dateStr).toISOString();
        }

        profile = await tx.etudiant.create({
          data: {
            compteId: compte.id,
            nom,
            prenom,
            matricule,
            telephone: otherData.telephone,
            promotionId: otherData.promotionId
              ? parseInt(otherData.promotionId)
              : null,
            dateNaissance: dateNaissanceISO,
            genre: otherData.genre,
            anneeInscription: year,
          },
        });
      }

      return { compte, profile };
    });

    // TODO: Envoyer email avec mot de passe temporaire
    console.log(`Mot de passe temporaire pour ${email}: ${motDePasseTemp}`);

    res.status(201).json({
      message: "Utilisateur créé avec succès",
      user: {
        id: result.compte.id,
        email: result.compte.email,
        role: result.compte.role,
        ...result.profile,
      },
      // En dev uniquement
      ...(process.env.NODE_ENV === "development" && {
        motDePasseTemporaire: motDePasseTemp,
      }),
    });
  } catch (error) {
    console.error("Erreur création utilisateur:", error);
    next(error);
  }
});

// ============================================
// DÉTAILS D'UN UTILISATEUR
// ============================================

router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const compte = await prisma.compte.findUnique({
      where: { id: parseInt(id) },
      include: {
        directeur: true,
        formateur: true,
        etudiant: {
          include: {
            promotion: true,
            inscriptions: {
              include: {
                espacePedagogique: {
                  include: {
                    matiere: true,
                    formateur: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!compte) {
      return res.status(404).json({
        error: "Utilisateur non trouvé",
      });
    }

    // Vérifier les permissions
    if (req.user.role !== "DIRECTEUR" && req.user.userId !== compte.id) {
      return res.status(403).json({
        error: "Accès non autorisé",
      });
    }

    let user = {
      id: compte.id,
      email: compte.email,
      role: compte.role,
      estActif: compte.estActif,
      premiereConnexion: compte.premiereConnexion,
      dateCreation: compte.dateCreation,
      derniereConnexion: compte.derniereConnexion,
    };

    if (compte.directeur) {
      user = { ...user, ...compte.directeur };
    } else if (compte.formateur) {
      user = { ...user, ...compte.formateur };
    } else if (compte.etudiant) {
      user = { ...user, ...compte.etudiant };
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// ============================================
// MODIFIER UN UTILISATEUR
// ============================================

router.put("/:id", authorizeRoles("DIRECTEUR"), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email, estActif, nom, prenom, ...otherData } = req.body;

    const compte = await prisma.compte.findUnique({
      where: { id: parseInt(id) },
      include: {
        directeur: true,
        formateur: true,
        etudiant: true,
      },
    });

    if (!compte) {
      return res.status(404).json({
        error: "Utilisateur non trouvé",
      });
    }

    // Mettre à jour en transaction
    const result = await prisma.$transaction(async (tx) => {
      // Mettre à jour le compte
      const updatedCompte = await tx.compte.update({
        where: { id: parseInt(id) },
        data: {
          ...(email && { email: email.toLowerCase() }),
          ...(estActif !== undefined && { estActif }),
        },
      });

      // Mettre à jour le profil selon le rôle
      let updatedProfile;
      if (compte.role === "DIRECTEUR" && compte.directeur) {
        updatedProfile = await tx.directeur.update({
          where: { id: compte.directeur.id },
          data: {
            ...(nom && { nom }),
            ...(prenom && { prenom }),
            ...(otherData.telephone !== undefined && {
              telephone: otherData.telephone,
            }),
          },
        });
      } else if (compte.role === "FORMATEUR" && compte.formateur) {
        updatedProfile = await tx.formateur.update({
          where: { id: compte.formateur.id },
          data: {
            ...(nom && { nom }),
            ...(prenom && { prenom }),
            ...(otherData.telephone !== undefined && {
              telephone: otherData.telephone,
            }),
            ...(otherData.specialite !== undefined && {
              specialite: otherData.specialite,
            }),
            ...(otherData.grade !== undefined && { grade: otherData.grade }),
            ...(otherData.departement !== undefined && {
              departement: otherData.departement,
            }),
            ...(otherData.bureau !== undefined && { bureau: otherData.bureau }),
          },
        });
      } else if (compte.role === "ETUDIANT" && compte.etudiant) {
        // ✅ FIX: Convertir la date en format ISO-8601 DateTime
        let dateNaissanceISO = undefined;
        if (otherData.dateNaissance) {
          const dateStr = otherData.dateNaissance.includes("T")
            ? otherData.dateNaissance
            : otherData.dateNaissance + "T00:00:00.000Z";
          dateNaissanceISO = new Date(dateStr).toISOString();
        }

        updatedProfile = await tx.etudiant.update({
          where: { id: compte.etudiant.id },
          data: {
            ...(nom && { nom }),
            ...(prenom && { prenom }),
            ...(otherData.telephone !== undefined && {
              telephone: otherData.telephone,
            }),
            ...(otherData.promotionId !== undefined && {
              promotionId: otherData.promotionId
                ? parseInt(otherData.promotionId)
                : null,
            }),
            ...(dateNaissanceISO !== undefined && {
              dateNaissance: dateNaissanceISO,
            }),
            ...(otherData.genre !== undefined && { genre: otherData.genre }),
          },
        });
      }

      return { updatedCompte, updatedProfile };
    });

    res.json({
      message: "Utilisateur modifié avec succès",
      user: {
        ...result.updatedCompte,
        ...result.updatedProfile,
      },
    });
  } catch (error) {
    console.error("Erreur modification utilisateur:", error);
    next(error);
  }
});

// ============================================
// DÉSACTIVER/ACTIVER UN UTILISATEUR
// ============================================

router.patch(
  "/:id/toggle-status",
  authorizeRoles("DIRECTEUR"),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const compte = await prisma.compte.findUnique({
        where: { id: parseInt(id) },
      });

      if (!compte) {
        return res.status(404).json({
          error: "Utilisateur non trouvé",
        });
      }

      const updated = await prisma.compte.update({
        where: { id: parseInt(id) },
        data: {
          estActif: !compte.estActif,
        },
      });

      res.json({
        message: `Compte ${updated.estActif ? "activé" : "désactivé"} avec succès`,
        estActif: updated.estActif,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// SUPPRIMER UN UTILISATEUR
// ============================================

router.delete("/:id", authorizeRoles("DIRECTEUR"), async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.compte.delete({
      where: { id: parseInt(id) },
    });

    res.json({
      message: "Utilisateur supprimé avec succès",
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// LISTE DES COMPTES INACTIFS
// ============================================

router.get(
  "/inactive/list",
  authorizeRoles("DIRECTEUR"),
  async (req, res, next) => {
    try {
      const inactiveAccounts = await prisma.compte.findMany({
        where: { estActif: false },
        include: {
          directeur: true,
          formateur: true,
          etudiant: {
            include: {
              promotion: true,
            },
          },
        },
        orderBy: {
          dateCreation: "desc",
        },
      });

      const users = inactiveAccounts.map((compte) => {
        let user = {
          id: compte.id,
          email: compte.email,
          role: compte.role,
          estActif: compte.estActif,
          dateCreation: compte.dateCreation,
        };

        if (compte.directeur) {
          user = { ...user, ...compte.directeur };
        } else if (compte.formateur) {
          user = { ...user, ...compte.formateur };
        } else if (compte.etudiant) {
          user = { ...user, ...compte.etudiant };
        }

        return user;
      });

      res.json({
        total: users.length,
        users,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
