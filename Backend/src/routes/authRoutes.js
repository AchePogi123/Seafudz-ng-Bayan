import { Router } from 'express';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { generateSessionHashToken, verifySessionHashToken } from '../cryptography/index.js';

const router = Router();

/**
 * GET /api/auth/me
 * Retrieves current authenticated user profile (Employee or Customer)
 * Requires Bearer JWT token in Authorization header.
 */
router.get('/auth/me', requireAuth, async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve current user profile',
      error: error.message,
    });
  }
});

/**
 * GET /api/users
 * Returns list of all employee staff profiles for management dashboard
 */
router.get('/users', async (req, res) => {
  try {
    const sql = `
      SELECT id, supabase_user_id, fullname, username, email, role, is_active, created_at
      FROM employees
      ORDER BY created_at DESC
    `;
    const { rows } = await query(sql);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve users',
      error: error.message,
    });
  }
});

/**
 * POST /api/auth/login
 * Validates login credentials against employees or customers in PostgreSQL
 * Accepts supabaseUserId, email, or username
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { username, supabaseUserId, email } = req.body;
    const searchValue = (email || username || '').trim();

    // 1. Search employees table
    let empSql = `SELECT * FROM employees WHERE 1=0`;
    let empParams = [];

    if (supabaseUserId) {
      empSql = `SELECT * FROM employees WHERE supabase_user_id = $1`;
      empParams = [supabaseUserId];
    } else if (email) {
      empSql = `SELECT * FROM employees WHERE LOWER(email) = LOWER($1)`;
      empParams = [email.trim()];
    } else if (username) {
      empSql = `SELECT * FROM employees WHERE LOWER(username) = LOWER($1)`;
      empParams = [username.trim()];
    }

    if (empParams.length > 0) {
      const empRes = await query(empSql, empParams);
      if (empRes.rows.length > 0) {
        const emp = empRes.rows[0];
        const cryptoSession = generateSessionHashToken({ userId: emp.id, email: emp.email, role: emp.role });
        return res.status(200).json({
          success: true,
          message: `Login successful for ${emp.fullname}`,
          data: emp,
          sessionToken: cryptoSession.sessionToken,
          hashToken: cryptoSession.hashToken,
          sessionTokenUrlParam: `session_token=${cryptoSession.sessionToken}`,
        });
      }
    }

    // 2. Search customers table
    let custSql = `SELECT * FROM customers WHERE 1=0`;
    let custParams = [];

    if (supabaseUserId) {
      custSql = `SELECT * FROM customers WHERE supabase_user_id = $1`;
      custParams = [supabaseUserId];
    } else if (searchValue) {
      custSql = `SELECT * FROM customers WHERE LOWER(email) = LOWER($1) OR LOWER(fullname) = LOWER($1)`;
      custParams = [searchValue];
    }

    if (custParams.length > 0) {
      const custRes = await query(custSql, custParams);
      if (custRes.rows.length > 0) {
        const cust = custRes.rows[0];
        const cryptoSession = generateSessionHashToken({ userId: cust.id, email: cust.email, role: 'customer' });
        return res.status(200).json({
          success: true,
          message: `Login successful for ${cust.fullname}`,
          data: { ...cust, role: 'customer' },
          sessionToken: cryptoSession.sessionToken,
          hashToken: cryptoSession.hashToken,
          sessionTokenUrlParam: `session_token=${cryptoSession.sessionToken}`,
        });
      }
    }

    return res.status(404).json({
      success: false,
      message: 'User profile record not found in database',
    });
  } catch (error) {
    console.error('Error authenticating user:', error);
    return res.status(500).json({
      success: false,
      message: 'Login authentication failed',
      error: error.message,
    });
  }
});

/**
 * POST /api/auth/register
 * Provision user/employee profile in PostgreSQL database linked to Supabase Auth UID
 */
router.post('/auth/register', async (req, res) => {
  try {
    const { fullname, username, email, role, token, phone, address } = req.body;

    if (!fullname || !email) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields (fullname, email)',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanFullname = fullname.trim();
    const selectedRole = (role || 'customer').toLowerCase();

    // Staff/Employee account creation
    if (selectedRole !== 'customer') {
      const validStaffToken = (process.env.STAFF_REGISTRATION_TOKEN || 'SFB-STAFF-99').toUpperCase();
      if (token && token.trim().toUpperCase() !== validStaffToken) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: Invalid Employee Access Token for staff account.',
        });
      }

      // Ensure role is valid according to schema CHECK constraint
      const validRoles = ['admin', 'cashier', 'assistant', 'kitchen', 'rider'];
      const finalRole = validRoles.includes(selectedRole) ? selectedRole : 'cashier';

      // Generate clean unique username if not supplied
      const cleanUsername = (username || cleanEmail.split('@')[0] + '_' + Math.floor(100 + Math.random() * 900)).trim().toLowerCase();

      const sql = `
        INSERT INTO employees (supabase_user_id, fullname, username, email, role)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email) DO UPDATE SET
          supabase_user_id = COALESCE(EXCLUDED.supabase_user_id, employees.supabase_user_id),
          fullname = EXCLUDED.fullname,
          role = EXCLUDED.role
        RETURNING id, supabase_user_id, fullname, username, email, role, is_active, created_at
      `;

      const { rows } = await query(sql, [
        req.body.supabaseUserId || null,
        cleanFullname,
        cleanUsername,
        cleanEmail,
        finalRole,
      ]);

      const emp = rows[0];
      const cryptoSession = generateSessionHashToken({ userId: emp.id, email: emp.email, role: emp.role });

      return res.status(201).json({
        success: true,
        message: `Staff profile provisioned successfully for ${cleanFullname}`,
        data: emp,
        sessionToken: cryptoSession.sessionToken,
        hashToken: cryptoSession.hashToken,
        sessionTokenUrlParam: `session_token=${cryptoSession.sessionToken}`,
      });
    } else {
      // Customer account creation
      const sql = `
        INSERT INTO customers (supabase_user_id, fullname, email, phone, delivery_address)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email) DO UPDATE SET
          supabase_user_id = COALESCE(EXCLUDED.supabase_user_id, customers.supabase_user_id),
          fullname = EXCLUDED.fullname,
          phone = COALESCE(EXCLUDED.phone, customers.phone),
          delivery_address = COALESCE(EXCLUDED.delivery_address, customers.delivery_address)
        RETURNING id, supabase_user_id, fullname, email, phone, delivery_address, created_at
      `;

      const { rows } = await query(sql, [
        req.body.supabaseUserId || null,
        cleanFullname,
        cleanEmail,
        phone || null,
        address || null,
      ]);

      const cust = rows[0];
      const cryptoSession = generateSessionHashToken({ userId: cust.id, email: cust.email, role: 'customer' });

      return res.status(201).json({
        success: true,
        message: `Customer profile provisioned successfully for ${cleanFullname}`,
        data: { ...cust, role: 'customer' },
        sessionToken: cryptoSession.sessionToken,
        hashToken: cryptoSession.hashToken,
        sessionTokenUrlParam: `session_token=${cryptoSession.sessionToken}`,
      });
    }
  } catch (error) {
    console.error('Error registering user:', error);
    return res.status(500).json({
      success: false,
      message: 'User profile registration failed',
      error: error.message,
    });
  }
});

/**
 * GET /api/auth/verify-token
 * Validates a cryptographic session hash token
 */
router.get('/auth/verify-token', (req, res) => {
  const token = req.query.session_token || req.query.token;
  const isValid = verifySessionHashToken(token);

  if (!isValid) {
    return res.status(400).json({
      success: false,
      valid: false,
      message: 'Invalid or missing cryptographic session hash token',
    });
  }

  return res.status(200).json({
    success: true,
    valid: true,
    message: 'Cryptographic session hash token is valid',
  });
});

/**
 * POST /api/auth/logout
 * Confirms user session termination
 */
router.post('/auth/logout', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

export default router;
