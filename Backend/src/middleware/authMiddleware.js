import { supabase } from '../config/supabase.js';
import { query } from '../config/db.js';
import { verifySessionHashToken } from '../cryptography/hashToken.js';

/**
 * Express Middleware: Verifies Bearer token in Authorization header.
 * Supports both Supabase Auth JWT tokens and Backend Cryptographic HMAC Session Tokens.
 * Looks up the mapped employee or customer profile in PostgreSQL.
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Missing or malformed Authorization header.',
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Empty Bearer token.',
      });
    }

    // 1. Check if token is a Backend Cryptographic HMAC Session Token
    if (verifySessionHashToken(token)) {
      try {
        const payloadPart = token.split('.')[0];
        const jsonStr = Buffer.from(payloadPart, 'base64url').toString('utf8');
        const sessionPayload = JSON.parse(jsonStr);

        const userId = sessionPayload.userId;
        const userEmail = (sessionPayload.email || '').trim().toLowerCase();
        const role = (sessionPayload.role || 'customer').toLowerCase();

        // Search employees
        if (role !== 'customer') {
          const empRes = await query(
            `SELECT id, supabase_user_id, fullname, username, email, role, is_active 
             FROM employees 
             WHERE (id::text = $1 OR supabase_user_id::text = $1) OR ($2 <> '' AND LOWER(email) = $2)
             LIMIT 1`,
            [userId || '00000000-0000-0000-0000-000000000000', userEmail]
          );

          if (empRes.rows.length > 0) {
            req.user = {
              ...empRes.rows[0],
              type: 'employee',
            };
            return next();
          }
        }

        // Search customers
        const custRes = await query(
          `SELECT id, supabase_user_id, fullname, email, phone, delivery_address 
           FROM customers 
           WHERE (id::text = $1 OR supabase_user_id::text = $1) OR ($2 <> '' AND LOWER(email) = $2)
           LIMIT 1`,
          [userId || '00000000-0000-0000-0000-000000000000', userEmail]
        );

        if (custRes.rows.length > 0) {
          req.user = {
            ...custRes.rows[0],
            role: 'customer',
            type: 'customer',
          };
          return next();
        }

        // Fallback user from validated cryptographic session
        req.user = {
          id: userId,
          email: userEmail,
          role: role || 'customer',
          type: role === 'customer' ? 'customer' : 'employee',
        };
        return next();
      } catch (parseErr) {
        console.warn('Could not extract session payload:', parseErr.message);
      }
    }

    // 2. Check if token is a Supabase JWT Auth Token
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        const supabaseUserId = data.user.id;

        // Check employees table first
        const empRes = await query(
          'SELECT id, supabase_user_id, fullname, username, email, role, pin_code, shift_status, is_active FROM employees WHERE supabase_user_id = $1',
          [supabaseUserId]
        );

        if (empRes.rows.length > 0) {
          req.user = {
            ...empRes.rows[0],
            type: 'employee',
            supabaseUser: data.user,
          };
          return next();
        }

        // Check customers table second
        const custRes = await query(
          'SELECT id, supabase_user_id, fullname, email, phone, delivery_address, loyalty_points FROM customers WHERE supabase_user_id = $1',
          [supabaseUserId]
        );

        if (custRes.rows.length > 0) {
          req.user = {
            ...custRes.rows[0],
            role: 'customer',
            type: 'customer',
            supabaseUser: data.user,
          };
          return next();
        }

        // Registered in Supabase Auth
        req.user = {
          id: null,
          supabase_user_id: supabaseUserId,
          email: data.user.email,
          role: 'customer',
          type: 'guest',
          supabaseUser: data.user,
        };
        return next();
      }
    } catch {
      // Supabase verification failed
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token. Please login again.',
    });
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server authentication failure',
      error: err.message,
    });
  }
}

/**
 * Express Middleware: Optional authentication. Parses token if provided, but does not block if missing.
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      req.user = null;
      return next();
    }

    // 1. Try Cryptographic Session token
    if (verifySessionHashToken(token)) {
      try {
        const payloadPart = token.split('.')[0];
        const jsonStr = Buffer.from(payloadPart, 'base64url').toString('utf8');
        const sessionPayload = JSON.parse(jsonStr);
        req.user = {
          id: sessionPayload.userId,
          email: sessionPayload.email,
          role: sessionPayload.role || 'customer',
          type: sessionPayload.role === 'customer' ? 'customer' : 'employee',
        };
        return next();
      } catch { }
    }

    // 2. Try Supabase Auth token
    try {
      const { data } = await supabase.auth.getUser(token);
      if (data?.user) {
        const supabaseUserId = data.user.id;
        const empRes = await query('SELECT * FROM employees WHERE supabase_user_id = $1', [supabaseUserId]);
        if (empRes.rows.length > 0) {
          req.user = { ...empRes.rows[0], type: 'employee', supabaseUser: data.user };
          return next();
        }
        const custRes = await query('SELECT * FROM customers WHERE supabase_user_id = $1', [supabaseUserId]);
        if (custRes.rows.length > 0) {
          req.user = { ...custRes.rows[0], role: 'customer', type: 'customer', supabaseUser: data.user };
          return next();
        }
      }
    } catch { }

    req.user = null;
  } catch {
    req.user = null;
  }
  next();
}

/**
 * Express Middleware: Enforces Role-Based Access Control (RBAC).
 * Must be used after requireAuth or optionalAuth.
 * @param {Array<string>} allowedRoles List of roles permitted to access endpoint
 */
export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. User context missing.',
      });
    }

    const userRole = (req.user.role || 'customer').toLowerCase();
    const normalizedAllowed = allowedRoles.map(r => r.toLowerCase());

    if (userRole === 'admin' || normalizedAllowed.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access Denied: Role '${userRole}' is not authorized to access this feature resource.`,
      requiredRoles: allowedRoles,
    });
  };
}

export default {
  requireAuth,
  optionalAuth,
  requireRole,
};
