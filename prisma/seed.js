// prisma/seed.js
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Démarrage du seed...");

  // Nettoyer la base de données
  await prisma.evaluation.deleteMany();
  await prisma.livraison.deleteMany();
  await prisma.membreGroupe.deleteMany();
  await prisma.groupeEtudiant.deleteMany();
  await prisma.affectationIndividuelle.deleteMany();
  await prisma.travail.deleteMany();
  await prisma.inscriptionEtudiant.deleteMany();
  await prisma.formateurSecondaire.deleteMany();
  await prisma.espacePedagogique.deleteMany();
  await prisma.etudiant.deleteMany();
  await prisma.formateur.deleteMany();
  await prisma.directeur.deleteMany();
  await prisma.matiere.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.compte.deleteMany();

  console.log("✅ Base de données nettoyée");

  // Hash du mot de passe par défaut
  const defaultPassword = await bcrypt.hash("password123", 10);

  // ============================================
  // CRÉER LE DIRECTEUR
  // ============================================
  const compteDirecteur = await prisma.compte.create({
    data: {
      email: "directeur@eduplatform.com",
      motDePasse: defaultPassword,
      role: "DIRECTEUR",
      estActif: true,
      premiereConnexion: false,
    },
  });

  const directeur = await prisma.directeur.create({
    data: {
      compteId: compteDirecteur.id,
      nom: "ADMIN",
      prenom: "Directeur",
      telephone: "+229 97 00 00 00",
    },
  });

  console.log("✅ Directeur créé:", compteDirecteur.email);

  // ============================================
  // CRÉER DES FORMATEURS
  // ============================================
  const formateurs = [];

  for (let i = 1; i <= 3; i++) {
    const compteFormateur = await prisma.compte.create({
      data: {
        email: `formateur${i}@eduplatform.com`,
        motDePasse: defaultPassword,
        role: "FORMATEUR",
        estActif: true,
        premiereConnexion: false,
      },
    });

    const formateur = await prisma.formateur.create({
      data: {
        compteId: compteFormateur.id,
        nom: `FORMATEUR${i}`,
        prenom: `Prof${i}`,
        specialite:
          i === 1 ? "Mathématiques" : i === 2 ? "Informatique" : "Physique",
        grade: "Professeur",
        departement: "Sciences",
        telephone: `+229 97 00 00 ${10 + i}`,
      },
    });

    formateurs.push(formateur);
  }

  console.log(`✅ ${formateurs.length} formateurs créés`);

  // ============================================
  // CRÉER DES PROMOTIONS
  // ============================================
  const promotion2024 = await prisma.promotion.create({
    data: {
      nom: "Licence 3 Informatique",
      code: "L3INFO2024",
      anneeAcademique: 2024,
      niveauEtudes: "Licence 3",
      dateDebut: new Date("2024-09-01"),
      dateFin: new Date("2025-06-30"),
      capaciteMax: 50,
      description: "Promotion Licence 3 en Informatique",
      estActive: true,
    },
  });

  const promotion2025 = await prisma.promotion.create({
    data: {
      nom: "Master 1 Data Science",
      code: "M1DS2025",
      anneeAcademique: 2025,
      niveauEtudes: "Master 1",
      dateDebut: new Date("2025-09-01"),
      dateFin: new Date("2026-06-30"),
      capaciteMax: 30,
      description: "Promotion Master 1 en Data Science",
      estActive: true,
    },
  });

  console.log("✅ Promotions créées");

  // ============================================
  // CRÉER DES ÉTUDIANTS
  // ============================================
  const etudiants = [];

  for (let i = 1; i <= 10; i++) {
    const compteEtudiant = await prisma.compte.create({
      data: {
        email: `etudiant${i}@eduplatform.com`,
        motDePasse: defaultPassword,
        role: "ETUDIANT",
        estActif: true,
        premiereConnexion: false,
      },
    });

    const etudiant = await prisma.etudiant.create({
      data: {
        compteId: compteEtudiant.id,
        nom: `ETUDIANT${i}`,
        prenom: `Eleve${i}`,
        matricule: `ETU2024${String(i).padStart(4, "0")}`,
        promotionId: i <= 7 ? promotion2024.id : promotion2025.id,
        dateNaissance: new Date("2000-01-01"),
        genre: i % 2 === 0 ? "M" : "F",
        telephone: `+229 97 00 ${String(i).padStart(2, "0")} 00`,
        anneeInscription: 2024,
      },
    });

    etudiants.push(etudiant);
  }

  console.log(`✅ ${etudiants.length} étudiants créés`);

  // ============================================
  // CRÉER DES MATIÈRES
  // ============================================
  const matieres = await Promise.all([
    prisma.matiere.create({
      data: {
        nom: "Programmation Orientée Objet",
        code: "INFO301",
        description: "Introduction à la POO avec Java",
        nombreCredits: 6,
      },
    }),
    prisma.matiere.create({
      data: {
        nom: "Base de Données Avancées",
        code: "INFO302",
        description: "SQL, NoSQL et optimisation",
        nombreCredits: 5,
      },
    }),
    prisma.matiere.create({
      data: {
        nom: "Algorithmique Avancée",
        code: "INFO303",
        description: "Structures de données et complexité",
        nombreCredits: 6,
      },
    }),
  ]);

  console.log(`✅ ${matieres.length} matières créées`);

  // ============================================
  // CRÉER DES ESPACES PÉDAGOGIQUES
  // ============================================
  const espaces = [];

  for (let i = 0; i < matieres.length; i++) {
    const espace = await prisma.espacePedagogique.create({
      data: {
        nom: `${matieres[i].nom} - ${promotion2024.nom}`,
        promotionId: promotion2024.id,
        matiereId: matieres[i].id,
        formateurId: formateurs[i % formateurs.length].id,
        description: `Cours de ${matieres[i].nom}`,
        semestre: 1,
        volumeHoraireTotal: 40,
        dateDebut: new Date("2024-09-01"),
        dateFin: new Date("2025-01-31"),
        estActif: true,
      },
    });

    espaces.push(espace);

    // Inscrire les étudiants de la promotion L3
    const etudiantsL3 = etudiants.filter(
      (e) => e.promotionId === promotion2024.id,
    );
    for (const etudiant of etudiantsL3) {
      await prisma.inscriptionEtudiant.create({
        data: {
          espacePedagogiqueId: espace.id,
          etudiantId: etudiant.id,
        },
      });
    }
  }

  console.log(
    `✅ ${espaces.length} espaces pédagogiques créés avec inscriptions`,
  );

  // ============================================
  // CRÉER DES TRAVAUX
  // ============================================
  const travauxData = [
    {
      titre: "TP1 - Classes et Objets",
      consignes:
        "Créer une hiérarchie de classes pour modéliser un système de gestion de bibliothèque",
      typeTravail: "INDIVIDUEL",
      modeGroupe: "NON_APPLICABLE",
    },
    {
      titre: "Projet - Système de Gestion",
      consignes:
        "Développer en groupe un système complet de gestion avec interface graphique",
      typeTravail: "COLLECTIF",
      modeGroupe: "FORMATEUR",
    },
    {
      titre: "TP2 - Requêtes SQL",
      consignes:
        "Écrire des requêtes SQL complexes pour analyser une base de données",
      typeTravail: "INDIVIDUEL",
      modeGroupe: "NON_APPLICABLE",
    },
  ];

  const travaux = [];
  for (let i = 0; i < travauxData.length; i++) {
    const travail = await prisma.travail.create({
      data: {
        ...travauxData[i],
        espacePedagogiqueId: espaces[i % espaces.length].id,
        dateDebut: new Date("2024-10-01"),
        dateFin: new Date("2024-11-01"),
        createurId: formateurs[i % formateurs.length].id,
        estActif: true,
      },
    });

    travaux.push(travail);

    // Affecter le travail
    if (travail.typeTravail === "INDIVIDUEL") {
      const etudiantsL3 = etudiants.filter(
        (e) => e.promotionId === promotion2024.id,
      );
      for (const etudiant of etudiantsL3) {
        await prisma.affectationIndividuelle.create({
          data: {
            travailId: travail.id,
            etudiantId: etudiant.id,
          },
        });
      }
    }
  }

  console.log(`✅ ${travaux.length} travaux créés avec affectations`);

  // ============================================
  // CRÉER DES GROUPES POUR TRAVAUX COLLECTIFS
  // ============================================
  const travauxCollectifs = travaux.filter(
    (t) => t.typeTravail === "COLLECTIF",
  );
  const etudiantsL3 = etudiants.filter(
    (e) => e.promotionId === promotion2024.id,
  );

  for (const travail of travauxCollectifs) {
    // Créer 2-3 groupes
    for (let g = 1; g <= 2; g++) {
      const groupe = await prisma.groupeEtudiant.create({
        data: {
          travailId: travail.id,
          nomGroupe: `Groupe ${g}`,
          modeFormation: "FORMATEUR",
        },
      });

      // Ajouter 3-4 étudiants par groupe
      const startIndex = (g - 1) * 3;
      for (let m = 0; m < 3 && startIndex + m < etudiantsL3.length; m++) {
        await prisma.membreGroupe.create({
          data: {
            groupeId: groupe.id,
            etudiantId: etudiantsL3[startIndex + m].id,
          },
        });
      }
    }
  }

  console.log("✅ Groupes créés pour les travaux collectifs");

  // ============================================
  // CRÉER QUELQUES LIVRAISONS ET ÉVALUATIONS
  // ============================================
  const affectations = await prisma.affectationIndividuelle.findMany({
    take: 5,
  });

  for (const affectation of affectations) {
    const livraison = await prisma.livraison.create({
      data: {
        affectationId: affectation.id,
        contenu: "Code source du TP avec documentation complète",
        fichierUrl: "https://example.com/travail.zip",
        statut: "LIVRE",
      },
    });

    // Évaluer certaines livraisons
    if (Math.random() > 0.3) {
      await prisma.evaluation.create({
        data: {
          livraisonId: livraison.id,
          note: Math.floor(Math.random() * 10) + 10, // Note entre 10 et 20
          commentaire: "Bon travail, continuez ainsi !",
          evaluateurId: formateurs[0].id,
        },
      });
    }
  }

  console.log("✅ Livraisons et évaluations créées");

  console.log("\n🎉 Seed terminé avec succès !");
  console.log("\n📧 Comptes créés (mot de passe: password123):");
  console.log("   - directeur@eduplatform.com");
  console.log("   - formateur1@eduplatform.com");
  console.log("   - formateur2@eduplatform.com");
  console.log("   - formateur3@eduplatform.com");
  console.log("   - etudiant1@eduplatform.com (et jusqu'à etudiant10)");
}

main()
  .catch((e) => {
    console.error("❌ Erreur lors du seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
