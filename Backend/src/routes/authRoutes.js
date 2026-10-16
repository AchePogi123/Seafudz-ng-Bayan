import { Router } from 'express';
import crypto from 'crypto';
import { getDbPool, query } from '../config/db.js';
import { supabase } from '../config/supabase.js';
import { activationLimiter } from '../middleware/rateLimiter.js';
import { requireActiveAdmin, requireAuth } from '../middleware/authMiddleware.js';
import { generateSessionHashToken, verifySessionHashToken } from '../cryptography/index.js';
import { hashPassword, verifyPassword } from '../cryptography/passwordHash.js';
import {
  createStaffActivationToken,
  hashStaffActivationToken,
  isValidStaffActivationToken,
  isStaffLoginEligible,
  isValidStaffUsername,
} from '../cryptography/staffActivation.js';
import { sendEmail } from '../services/emailService.js';

const router = Router();

function staffActivationLink(token, req) {
  const configuredBase = process.env.FRONTEND_BASE_URL?.trim();
  const origin = req?.headers?.origin?.trim();

  // If explicitly configured, prioritize that
  let baseUrl = configuredBase;

  // If request comes from a live HTTPS production domain (e.g. seafudzngbayan.app or vercel), use it
  if (!baseUrl && origin && origin.startsWith('https://')) {
    baseUrl = origin;
  }

  // Default to confirmed production domain so invitation emails never link to localhost
  if (!baseUrl) {
    baseUrl = 'https://seafudzngbayan.app';
  }

  const frontendUrl = new URL(baseUrl);
  if (!['http:', 'https:'].includes(frontendUrl.protocol)) {
    throw new Error('FRONTEND_BASE_URL must use HTTP or HTTPS.');
  }
  return `${frontendUrl.origin}/activate-account#token=${encodeURIComponent(token)}`;
}

async function sendStaffActivationEmail(email, token, req) {
  const activationLink = staffActivationLink(token, req);
  await sendEmail({
    to: email,
    subject: 'Activate your Seafudz ng Bayan staff account',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 28px; color: #2d3748; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff;">
        <h2 style="color: #e74c3c; text-align: center; margin: 0 0 20px;">Seafudz ng Bayan</h2>
        <h3 style="text-align: center; margin: 0 0 16px;">Activate your staff account</h3>
        <p style="font-size: 14px; line-height: 1.6; color: #4a5568;">Your administrator created a staff account for you. Set your username and password to activate it.</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${activationLink}" style="background: #e74c3c; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: bold; display: inline-block;">Set up account</a>
        </div>
        <p style="font-size: 12px; color: #718096;">This one-time link expires in 72 hours. If you were not expecting this invitation, you can ignore this email.</p>
      </div>
    `,
  });
}

async function lockUsername(client, username) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext(LOWER($1)))', [username]);
}

async function findAvailableUsername(client, requestedUsername, fullname) {
  const generated = fullname
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 32) || 'staff.user';
  const base = (requestedUsername || generated).trim();
  if (!isValidStaffUsername(base)) return null;

  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const suffixText = suffix === 0 ? '' : `.${suffix}`;
    const candidate = `${base.slice(0, 32 - suffixText.length)}${suffixText}`;
    await lockUsername(client, candidate);
    const { rows } = await client.query(
      'SELECT 1 FROM employees WHERE LOWER(username) = LOWER($1) LIMIT 1',
      [candidate]
    );
    if (rows.length === 0) return candidate;
  }
  return null;
}

/**
 * GET /api/auth/check-supabase
 * Verifies Supabase Auth connection status
 */
router.get('/auth/check-supabase', async (req, res) => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      return res.status(500).json({
        success: false,
        connected: false,
        message: 'Supabase Auth connection error',
        error: error.message,
      });
    }
    return res.status(200).json({
      success: true,
      connected: true,
      message: 'Supabase Auth is connected and operational',
      supabaseUrl: process.env.SUPABASE_URL || 'https://tdvesymqekznyboxtizs.supabase.co',
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      connected: false,
      message: 'Failed to reach Supabase Auth service',
      error: err.message,
    });
  }
});

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
router.get('/users', requireAuth, requireActiveAdmin, async (req, res) => {
  try {
    const sql = `
      SELECT id, supabase_user_id, fullname, username, email, phone, role, is_active, activation_status, created_at
      FROM employees
      ORDER BY created_at ASC
    `;
    const { rows } = await query(sql);

    const formatted = rows.map((emp, index) => ({
      id: `U${String(101 + index).padStart(3, '0')}`,
      db_id: emp.id,
      name: emp.fullname,
      username: emp.username,
      email: emp.email,
      contact: emp.phone || '-',
      role: emp.role === 'kitchen' ? 'Kitchen Staff' : emp.role.charAt(0).toUpperCase() + emp.role.slice(1),
      status: emp.activation_status === 'pending' ? 'pending' : emp.is_active ? 'active' : 'inactive',
    }));

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: formatted,
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
 * POST /api/users
 * Persists a newly created staff employee user into PostgreSQL database
 */
router.post('/users', requireAuth, requireActiveAdmin, async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const contact = typeof req.body?.contact === 'string'
    ? req.body.contact.trim()
    : typeof req.body?.phone === 'string'
      ? req.body.phone.trim()
      : '';
  const roleMap = new Map([
    ['admin', 'admin'],
    ['cashier', 'cashier'],
    ['assistant', 'assistant'],
    ['kitchen', 'kitchen'],
    ['kitchen staff', 'kitchen'],
    ['rider', 'rider'],
  ]);
  const role = roleMap.get(typeof req.body?.role === 'string' ? req.body.role.trim().toLowerCase() : '');
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!name || name.length > 255) {
    return res.status(400).json({ success: false, message: 'A valid staff name is required.' });
  }
  if (!emailPattern.test(email) || email.length > 255) {
    return res.status(400).json({ success: false, message: 'A valid staff email address is required.' });
  }
  if (!role) {
    return res.status(400).json({ success: false, message: 'A valid staff role is required.' });
  }
  if (username && !isValidStaffUsername(username)) {
    return res.status(400).json({
      success: false,
      message: 'Username must be 3–32 characters and use only letters, numbers, dots, underscores, or hyphens.',
    });
  }

  const { token, tokenHash, expiresAt } = createStaffActivationToken();
  let client;
  let employee;
  try {
    client = await (await getDbPool()).connect();
    await client.query('BEGIN');
    const existingEmail = await client.query(
      'SELECT 1 FROM employees WHERE LOWER(email) = $1 UNION ALL SELECT 1 FROM customers WHERE LOWER(email) = $1 LIMIT 1',
      [email]
    );
    if (existingEmail.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'An account with this email address already exists.' });
    }

    const availableUsername = await findAvailableUsername(client, username, name);
    if (!availableUsername) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Could not generate an available username.' });
    }

    const { rows } = await client.query(
      `INSERT INTO employees (
         fullname, username, email, phone, role, is_active, activation_status,
         activation_token_hash, activation_expires_at
       )
       VALUES ($1, $2, $3, $4, $5, FALSE, 'pending', $6, $7)
       RETURNING id, fullname, username, email, phone, role, is_active, activation_status, created_at`,
      [name, availableUsername, email, contact || null, role, tokenHash, expiresAt]
    );
    employee = rows[0];
    await client.query('COMMIT');
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Error creating pending staff account:', error);
    return res.status(error.code === '23505' ? 409 : 500).json({
      success: false,
      message: error.code === '23505'
        ? 'An account with this email or username already exists.'
        : 'Failed to create staff account.',
    });
  } finally {
    client?.release();
  }

  let activationEmailSent = false;
  try {
    await sendStaffActivationEmail(employee.email, token, req);
    activationEmailSent = true;
  } catch (error) {
    console.warn('Staff activation email could not be delivered:', error.message);
  }

  return res.status(201).json({
    success: true,
    message: activationEmailSent
      ? 'Staff account created. Activation email sent.'
      : 'Staff account created pending activation, but the email could not be sent. Resend it from the user list.',
    activationEmailSent,
    data: {
      id: req.body?.id || employee.id,
      db_id: employee.id,
      name: employee.fullname,
      username: employee.username,
      email: employee.email,
      contact: employee.phone || '-',
      role: employee.role === 'kitchen' ? 'Kitchen Staff' : employee.role.charAt(0).toUpperCase() + employee.role.slice(1),
      status: 'pending',
    },
  });
});

router.post('/users/:id/resend-activation', requireAuth, requireActiveAdmin, async (req, res) => {
  const { id } = req.params;
  let client;
  let employee;
  const { token, tokenHash, expiresAt } = createStaffActivationToken();

  try {
    client = await (await getDbPool()).connect();
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT id, email, activation_status
       FROM employees
       WHERE (id::text = $1 OR username = $1 OR email = $1)
       FOR UPDATE`,
      [id]
    );
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Staff account not found.' });
    }
    if (existing.rows[0].activation_status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Only pending accounts can receive activation emails.' });
    }

    const updated = await client.query(
      `UPDATE employees
       SET activation_token_hash = $1, activation_expires_at = $2, updated_at = NOW()
       WHERE id = $3 AND activation_status = 'pending'
       RETURNING id, email`,
      [tokenHash, expiresAt, existing.rows[0].id]
    );
    employee = updated.rows[0];
    await client.query('COMMIT');
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Could not refresh staff activation token:', error);
    return res.status(500).json({ success: false, message: 'Could not resend activation email.' });
  } finally {
    client?.release();
  }

  try {
    await sendStaffActivationEmail(employee.email, token, req);
    return res.status(200).json({ success: true, message: 'A new activation email was sent.' });
  } catch (error) {
    console.warn('Staff activation resend failed:', error.message);
    return res.status(502).json({
      success: false,
      message: 'The activation link was refreshed, but the email could not be sent. Please try again.',
    });
  }
});

router.post('/auth/staff-activation/validate', activationLimiter, async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  if (!isValidStaffActivationToken(token)) {
    return res.status(400).json({ success: false, message: 'This activation link is invalid or expired.' });
  }

  try {
    const { rows } = await query(
      `SELECT fullname, username, email, role
       FROM employees
       WHERE activation_token_hash = $1
         AND activation_status = 'pending'
         AND activation_expires_at > NOW()`,
      [hashStaffActivationToken(token)]
    );
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'This activation link is invalid or expired.' });
    }

    const employee = rows[0];
    return res.status(200).json({
      success: true,
      data: {
        name: employee.fullname,
        username: employee.username,
        email: employee.email,
        role: employee.role === 'kitchen' ? 'Kitchen Staff' : employee.role.charAt(0).toUpperCase() + employee.role.slice(1),
      },
    });
  } catch (error) {
    console.error('Could not validate staff activation link:', error);
    return res.status(500).json({ success: false, message: 'Could not validate this activation link.' });
  }
});

router.post('/auth/staff-activation/complete', activationLimiter, async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!isValidStaffActivationToken(token)) {
    return res.status(400).json({ success: false, message: 'This activation link is invalid or expired.' });
  }
  if (!isValidStaffUsername(username)) {
    return res.status(400).json({
      success: false,
      message: 'Username must be 3–32 characters and use only letters, numbers, dots, underscores, or hyphens.',
    });
  }
  if (password.length < 12 || password.length > 128) {
    return res.status(400).json({ success: false, message: 'Password must be between 12 and 128 characters.' });
  }

  const tokenHash = hashStaffActivationToken(token);
  const passwordHash = await hashPassword(password);
  let client;
  let employee;
  try {
    client = await (await getDbPool()).connect();
    await client.query('BEGIN');
    const pending = await client.query(
      `SELECT id
       FROM employees
       WHERE activation_token_hash = $1
         AND activation_status = 'pending'
         AND activation_expires_at > NOW()
       FOR UPDATE`,
      [tokenHash]
    );
    if (pending.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'This activation link is invalid or expired.' });
    }

    const employeeId = pending.rows[0].id;
    await lockUsername(client, username);
    const conflict = await client.query(
      'SELECT 1 FROM employees WHERE LOWER(username) = LOWER($1) AND id <> $2 LIMIT 1',
      [username, employeeId]
    );
    if (conflict.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'That username is already taken. Please choose another.' });
    }

    const updated = await client.query(
      `UPDATE employees
       SET username = $1,
           password_hash = $2,
           is_active = TRUE,
           activation_status = 'active',
           activation_token_hash = NULL,
           activation_expires_at = NULL,
           activated_at = NOW(),
           updated_at = NOW()
       WHERE id = $3
         AND activation_token_hash = $4
         AND activation_status = 'pending'
         AND activation_expires_at > NOW()
       RETURNING fullname, username, email, role`,
      [username, passwordHash, employeeId, tokenHash]
    );
    if (updated.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'This activation link is invalid or expired.' });
    }
    employee = updated.rows[0];
    await client.query('COMMIT');
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Could not activate staff account:', error);
    return res.status(500).json({ success: false, message: 'Could not activate this account.' });
  } finally {
    client?.release();
  }

  return res.status(200).json({
    success: true,
    message: 'Your staff account is active. You can now sign in.',
    data: {
      name: employee.fullname,
      username: employee.username,
      email: employee.email,
      role: employee.role,
    },
  });
});

/**
 * PATCH /api/users/:id/toggle-status
 * Updates employee active/inactive status in PostgreSQL database
 */
router.patch('/users/:id/toggle-status', requireAuth, requireActiveAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const isActive = status === 'active';

    const sql = `
      UPDATE employees
      SET is_active = $1,
          activation_status = CASE WHEN $1 THEN 'active' ELSE 'inactive' END,
          updated_at = NOW()
      WHERE (id::text = $2 OR username = $2 OR email = $2 OR fullname = $2)
        AND activation_status <> 'pending'
      RETURNING id, fullname, is_active, activation_status
    `;
    const { rows } = await query(sql, [isActive, id]);

    if (rows.length === 0) {
      return res.status(409).json({ success: false, message: 'Pending accounts must be activated through their email link.' });
    }

    return res.status(200).json({
      success: true,
      data: rows[0] || null,
    });
  } catch (error) {
    console.error('Error toggling employee status:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/users/:id
 * Updates an employee staff profile (fullname, username, email, phone, role) in PostgreSQL database
 */
router.put('/users/:id', requireAuth, requireActiveAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, username, email, contact, phone, role } = req.body;
    const cleanName = (name || '').trim();
    const cleanUsername = (username || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (contact || phone || '').trim();

    if (!cleanName) {
      return res.status(400).json({
        success: false,
        message: 'Name cannot be empty',
      });
    }
    if (cleanUsername && !isValidStaffUsername(cleanUsername)) {
      return res.status(400).json({ success: false, message: 'Username must be 3–32 valid characters.' });
    }
    if (cleanUsername) {
      const ownUser = await query(
        'SELECT id FROM employees WHERE id::text = $1 OR username = $1 OR email = $1 LIMIT 1',
        [id]
      );
      if (ownUser.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Employee record not found for update.' });
      }
      const usernameConflict = await query(
        'SELECT 1 FROM employees WHERE LOWER(username) = LOWER($1) AND id <> $2 LIMIT 1',
        [cleanUsername, ownUser.rows[0].id]
      );
      if (usernameConflict.rows.length > 0) {
        return res.status(409).json({ success: false, message: 'That username is already taken.' });
      }
    }

    let dbRole = null;
    if (role) {
      const rawRole = role.toString().trim().toLowerCase();
      if (rawRole.includes('admin')) dbRole = 'admin';
      else if (rawRole.includes('kitchen')) dbRole = 'kitchen';
      else if (rawRole.includes('rider')) dbRole = 'rider';
      else if (rawRole.includes('assistant')) dbRole = 'assistant';
      else if (rawRole.includes('cashier')) dbRole = 'cashier';
    }

    const sql = `
      UPDATE employees
      SET 
        fullname = $1,
        username = COALESCE(NULLIF($2, ''), username),
        email = COALESCE(NULLIF($3, ''), email),
        phone = COALESCE(NULLIF($4, ''), phone),
        role = COALESCE($5, role),
        activation_token_hash = CASE
          WHEN activation_status = 'pending' AND LOWER(COALESCE(NULLIF($3, ''), email)) <> LOWER(email) THEN NULL
          ELSE activation_token_hash
        END,
        activation_expires_at = CASE
          WHEN activation_status = 'pending' AND LOWER(COALESCE(NULLIF($3, ''), email)) <> LOWER(email) THEN NULL
          ELSE activation_expires_at
        END,
        updated_at = NOW()
      WHERE id::text = $6 OR username = $6 OR email = $6
      RETURNING id, fullname, username, email, phone, role, is_active, activation_status
    `;

    const { rows } = await query(sql, [
      cleanName,
      cleanUsername,
      cleanEmail,
      cleanPhone,
      dbRole,
      id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found for update',
      });
    }

    const emp = rows[0];
    return res.status(200).json({
      success: true,
      message: `Employee ${emp.fullname} updated successfully`,
      data: {
        id: id,
        db_id: emp.id,
        name: emp.fullname,
        username: emp.username,
        email: emp.email,
        contact: emp.phone || '-',
        role: emp.role === 'kitchen' ? 'Kitchen Staff' : emp.role.charAt(0).toUpperCase() + emp.role.slice(1),
        status: emp.activation_status === 'pending' ? 'pending' : emp.is_active ? 'active' : 'inactive',
      },
    });
  } catch (error) {
    console.error('Error updating employee profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update employee profile',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/users/:id
 * Permanently deletes a user/employee from PostgreSQL (employees, customers) and Supabase Auth
 */
router.delete('/users/:id', requireAuth, requireActiveAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Find target user details in employees or customers
    const empRes = await query(
      'SELECT id, email, supabase_user_id FROM employees WHERE id::text = $1 OR username = $1 OR email = $1',
      [id]
    );
    const custRes = await query(
      'SELECT id, email, supabase_user_id FROM customers WHERE id::text = $1 OR email = $1',
      [id]
    );

    const targetUser = empRes.rows[0] || custRes.rows[0];
    const targetEmail = targetUser?.email || id;
    const supabaseUserId = targetUser?.supabase_user_id;

    // 2. Delete from PostgreSQL employees and customers tables
    await query('DELETE FROM employees WHERE id::text = $1 OR email = $2 OR username = $2', [id, targetEmail]);
    await query('DELETE FROM customers WHERE id::text = $1 OR email = $2', [id, targetEmail]);

    // 3. Delete from Supabase Auth if supabase_user_id is available or via email lookup
    if (supabaseUserId) {
      try {
        await supabase.auth.admin.deleteUser(supabaseUserId);
      } catch (sErr) {
        console.warn('Supabase Admin deleteUser note:', sErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: `User ${targetEmail} successfully removed from database and Supabase Auth.`,
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete user account',
      error: error.message,
    });
  }
});

/**
 * POST /api/auth/cleanup-user
 * Utility endpoint to purge a test email from customers, employees, and Supabase Auth
 */
router.post('/auth/cleanup-user', requireAuth, requireActiveAdmin, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Delete from PostgreSQL
    await query('DELETE FROM employees WHERE LOWER(email) = $1', [cleanEmail]);
    await query('DELETE FROM customers WHERE LOWER(email) = $1', [cleanEmail]);

    // Delete from Supabase Auth
    try {
      const { data: usersData } = await supabase.auth.admin.listUsers();
      const foundAuthUser = usersData?.users?.find(u => u.email?.toLowerCase() === cleanEmail);
      if (foundAuthUser?.id) {
        await supabase.auth.admin.deleteUser(foundAuthUser.id);
      }
    } catch (sErr) {
      console.warn('Supabase auth cleanup note:', sErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Successfully purged ${cleanEmail} from database and Supabase Auth.`,
    });
  } catch (error) {
    console.error('Error cleaning up user:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/auth/login
 * Authenticates user credentials and returns an HMAC session token and user profile
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { username, email, password, pinCode, loginInput } = req.body;
    const searchValue = (loginInput || email || username || '').trim();

    let verifiedSupabaseUserId = null;

    // 1. If an Authorization Bearer token is passed in header, verify via Supabase Auth
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const { data: sbData } = await supabase.auth.getUser(token);
        if (sbData?.user) {
          verifiedSupabaseUserId = sbData.user.id;
        }
      } catch { }
    }

    if (!searchValue && !verifiedSupabaseUserId) {
      return res.status(400).json({
        success: false,
        message: 'Email or username is required.',
      });
    }

    // 2. Locate user in employees or customers database table
    let emp = null;
    let cust = null;

    if (verifiedSupabaseUserId) {
      try {
        const empRes = await query('SELECT * FROM employees WHERE supabase_user_id = $1', [verifiedSupabaseUserId]);
        if (empRes?.rows?.length > 0) emp = empRes.rows[0];

        if (!emp) {
          const custRes = await query('SELECT * FROM customers WHERE supabase_user_id = $1', [verifiedSupabaseUserId]);
          if (custRes?.rows?.length > 0) cust = custRes.rows[0];
        }
      } catch (dbErr) {
        console.warn('[AUTH] Local database connection note:', dbErr.message);
      }
    }

    if (!emp && !cust && searchValue) {
      try {
        const empRes = await query(
          'SELECT * FROM employees WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)',
          [searchValue]
        );
        if (empRes?.rows?.length > 0) emp = empRes.rows[0];

        if (!emp) {
          const custRes = await query(
            'SELECT * FROM customers WHERE LOWER(email) = LOWER($1) OR LOWER(fullname) = LOWER($1)',
            [searchValue]
          );
          if (custRes?.rows?.length > 0) cust = custRes.rows[0];
        }
      } catch (dbErr) {
        console.warn('[AUTH] Local database connection note:', dbErr.message);
      }
    }

    if (emp && !isStaffLoginEligible(emp)) {
      return res.status(403).json({
        success: false,
        code: emp.activation_status === 'pending' ? 'STAFF_PENDING_ACTIVATION' : 'STAFF_ACCOUNT_INACTIVE',
        message: emp.activation_status === 'pending'
          ? 'This staff account is pending activation. Check your email for the activation link.'
          : 'This staff account is inactive. Contact an administrator.',
      });
    }

    // Direct Supabase Auth Verification Fallback (for local dev / offline DB)
    if (!emp && !cust && password && searchValue.includes('@')) {
      try {
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email: searchValue.trim(),
          password,
        });

        if (!loginError && loginData?.user) {
          const sbUser = loginData.user;
          cust = {
            id: sbUser.id,
            supabase_user_id: sbUser.id,
            fullname: sbUser.user_metadata?.fullname || sbUser.user_metadata?.name || searchValue.split('@')[0],
            email: sbUser.email,
            phone: sbUser.user_metadata?.phone || '0917-000-0000',
            delivery_address: sbUser.user_metadata?.delivery_address || 'Metro Manila Address',
            role: 'customer',
          };
          verifiedSupabaseUserId = sbUser.id;
        }
      } catch { }
    }

    // Fallback: Pre-provisioned Staff Accounts fallback if DB is un-seeded or offline
    if (!emp && !cust && searchValue && process.env.NODE_ENV !== 'production') {
      const lowerKey = searchValue.trim().toLowerCase();
      const defaultStaff = {
        admin1: { id: 'emp-admin-1', fullname: 'Admin Manager', username: 'admin1', email: 'admin@seafudz.ph', role: 'admin', pin_code: '0000' },
        'admin@seafudz.ph': { id: 'emp-admin-1', fullname: 'Admin Manager', username: 'admin1', email: 'admin@seafudz.ph', role: 'admin', pin_code: '0000' },
        'admin2@seafudz.ph': { id: 'emp-admin-2', fullname: 'Super Admin Chief', username: 'admin2', email: 'admin2@seafudz.ph', role: 'admin', pin_code: '0000' },
        assistant1: { id: 'emp-assistant-1', fullname: 'Assistant Grace', username: 'assistant1', email: 'assistant@seafudz.ph', role: 'assistant', pin_code: '4321' },
        'assistant@seafudz.ph': { id: 'emp-assistant-1', fullname: 'Assistant Grace', username: 'assistant1', email: 'assistant@seafudz.ph', role: 'assistant', pin_code: '4321' },
        'joy.floor@seafudz.ph': { id: 'emp-assistant-2', fullname: 'Joy Flores', username: 'joy.floor', email: 'joy.floor@seafudz.ph', role: 'assistant', pin_code: '4321' },
        cashier1: { id: 'emp-cashier-1', fullname: 'Maria Santos', username: 'cashier1', email: 'cashier@seafudz.ph', role: 'cashier', pin_code: '1234' },
        'cashier@seafudz.ph': { id: 'emp-cashier-1', fullname: 'Maria Santos', username: 'cashier1', email: 'cashier@seafudz.ph', role: 'cashier', pin_code: '1234' },
        'zac.cashier@seafudz.ph': { id: 'emp-cashier-2', fullname: 'Zac Cashier', username: 'zac.cashier', email: 'zac.cashier@seafudz.ph', role: 'cashier', pin_code: '1234' },
        kitchen1: { id: 'emp-kitchen-1', fullname: 'Chef Juan Dela Cruz', username: 'kitchen1', email: 'kitchen@seafudz.ph', role: 'kitchen', pin_code: '5678' },
        'kitchen@seafudz.ph': { id: 'emp-kitchen-1', fullname: 'Chef Juan Dela Cruz', username: 'kitchen1', email: 'kitchen@seafudz.ph', role: 'kitchen', pin_code: '5678' },
        'chef.ben@seafudz.ph': { id: 'emp-kitchen-2', fullname: 'Chef Ben', username: 'chef.ben', email: 'chef.ben@seafudz.ph', role: 'kitchen', pin_code: '5678' },
        rider1: { id: 'emp-rider-1', fullname: 'Rider Alex Ramos', username: 'rider1', email: 'rider@seafudz.ph', role: 'rider', pin_code: '9999' },
        'rider@seafudz.ph': { id: 'emp-rider-1', fullname: 'Rider Alex Ramos', username: 'rider1', email: 'rider@seafudz.ph', role: 'rider', pin_code: '9999' },
        'dan.rider@seafudz.ph': { id: 'emp-rider-2', fullname: 'Dan Cruz', username: 'dan.rider', email: 'dan.rider@seafudz.ph', role: 'rider', pin_code: '9999' },
      };

      if (defaultStaff[lowerKey]) {
        emp = defaultStaff[lowerKey];
      }
    }

    // 3. Reject if no employee or customer account exists for the given username/email
    if (!emp && !cust) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email/username or password. Please try again.',
      });
    }

    const userRecord = emp || cust;
    const isEmployee = !!emp;
    const userRole = emp ? emp.role : 'customer';

    // 4. Verify password / PIN if user is not already authenticated via Bearer token
    if (!verifiedSupabaseUserId || (
      isEmployee && userRecord.supabase_user_id !== verifiedSupabaseUserId
    )) {
      let isVerified = false;

      // Default PIN mapping for staff roles as documented in Operations Manual
      const defaultPins = {
        cashier: '1234',
        kitchen: '5678',
        rider: '9999',
        assistant: '4321',
        admin: '0000',
      };
      const submittedPin = String(pinCode || password || '').trim();
      const expectedPin = emp?.pin_code
        ? String(emp.pin_code).trim()
        : emp?.role && !emp?.activated_at
          ? defaultPins[emp.role]
          : null;

      if (isEmployee && expectedPin && submittedPin && expectedPin === submittedPin) {
        isVerified = true;
      }

      // Check password via Supabase Auth using the user's registered email
      if (!isVerified && password && userRecord.email) {
        try {
          const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email: userRecord.email.trim(),
            password,
          });

          if (
            !loginError &&
            loginData?.user &&
            (!isEmployee || (
              userRecord.supabase_user_id &&
              loginData.user.id === userRecord.supabase_user_id
            ))
          ) {
            isVerified = true;
            verifiedSupabaseUserId = loginData.user.id;
          }
        } catch { }
      }

      // Check password via PostgreSQL password_hash fallback
      if (!isVerified && password && userRecord.password_hash) {
        isVerified = await verifyPassword(password, userRecord.password_hash);
        if (isVerified && !userRecord.password_hash.startsWith('scrypt$')) {
          const upgradedHash = await hashPassword(password);
          await query(
            `UPDATE ${isEmployee ? 'employees' : 'customers'} SET password_hash = $1 WHERE id = $2`,
            [upgradedHash, userRecord.id]
          );
        }
      }

      // STRICT SECURITY ENFORCEMENT: If neither PIN nor password verified, block login!
      if (!isVerified) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email/username or password. Please try again.',
        });
      }
    }

    // 5. Generate HMAC session token and return authenticated profile
    const cryptoSession = generateSessionHashToken({
      userId: userRecord.id,
      email: userRecord.email,
      role: userRole,
    });

    const safeUser = isEmployee
      ? {
          id: emp.id,
          supabase_user_id: emp.supabase_user_id,
          fullname: emp.fullname,
          username: emp.username,
          email: emp.email,
          phone: emp.phone,
          role: emp.role,
          is_active: emp.is_active,
        }
      : { ...cust, password_hash: undefined };

    return res.status(200).json({
      success: true,
      message: `Login successful for ${userRecord.fullname || userRecord.email}`,
      data: isEmployee ? safeUser : { ...safeUser, role: 'customer' },
      sessionToken: cryptoSession.sessionToken,
      hashToken: cryptoSession.hashToken,
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

// In-memory OTP storage for 5-digit email verification codes (5-min expiration)
const otpStore = new Map();

/**
 * POST /api/auth/send-otp
 * Generates and sends a 5-digit verification code to the target email
 */
router.post('/auth/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required for verification.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if email already exists in customers or employees table
    let checkCust = { rows: [] };
    let checkEmp = { rows: [] };
    try {
      checkCust = await query('SELECT id, supabase_user_id FROM customers WHERE LOWER(email) = $1', [cleanEmail]);
      checkEmp = await query(
        'SELECT id, supabase_user_id, activation_status FROM employees WHERE LOWER(email) = $1',
        [cleanEmail]
      );
    } catch (dbErr) {
      console.warn('[AUTH OTP] DB query check notice:', dbErr.message);
    }

    if (checkCust.rows.length > 0 || checkEmp.rows.length > 0) {
      if (checkEmp.rows.some((employee) => employee.activation_status === 'pending')) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email address already exists.',
        });
      }

      // Check if user still exists in Supabase Auth
      let existsInSupabase = false;
      try {
        const { data: usersData } = await supabase.auth.admin.listUsers();
        existsInSupabase = !!usersData?.users?.some(u => u.email?.toLowerCase() === cleanEmail);
      } catch (sErr) {
        console.warn('Supabase Auth sync check note:', sErr.message);
        existsInSupabase = false; // Fallback to database check only if Supabase admin list is unavailable
      }

      if (!existsInSupabase) {
        // User was deleted from Supabase Auth Dashboard! Auto-clean PostgreSQL orphaned records
        console.log(`[AUTH SYNC] User ${cleanEmail} was deleted from Supabase Auth. Auto-purging DB records...`);
        await query('DELETE FROM customers WHERE LOWER(email) = $1', [cleanEmail]);
        await query(
          `DELETE FROM employees
           WHERE LOWER(email) = $1 AND activation_status <> 'pending'`,
          [cleanEmail]
        );
      } else {
        return res.status(400).json({
          success: false,
          message: 'An account with this email address already exists.',
        });
      }
    }

    // Generate random 6-digit numerical code (100000 - 999999)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    otpStore.set(cleanEmail, { otp, expiresAt });

    // Dispatch real email via Resend API if API Key is configured
    if (process.env.RESEND_API_KEY) {
      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY.trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || 'Seafudz ng Bayan <noreply@seafudzngbayan.app>',
            to: [cleanEmail],
            subject: `${otp} is your Seafudz email verification code`,
            html: `
              <div style="font-family: Arial, sans-serif; padding: 24px; color: #2d3748; max-width: 480px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                <h2 style="color: #e74c3c; text-align: center; margin-top: 0; font-size: 24px; font-weight: bold;">Seafudz ng Bayan</h2>
                <p style="font-size: 15px; color: #4a5568;">Hello,</p>
                <p style="font-size: 15px; color: #4a5568; line-height: 1.5;">Your 6-digit email verification code is:</p>
                <div style="text-align: center; margin: 28px 0;">
                  <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #d35400; background: #fff5f0; padding: 14px 28px; border-radius: 12px; border: 1px solid #ffd8c7; display: inline-block;">${otp}</span>
                </div>
                <p style="font-size: 13px; color: #718096; text-align: center;">This code will expire in 5 minutes.</p>
              </div>
            `,
          }),
        });
        const resendData = await resendRes.json();
        console.log(`[AUTH OTP RESEND] Email dispatch output for ${cleanEmail}:`, resendData);
      } catch (rErr) {
        console.warn('[AUTH OTP RESEND] Failed to send email via Resend:', rErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Verification code sent to ${cleanEmail}.`,
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send verification code. Please try again.',
      details: error.message,
    });
  }
});

/**
 * POST /api/auth/verify-otp
 * Validates 6-digit OTP code against target email
 */
router.post('/auth/verify-otp', (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and 6-digit verification code are required.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const record = otpStore.get(cleanEmail);

    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'No verification code requested for this email or it has expired.',
      });
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(cleanEmail);
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please click Resend Code.',
      });
    }

    if (record.otp !== otp.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid 6-digit verification code. Please check and try again.',
      });
    }

    // Verified successfully - remove from temporary store
    otpStore.delete(cleanEmail);

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully.',
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return res.status(500).json({
      success: false,
      message: 'Verification failed. Please try again.',
    });
  }
});

// In-memory token store for password reset links (15-min expiration)
const resetTokenStore = new Map();

/**
 * POST /api/auth/forgot-password
 * Sends a password reset email link to registered user
 */
router.post('/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Verify user exists in database or Supabase Auth
    const checkCust = await query('SELECT id FROM customers WHERE LOWER(email) = $1', [cleanEmail]);
    const checkEmp = await query(
      'SELECT id, activation_status FROM employees WHERE LOWER(email) = $1',
      [cleanEmail]
    );

    if (checkEmp.rows.some((employee) => employee.activation_status === 'pending')) {
      return res.status(400).json({
        success: false,
        message: 'Activate this staff account using the email invitation before requesting a password reset.',
      });
    }

    let existsInSupabase = false;
    try {
      const { data: usersData } = await supabase.auth.admin.listUsers();
      existsInSupabase = !!usersData?.users?.some(u => u.email?.toLowerCase() === cleanEmail);
    } catch { }

    if (checkCust.rows.length === 0 && checkEmp.rows.length === 0 && !existsInSupabase) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address.',
      });
    }

    // Generate random secure token (60-minute expiration)
    const token = crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 minutes

    // Ensure password_resets table exists before inserting
    await query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        email VARCHAR(255) PRIMARY KEY,
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Store in PostgreSQL password_resets table for full persistence across server reloads
    await query(
      `INSERT INTO password_resets (email, token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at, created_at = NOW()`,
      [cleanEmail, token, expiresAt]
    );

    const clientOrigin = (req.headers.origin && req.headers.origin.startsWith('https://')) ? req.headers.origin : (process.env.FRONTEND_BASE_URL?.trim() || 'https://seafudzngbayan.app');
    const resetLink = `${clientOrigin}/reset-password?token=${token}&email=${encodeURIComponent(cleanEmail)}`;

    // Dispatch email via Resend API
    if (process.env.RESEND_API_KEY) {
      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY.trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || 'Seafudz ng Bayan <noreply@seafudzngbayan.app>',
            to: [cleanEmail],
            subject: 'Reset Your Password - Seafudz ng Bayan',
            html: `
              <div style="font-family: Arial, sans-serif; padding: 28px; color: #2d3748; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                <h2 style="color: #e74c3c; text-align: center; margin-top: 0; font-size: 24px; font-weight: bold;">Seafudz ng Bayan</h2>
                <h3 style="color: #2d3748; text-align: center; font-size: 18px; margin-bottom: 20px;">Password Reset Request</h3>
                <p style="font-size: 14px; color: #4a5568; line-height: 1.6;">We received a request to reset your password. Click the button below to set a new password for your account:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${resetLink}" style="background-color: #e74c3c; color: #ffffff; text-decoration: none; padding: 14px 28px; font-size: 15px; font-weight: bold; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(231,76,60,0.25);">Reset Password</a>
                </div>
                <p style="font-size: 12px; color: #a0aec0; text-align: center; line-height: 1.5;">If the button above does not work, copy and paste this link into your browser:<br/><a href="${resetLink}" style="color: #e74c3c;">${resetLink}</a></p>
                <hr style="border: none; border-top: 1px solid #edf2f7; margin: 24px 0;" />
                <p style="font-size: 12px; color: #a0aec0; text-align: center;">This reset link is valid for 60 minutes. If you did not request this, please ignore this email.</p>
              </div>
            `,
          }),
        });
        const resendData = await resendRes.json();
        console.log(`[AUTH RESET RESEND] Email dispatch output for ${cleanEmail}:`, resendData);
      } catch (rErr) {
        console.warn('[AUTH RESET RESEND] Failed to send email via Resend:', rErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Password reset link sent to ${cleanEmail}. Please check your inbox.`,
    });
  } catch (error) {
    console.error('Error sending reset link:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send password reset link. Please try again.',
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Resets user password using valid token from PostgreSQL database
 */
router.post('/auth/reset-password', async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, token, and new password are required.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Query password_resets table from PostgreSQL
    const tokenRes = await query(
      'SELECT token, expires_at FROM password_resets WHERE LOWER(email) = $1',
      [cleanEmail]
    );

    if (tokenRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active password reset request found for this email. Please request a new link from the login page.',
      });
    }

    const record = tokenRes.rows[0];

    if (record.token !== token.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid password reset link. Please check the link or request a new one.',
      });
    }

    if (new Date() > new Date(record.expires_at)) {
      await query('DELETE FROM password_resets WHERE LOWER(email) = $1', [cleanEmail]);
      return res.status(400).json({
        success: false,
        message: 'Password reset link has expired. Please request a new link from the login page.',
      });
    }

    const pendingStaff = await query(
      `SELECT 1 FROM employees
       WHERE LOWER(email) = $1 AND activation_status = 'pending'
       LIMIT 1`,
      [cleanEmail]
    );
    if (pendingStaff.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Activate this staff account using the email invitation before resetting its password.',
      });
    }

    const hashed = await hashPassword(newPassword);

    // 1. Ensure password_hash columns exist on PostgreSQL tables
    try {
      await query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS password_hash TEXT;');
      await query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash TEXT;');
    } catch { }

    // 2. Always update password_hash in PostgreSQL database tables first
    await query('UPDATE employees SET password_hash = $1, updated_at = NOW() WHERE LOWER(email) = $2', [hashed, cleanEmail]);
    await query('UPDATE customers SET password_hash = $1, updated_at = NOW() WHERE LOWER(email) = $2', [hashed, cleanEmail]);

    // 3. Best-effort sync to Supabase Auth
    try {
      const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const authUser = usersData?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);

      if (authUser?.id) {
        await supabase.auth.admin.updateUserById(authUser.id, { password: newPassword });
      } else {
        const { data: createData } = await supabase.auth.admin.createUser({
          email: cleanEmail,
          password: newPassword,
          email_confirm: true,
        });
        if (createData?.user?.id) {
          await query('UPDATE employees SET supabase_user_id = $1 WHERE LOWER(email) = $2', [createData.user.id, cleanEmail]);
          await query('UPDATE customers SET supabase_user_id = $1 WHERE LOWER(email) = $2', [createData.user.id, cleanEmail]);
        }
      }
    } catch (sErr) {
      console.warn('[AUTH RESET] Supabase sync note:', sErr.message);
    }

    // 4. Clear reset token record on success
    await query('DELETE FROM password_resets WHERE LOWER(email) = $1', [cleanEmail]);

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.',
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password. Please try again.',
    });
  }
});

/**
 * POST /api/auth/change-password
 * Authenticated / Direct Password Change for Profile/Account Settings
 */
router.post('/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current and new passwords are required.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const isEmployee = req.user?.type === 'employee';
    if (isEmployee && (req.user.is_active === false || req.user.activation_status === 'pending')) {
      return res.status(403).json({ success: false, message: 'This staff account is inactive.' });
    }
    const table = isEmployee ? 'employees' : 'customers';
    const accountRes = await query(
      `SELECT id, email, supabase_user_id, password_hash
       FROM ${table}
       WHERE id::text = $1 OR supabase_user_id::text = $1
       LIMIT 1`,
      [String(req.user?.id || req.user?.supabase_user_id || '')]
    );
    const account = accountRes.rows[0];
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    let currentPasswordValid = account.password_hash
      ? await verifyPassword(currentPassword, account.password_hash)
      : false;
    if (!currentPasswordValid && account.supabase_user_id) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: account.email,
          password: currentPassword,
        });
        currentPasswordValid = !error && data?.user?.id === account.supabase_user_id;
      } catch { }
    }
    if (!currentPasswordValid) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    const hashed = await hashPassword(newPassword);
    await query(`UPDATE ${table} SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [hashed, account.id]);
    if (account.supabase_user_id) {
      try {
        await supabase.auth.admin.updateUserById(account.supabase_user_id, { password: newPassword });
      } catch (error) {
        console.warn('Supabase password sync note:', error.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully.',
    });
  } catch (error) {
    console.error('Error changing password:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update password. Please try again.',
    });
  }
});

/**
 * POST /api/auth/register
 * Provision user/employee profile in PostgreSQL database linked to Supabase Auth UID
 */
router.post('/auth/register', async (req, res) => {
  try {
    const { fullname, username, email, role, phone, address } = req.body;

    if (!fullname || !email) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields (fullname, email)',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanFullname = fullname.trim();
    const selectedRole = (role || 'customer').toLowerCase();

    if (selectedRole !== 'customer') {
      return res.status(403).json({
        success: false,
        message: 'Staff accounts must be created by an administrator.',
      });
    }

    const cleanUsername = (username || cleanEmail.split('@')[0]).trim();
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
    });
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
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  const token = bearerToken || req.query.session_token || req.query.token;
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
 * GET /api/auth/me-profile
 * Fetches user profile record from PostgreSQL customers or employees table
 */
router.get('/auth/me-profile', async (req, res) => {
  try {
    const { email, id } = req.query;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanId = (id || '').trim();

    if (!cleanEmail && !cleanId) {
      return res.status(400).json({ success: false, message: 'Email or ID parameter required' });
    }

    // Check customers first
    const custRes = await query(
      `SELECT id, supabase_user_id, fullname, username, email, phone, delivery_address AS address, created_at
       FROM customers
       WHERE (id::text = $1 OR supabase_user_id::text = $1) OR ($2 <> '' AND (LOWER(email) = $2 OR LOWER(username) = $2))
       LIMIT 1`,
      [cleanId || '00000000-0000-0000-0000-000000000000', cleanEmail]
    );

    if (custRes.rows.length > 0) {
      return res.status(200).json({
        success: true,
        data: { ...custRes.rows[0], role: 'customer' },
      });
    }

    // Check employees second
    const empRes = await query(
      `SELECT id, supabase_user_id, fullname, username, email, phone, role, created_at
       FROM employees
       WHERE (id::text = $1 OR supabase_user_id::text = $1) OR ($2 <> '' AND LOWER(email) = $2)
       LIMIT 1`,
      [cleanId || '00000000-0000-0000-0000-000000000000', cleanEmail]
    );

    if (empRes.rows.length > 0) {
      return res.status(200).json({
        success: true,
        data: empRes.rows[0],
      });
    }

    return res.status(404).json({ success: false, message: 'Profile record not found' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/auth/profile
 * Updates or provisions user profile details (fullname, phone, address, email) in PostgreSQL database
 */
router.put('/auth/profile', requireAuth, async (req, res) => {
  try {
    const { originalEmail, email, fullname, phone, address, username } = req.body;
    const cleanEmail = (email || originalEmail || '').trim().toLowerCase();
    const cleanFullname = (fullname || '').trim();
    const cleanPhone = (phone || '').trim();
    const cleanAddress = (address || '').trim();
    const cleanId = String(req.user?.id || '');
    const isEmployee = req.user?.type === 'employee';

    if (!cleanId) {
      return res.status(401).json({ success: false, message: 'Authenticated profile is required.' });
    }
    if (req.user?.is_active === false) {
      return res.status(403).json({ success: false, message: 'Inactive accounts cannot edit their profile.' });
    }

    if (!cleanEmail && !cleanId && !cleanFullname) {
      return res.status(400).json({
        success: false,
        message: 'Email, ID, or Full Name is required to update profile',
      });
    }

    let updatedRecord = null;

    // 1. Employee Profile Update
    if (isEmployee) {
      if (username && !isValidStaffUsername(username.trim())) {
        return res.status(400).json({ success: false, message: 'Username must be 3–32 valid characters.' });
      }
      const employeeTarget = await query(
        'SELECT id, activation_status FROM employees WHERE id::text = $1 LIMIT 1',
        [cleanId]
      );
      if (!employeeTarget.rows[0]) {
        return res.status(404).json({ success: false, message: 'Staff profile not found.' });
      }
      if (employeeTarget.rows[0]?.activation_status === 'pending') {
        return res.status(403).json({
          success: false,
          message: 'Pending staff details can only be managed from the admin user list.',
        });
      }
      if (username && employeeTarget.rows[0]) {
        const usernameConflict = await query(
          'SELECT 1 FROM employees WHERE LOWER(username) = LOWER($1) AND id <> $2 LIMIT 1',
          [username.trim(), employeeTarget.rows[0].id]
        );
        if (usernameConflict.rows.length > 0) {
          return res.status(409).json({ success: false, message: 'That username is already taken.' });
        }
      }

      const empRes = await query(
        `UPDATE employees
         SET fullname = COALESCE(NULLIF($1, ''), fullname),
             email = COALESCE(NULLIF($2, ''), email),
             username = COALESCE(NULLIF($3, ''), username),
             phone = COALESCE(NULLIF($4, ''), phone),
             updated_at = NOW()
         WHERE id::text = $5
         RETURNING id, supabase_user_id, fullname, username, email, phone, role, created_at, updated_at`,
        [
          cleanFullname,
          cleanEmail,
          (username || '').trim(),
          cleanPhone,
          cleanId,
        ]
      );

      if (empRes.rows.length > 0) {
        updatedRecord = empRes.rows[0];
      } else {
        return res.status(404).json({ success: false, message: 'Staff profile not found.' });
      }
    }

    // 2. Customer Profile Update or Upsert
    if (!updatedRecord) {
      try {
        // Try direct UPDATE first
        const custRes = await query(
          `UPDATE customers
           SET fullname = COALESCE(NULLIF($1, ''), fullname),
               username = COALESCE(NULLIF($2, ''), username),
               email = COALESCE(NULLIF($3, ''), email),
               phone = COALESCE(NULLIF($4, ''), phone),
               delivery_address = COALESCE(NULLIF($5, ''), delivery_address),
               updated_at = NOW()
           WHERE id::text = $6
           RETURNING id, supabase_user_id, fullname, username, email, phone, delivery_address AS address, created_at, updated_at`,
          [
            cleanFullname,
            (username || '').trim(),
            cleanEmail,
            cleanPhone,
            cleanAddress,
            cleanId,
          ]
        );

        if (custRes.rows.length > 0) {
          updatedRecord = { ...custRes.rows[0], role: 'customer' };
        }
      } catch (custErr) {
        console.warn('Customer profile update/upsert notice:', custErr.message);
      }
    }

    if (!updatedRecord) {
      return res.status(404).json({ success: false, message: 'Profile record not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile details saved to database successfully',
      data: updatedRecord,
    });
  } catch (error) {
    console.error('Error updating profile in DB:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile in database',
      error: error.message,
    });
  }
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
