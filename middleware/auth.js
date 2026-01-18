// middleware/auth.js
import jwt from 'jsonwebtoken';

// ============================================
// MIDDLEWARE D'AUTHENTIFICATION
// ============================================

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: 'Token d\'authentification manquant' 
    });
  }

  jwt.verify(
    token, 
    process.env.JWT_SECRET || 'votre-secret-jwt-super-securise', 
    (err, user) => {
      if (err) {
        return res.status(403).json({ 
          error: 'Token invalide ou expiré' 
        });
      }
      req.user = user;
      next();
    }
  );
};

// ============================================
// MIDDLEWARE DE VÉRIFICATION DE RÔLE
// ============================================

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Non authentifié' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Accès non autorisé pour ce rôle',
        requiredRoles: roles,
        userRole: req.user.role
      });
    }

    next();
  };
};

// ============================================
// MIDDLEWARE OPTIONNEL (pour routes publiques)
// ============================================

export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  jwt.verify(
    token, 
    process.env.JWT_SECRET || 'votre-secret-jwt-super-securise', 
    (err, user) => {
      if (!err) {
        req.user = user;
      }
      next();
    }
  );
};