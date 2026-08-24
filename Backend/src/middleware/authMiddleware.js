import { supabase } from '../config/supabase.js';
import { query } from '../config/db.js';

/**
 * Express Middleware: Verifies Supabase Bearer JWT token in Authorization header.
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
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired access token.',
        error: error?.message,
      });
    }

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

    // Fallback if registered in Supabase but profile record not yet in PostgreSQL
    req.user = {
      id: null,
      supabase_user_id: supabaseUserId,
      email: data.user.email,
      role: 'customer',
      type: 'guest',
      supabaseUser: data.user,
    };
    next();
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
    const { data } = await supabase.auth.getUser(token);

    if (data?.user) {
      const supabaseUserId = data.user.id;
      const empRes = await query('SELECT * FROM employees WHERE supabase_user_id = $1', [supabaseUserId]);
      if (empRes.rows.length > 0) {
        req.user = { ...empRes.rows[0], type: 'employee', supabaseUser: data.user };
      } else {
        const custRes = await query('SELECT * FROM customers WHERE supabase_user_id = $1', [supabaseUserId]);
        if (custRes.rows.length > 0) {
          req.user = { ...custRes.rows[0], role: 'customer', type: 'customer', supabaseUser: data.user };
        }
      }
    }
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
