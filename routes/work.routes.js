// routes/work.routes.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// ============================================
// LISTE DES TRAVAUX
// ============================================

router.get('/', async (req, res, next) => {
  try {
    const { role, userId } = req.user;
    const { espacePedagogiqueId, estActif } = req.query;

    let where = {};

    if (espacePedagogiqueId) {
      where.espacePedagogiqueId = parseInt(espacePedagogiqueId);
    }

    if (estActif !== undefined) {
      where.estActif = estActif === 'true';
    }

    // Filtrer selon le rôle
    if (role === 'FORMATEUR') {
      const formateur = await prisma.formateur.findUnique({
        where: { compteId: userId }
      });

      if (!formateur) {
        return res.status(404).json({ error: 'Profil formateur non trouvé' });
      }

      where.createurId = formateur.id;
    } else if (role === 'ETUDIANT') {
      const etudiant = await prisma.etudiant.findUnique({
        where: { compteId: userId },
        include: {
          inscriptions: {
            select: { espacePedagogiqueId: true }
          }
        }
      });

      if (!etudiant) {
        return res.status(404).json({ error: 'Profil étudiant non trouvé' });
      }

      const espacesIds = etudiant.inscriptions.map(i => i.espacePedagogiqueId);
      where.espacePedagogiqueId = { in: espacesIds };
    }

    const travaux = await prisma.travail.findMany({
      where,
      include: {
        espacePedagogique: {
          include: {
            matiere: true,
            promotion: true
          }
        },
        createur: {
          select: {
            id: true,
            nom: true,
            prenom: true
          }
        },
        _count: {
          select: {
            affectations: true,
            groupes: true
          }
        }
      },
      orderBy: {
        dateDebut: 'desc'
      }
    });

    res.json({
      total: travaux.length,
      travaux
    });

  } catch (error) {
    next(error);
  }
});

// ============================================
// CRÉER UN TRAVAIL (Formateur)
// ============================================

router.post('/', authorizeRoles('FORMATEUR', 'DIRECTEUR'), async (req, res, next) => {
  try {
    const { userId } = req.user;
    const {
      espacePedagogiqueId,
      titre,
      consignes,
      typeTravail,
      modeGroupe,
      dateDebut,
      dateFin,
      fichierConsigneUrl
    } = req.body;

    if (!espacePedagogiqueId || !titre || !consignes || !typeTravail || !dateDebut || !dateFin) {
      return res.status(400).json({
        error: 'Tous les champs obligatoires doivent être remplis'
      });
    }

    // Récupérer le formateur
    const formateur = await prisma.formateur.findUnique({
      where: { compteId: userId }
    });

    if (!formateur) {
      return res.status(404).json({ error: 'Profil formateur non trouvé' });
    }

    // Validation du mode groupe
    let finalModeGroupe = modeGroupe || 'NON_APPLICABLE';
    if (typeTravail === 'INDIVIDUEL') {
      finalModeGroupe = 'NON_APPLICABLE';
    } else if (typeTravail === 'COLLECTIF' && finalModeGroupe === 'NON_APPLICABLE') {
      return res.status(400).json({
        error: 'Le mode de groupe est requis pour un travail collectif'
      });
    }

    const travail = await prisma.travail.create({
      data: {
        espacePedagogiqueId: parseInt(espacePedagogiqueId),
        titre,
        consignes,
        typeTravail,
        modeGroupe: finalModeGroupe,
        dateDebut: new Date(dateDebut),
        dateFin: new Date(dateFin),
        fichierConsigneUrl,
        createurId: formateur.id,
        estActif: true
      },
      include: {
        espacePedagogique: {
          include: {
            matiere: true,
            promotion: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Travail créé avec succès',
      travail
    });

  } catch (error) {
    next(error);
  }
});

// ============================================
// DÉTAILS D'UN TRAVAIL
// ============================================

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, userId } = req.user;

    const travail = await prisma.travail.findUnique({
      where: { id: parseInt(id) },
      include: {
        espacePedagogique: {
          include: {
            matiere: true,
            promotion: true
          }
        },
        createur: true,
        affectations: {
          include: {
            etudiant: {
              include: {
                compte: {
                  select: {
                    email: true
                  }
                }
              }
            },
            livraisons: {
              include: {
                evaluations: true
              }
            }
          },
          where: { estSupprime: false }
        },
        groupes: {
          include: {
            membres: {
              include: {
                etudiant: true
              }
            },
            livraisons: {
              include: {
                evaluations: true
              }
            }
          }
        }
      }
    });

    if (!travail) {
      return res.status(404).json({
        error: 'Travail non trouvé'
      });
    }

    // Si étudiant, vérifier qu'il a accès
    if (role === 'ETUDIANT') {
      const etudiant = await prisma.etudiant.findUnique({
        where: { compteId: userId }
      });

      const hasAccess = travail.affectations.some(a => a.etudiantId === etudiant.id) ||
                        travail.groupes.some(g => g.membres.some(m => m.etudiantId === etudiant.id));

      if (!hasAccess) {
        return res.status(403).json({
          error: 'Vous n\'avez pas accès à ce travail'
        });
      }
    }

    res.json(travail);

  } catch (error) {
    next(error);
  }
});

// ============================================
// MODIFIER UN TRAVAIL (Formateur)
// ============================================

router.put('/:id', authorizeRoles('FORMATEUR', 'DIRECTEUR'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      titre,
      consignes,
      typeTravail,
      modeGroupe,
      dateDebut,
      dateFin,
      fichierConsigneUrl,
      estActif
    } = req.body;

    const travail = await prisma.travail.update({
      where: { id: parseInt(id) },
      data: {
        ...(titre && { titre }),
        ...(consignes && { consignes }),
        ...(typeTravail && { typeTravail }),
        ...(modeGroupe !== undefined && { modeGroupe }),
        ...(dateDebut && { dateDebut: new Date(dateDebut) }),
        ...(dateFin && { dateFin: new Date(dateFin) }),
        ...(fichierConsigneUrl !== undefined && { fichierConsigneUrl }),
        ...(estActif !== undefined && { estActif })
      }
    });

    res.json({
      message: 'Travail modifié avec succès',
      travail
    });

  } catch (error) {
    next(error);
  }
});

// ============================================
// SUPPRIMER UN TRAVAIL (Formateur)
// ============================================

router.delete('/:id', authorizeRoles('FORMATEUR', 'DIRECTEUR'), async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.travail.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      message: 'Travail supprimé avec succès'
    });

  } catch (error) {
    next(error);
  }
});

// ============================================
// AFFECTER INDIVIDUELLEMENT (Formateur)
// ============================================

router.post('/:id/assign-individual', authorizeRoles('FORMATEUR', 'DIRECTEUR'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { etudiantIds } = req.body;

    if (!etudiantIds || !Array.isArray(etudiantIds)) {
      return res.status(400).json({
        error: 'Liste d\'IDs étudiants requise'
      });
    }

    const travail = await prisma.travail.findUnique({
      where: { id: parseInt(id) }
    });

    if (!travail) {
      return res.status(404).json({ error: 'Travail non trouvé' });
    }

    if (travail.typeTravail !== 'INDIVIDUEL') {
      return res.status(400).json({
        error: 'Ce travail n\'est pas de type individuel'
      });
    }

    const affectations = await prisma.$transaction(
      etudiantIds.map(etudiantId =>
        prisma.affectationIndividuelle.create({
          data: {
            travailId: parseInt(id),
            etudiantId: parseInt(etudiantId)
          },
          include: {
            etudiant: true
          }
        }).catch(() => null) // Ignorer les doublons
      )
    );

    const successCount = affectations.filter(a => a !== null).length;

    res.json({
      message: `${successCount} affectation(s) créée(s) avec succès`,
      affectations: affectations.filter(a => a !== null)
    });

  } catch (error) {
    next(error);
  }
});

// ============================================
// CRÉER UN GROUPE (Formateur ou Étudiant)
// ============================================

router.post('/:id/groups', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, userId } = req.user;
    const { nomGroupe, membresIds } = req.body;

    if (!nomGroupe || !membresIds || !Array.isArray(membresIds)) {
      return res.status(400).json({
        error: 'Nom du groupe et membres requis'
      });
    }

    const travail = await prisma.travail.findUnique({
      where: { id: parseInt(id) }
    });

    if (!travail) {
      return res.status(404).json({ error: 'Travail non trouvé' });
    }

    if (travail.typeTravail !== 'COLLECTIF') {
      return res.status(400).json({
        error: 'Ce travail n\'est pas de type collectif'
      });
    }

    // Vérifier les permissions
    let createurId = null;
    let modeFormation;

    if (role === 'FORMATEUR') {
      const formateur = await prisma.formateur.findUnique({
        where: { compteId: userId }
      });
      createurId = formateur?.id;
      modeFormation = 'FORMATEUR';
    } else if (role === 'ETUDIANT') {
      if (travail.modeGroupe !== 'ETUDIANT') {
        return res.status(403).json({
          error: 'Vous n\'êtes pas autorisé à créer des groupes pour ce travail'
        });
      }
      modeFormation = 'ETUDIANT';
    }

    const groupe = await prisma.$transaction(async (tx) => {
      const newGroupe = await tx.groupeEtudiant.create({
        data: {
          travailId: parseInt(id),
          nomGroupe,
          modeFormation,
          createurId
        }
      });

      await Promise.all(
        membresIds.map(etudiantId =>
          tx.membreGroupe.create({
            data: {
              groupeId: newGroupe.id,
              etudiantId: parseInt(etudiantId)
            }
          })
        )
      );

      return tx.groupeEtudiant.findUnique({
        where: { id: newGroupe.id },
        include: {
          membres: {
            include: {
              etudiant: true
            }
          }
        }
      });
    });

    res.status(201).json({
      message: 'Groupe créé avec succès',
      groupe
    });

  } catch (error) {
    next(error);
  }
});

// ============================================
// LISTE DES GROUPES D'UN TRAVAIL
// ============================================

router.get('/:id/groups', async (req, res, next) => {
  try {
    const { id } = req.params;

    const groupes = await prisma.groupeEtudiant.findMany({
      where: { travailId: parseInt(id) },
      include: {
        membres: {
          include: {
            etudiant: {
              include: {
                compte: {
                  select: {
                    email: true
                  }
                }
              }
            }
          }
        },
        livraisons: {
          include: {
            evaluations: true
          }
        }
      }
    });

    res.json({
      total: groupes.length,
      groupes
    });

  } catch (error) {
    next(error);
  }
});

// ============================================
// MODIFIER UN GROUPE (Formateur)
// ============================================

router.put('/groups/:groupeId', authorizeRoles('FORMATEUR', 'DIRECTEUR'), async (req, res, next) => {
  try {
    const { groupeId } = req.params;
    const { nomGroupe, membresIds } = req.body;

    const groupe = await prisma.$transaction(async (tx) => {
      const updated = await tx.groupeEtudiant.update({
        where: { id: parseInt(groupeId) },
        data: {
          ...(nomGroupe && { nomGroupe })
        }
      });

      if (membresIds && Array.isArray(membresIds)) {
        await tx.membreGroupe.deleteMany({
          where: { groupeId: parseInt(groupeId) }
        });

        await Promise.all(
          membresIds.map(etudiantId =>
            tx.membreGroupe.create({
              data: {
                groupeId: parseInt(groupeId),
                etudiantId: parseInt(etudiantId)
              }
            })
          )
        );
      }

      return tx.groupeEtudiant.findUnique({
        where: { id: parseInt(groupeId) },
        include: {
          membres: {
            include: {
              etudiant: true
            }
          }
        }
      });
    });

    res.json({
      message: 'Groupe modifié avec succès',
      groupe
    });

  } catch (error) {
    next(error);
  }
});

// ============================================
// SUPPRIMER UN GROUPE (Formateur)
// ============================================

router.delete('/groups/:groupeId', authorizeRoles('FORMATEUR', 'DIRECTEUR'), async (req, res, next) => {
  try {
    const { groupeId } = req.params;

    await prisma.groupeEtudiant.delete({
      where: { id: parseInt(groupeId) }
    });

    res.json({
      message: 'Groupe supprimé avec succès'
    });

  } catch (error) {
    next(error);
  }
});

// ============================================
// MES TRAVAUX (Étudiant)
// ============================================

router.get('/student/my-works', authorizeRoles('ETUDIANT'), async (req, res, next) => {
  try {
    const { userId } = req.user;

    const etudiant = await prisma.etudiant.findUnique({
      where: { compteId: userId }
    });

    if (!etudiant) {
      return res.status(404).json({ error: 'Profil étudiant non trouvé' });
    }

    // Travaux individuels
    const travauxIndividuels = await prisma.affectationIndividuelle.findMany({
      where: {
        etudiantId: etudiant.id,
        estSupprime: false
      },
      include: {
        travail: {
          include: {
            espacePedagogique: {
              include: {
                matiere: true
              }
            }
          }
        },
        livraisons: {
          include: {
            evaluations: true
          }
        }
      }
    });

    // Travaux de groupe
    const travauxGroupes = await prisma.membreGroupe.findMany({
      where: {
        etudiantId: etudiant.id
      },
      include: {
        groupe: {
          include: {
            travail: {
              include: {
                espacePedagogique: {
                  include: {
                    matiere: true
                  }
                }
              }
            },
            livraisons: {
              include: {
                evaluations: true
              }
            }
          }
        }
      }
    });

    res.json({
      individuels: travauxIndividuels,
      groupes: travauxGroupes
    });

  } catch (error) {
    next(error);
  }
});

export default router;