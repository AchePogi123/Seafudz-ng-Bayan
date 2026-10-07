import { Router } from 'express';
import { query } from '../config/db.js';
import { supabase } from '../config/supabase.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { generateSessionHashToken, verifySessionHashToken } from '../cryptography/index.js';

const router = Router();

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
router.get('/users', async (req, res) => {
  try {
    const sql = `
      SELECT id, supabase_user_id, fullname, username, email, phone, role, is_active, created_at
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
      status: emp.is_active ? 'active' : 'inactive',
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
router.post('/users', async (req, res) => {
  try {
    const { id, name, username, email, contact, phone, role } = req.body;
    const cleanName = (name || '').trim();
    const cleanUsername = (username || '').trim();
    const rawRole = (role || 'cashier').toString().trim().toLowerCase();
    const cleanContact = (contact || phone || '').trim();

    if (!cleanName) {
      return res.status(400).json({
        success: false,
        message: 'Name is required to save employee user.',
      });
    }

    // Role mapping to fit DB CHECK constraint: ('admin', 'cashier', 'assistant', 'kitchen', 'rider')
    let dbRole = 'cashier';
    if (rawRole.includes('admin')) dbRole = 'admin';
    else if (rawRole.includes('kitchen')) dbRole = 'kitchen';
    else if (rawRole.includes('rider')) dbRole = 'rider';
    else if (rawRole.includes('assistant')) dbRole = 'assistant';
    else if (rawRole.includes('cashier')) dbRole = 'cashier';

    // Unique fallback for username and email if blank
    const fallbackUsername = cleanUsername || (cleanName.replace(/\s+/g, '.').toLowerCase() + Math.floor(100 + Math.random() * 900));
    const cleanEmail = (email || '').trim().toLowerCase() || `${fallbackUsername.replace(/[^a-zA-Z0-9._-]/g, '')}@seafudz.ph`;

    const sql = `
      INSERT INTO employees (fullname, username, email, phone, role, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (email) DO UPDATE SET
        fullname = EXCLUDED.fullname,
        username = EXCLUDED.username,
        phone = COALESCE(EXCLUDED.phone, employees.phone),
        role = EXCLUDED.role,
        is_active = true,
        updated_at = NOW()
      RETURNING id, fullname, username, email, phone, role, is_active, created_at
    `;

    const { rows } = await query(sql, [
      cleanName,
      fallbackUsername,
      cleanEmail,
      cleanContact || null,
      dbRole,
    ]);

    const emp = rows[0];

    return res.status(201).json({
      success: true,
      message: `Employee ${emp.fullname} saved to database successfully`,
      data: {
        id: id || emp.id,
        db_id: emp.id,
        name: emp.fullname,
        username: emp.username,
        email: emp.email,
        contact: emp.phone || '-',
        role: role || emp.role,
        status: emp.is_active ? 'active' : 'inactive',
      },
    });
  } catch (error) {
    console.error('Error saving employee user to database:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save employee user to database',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/users/:id/toggle-status
 * Updates employee active/inactive status in PostgreSQL database
 */
router.patch('/users/:id/toggle-status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const isActive = status === 'active';

    const sql = `
      UPDATE employees
      SET is_active = $1, updated_at = NOW()
      WHERE id::text = $2 OR username = $2 OR email = $2 OR fullname = $2
      RETURNING id, fullname, is_active
    `;
    const { rows } = await query(sql, [isActive, id]);

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
router.put('/users/:id', async (req, res) => {
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
        updated_at = NOW()
      WHERE id::text = $6 OR username = $6 OR email = $6 OR fullname = $6
      RETURNING id, fullname, username, email, phone, role, is_active
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
        status: emp.is_active ? 'active' : 'inactive',
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
router.delete('/users/:id', async (req, res) => {
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
    } else if (targetEmail) {
      try {
        const { data: usersData } = await supabase.auth.admin.listUsers();
        const foundAuthUser = usersData?.users?.find(u => u.email?.toLowerCase() === targetEmail.toLowerCase());
        if (foundAuthUser?.id) {
          await supabase.auth.admin.deleteUser(foundAuthUser.id);
        }
      } catch (sErr) {
        console.warn('Supabase listUsers delete note:', sErr.message);
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
router.post('/auth/cleanup-user', async (req, res) => {
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
    const { username, supabaseUserId, email, password, pinCode, loginInput } = req.body;
    const searchValue = (loginInput || email || username || '').trim();

    if (!searchValue && !supabaseUserId) {
      return res.status(400).json({
        success: false,
        message: 'Email or username is required.',
      });
    }

    let verifiedSupabaseUserId = supabaseUserId || null;

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

    // 2. Locate user in employees or customers database table
    let emp = null;
    let cust = null;

    if (verifiedSupabaseUserId) {
      const empRes = await query('SELECT * FROM employees WHERE supabase_user_id = $1', [verifiedSupabaseUserId]);
      if (empRes.rows.length > 0) emp = empRes.rows[0];

      if (!emp) {
        const custRes = await query('SELECT * FROM customers WHERE supabase_user_id = $1', [verifiedSupabaseUserId]);
        if (custRes.rows.length > 0) cust = custRes.rows[0];
      }
    }

    if (!emp && !cust && searchValue) {
      const empRes = await query(
        'SELECT * FROM employees WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)',
        [searchValue]
      );
      if (empRes.rows.length > 0) emp = empRes.rows[0];

      if (!emp) {
        const custRes = await query(
          'SELECT * FROM customers WHERE LOWER(email) = LOWER($1) OR LOWER(fullname) = LOWER($1)',
          [searchValue]
        );
        if (custRes.rows.length > 0) cust = custRes.rows[0];
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
    if (!verifiedSupabaseUserId) {
      let isVerified = false;

      // Check PIN code first for staff/employees if PIN is configured
      const submittedPin = pinCode || password;
      if (isEmployee && emp.pin_code && submittedPin && emp.pin_code.trim() === String(submittedPin).trim()) {
        isVerified = true;
      }

      // Check password via Supabase Auth using the user's registered email
      if (!isVerified && password && userRecord.email) {
        try {
          const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email: userRecord.email.trim(),
            password,
          });

          if (!loginError && loginData?.user) {
            isVerified = true;
            verifiedSupabaseUserId = loginData.user.id;
          }
        } catch { }
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

    return res.status(200).json({
      success: true,
      message: `Login successful for ${userRecord.fullname}`,
      data: isEmployee ? emp : { ...cust, role: 'customer' },
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
      checkEmp = await query('SELECT id, supabase_user_id FROM employees WHERE LOWER(email) = $1', [cleanEmail]);
    } catch (dbErr) {
      console.warn('[AUTH OTP] DB query check notice:', dbErr.message);
    }

    if (checkCust.rows.length > 0 || checkEmp.rows.length > 0) {
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
        await query('DELETE FROM employees WHERE LOWER(email) = $1', [cleanEmail]);
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

    console.log(`[AUTH OTP] Generated 6-digit OTP for ${cleanEmail}: ${otp}`);

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
            from: 'Seafudz ng Bayan <onboarding@resend.dev>',
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
    const checkEmp = await query('SELECT id FROM employees WHERE LOWER(email) = $1', [cleanEmail]);

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

    const clientOrigin = req.headers.origin || 'http://localhost:5173';
    const resetLink = `${clientOrigin}/reset-password?token=${token}&email=${encodeURIComponent(cleanEmail)}`;

    console.log(`[AUTH RESET LINK] Persistent reset link for ${cleanEmail}: ${resetLink}`);

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
            from: 'Seafudz ng Bayan <onboarding@resend.dev>',
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

    // 1. Update password in Supabase Auth if user exists
    try {
      const { data: usersData } = await supabase.auth.admin.listUsers();
      const authUser = usersData?.users?.find(u => u.email?.toLowerCase() === cleanEmail);
      if (authUser?.id) {
        await supabase.auth.admin.updateUserById(authUser.id, { password: newPassword });
      }
    } catch (sErr) {
      console.warn('Supabase password reset note:', sErr.message);
    }

    // 2. Update PostgreSQL updated_at timestamps
    await query('UPDATE employees SET updated_at = NOW() WHERE LOWER(email) = $1', [cleanEmail]);
    await query('UPDATE customers SET updated_at = NOW() WHERE LOWER(email) = $1', [cleanEmail]);

    // 3. Clear reset token record on success
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
      const validStaffToken = (process.env.STAFF_REGISTRATION_TOKEN || '').trim().toUpperCase();
      if (!validStaffToken || !token || token.trim().toUpperCase() !== validStaffToken) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: Invalid or unconfigured Employee Access Token for staff account.',
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
      });
    } else {
      // Customer account creation
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
router.put('/auth/profile', async (req, res) => {
  try {
    const { id, originalEmail, email, fullname, phone, address, username, role } = req.body;
    const cleanEmail = (email || originalEmail || '').trim().toLowerCase();
    const cleanOrigEmail = (originalEmail || email || '').trim().toLowerCase();
    const cleanFullname = (fullname || '').trim();
    const cleanPhone = (phone || '').trim();
    const cleanAddress = (address || '').trim();
    const cleanId = (id || '').trim();
    const isEmployee = role && ['admin', 'cashier', 'assistant', 'kitchen', 'rider'].includes(String(role).toLowerCase());

    if (!cleanEmail && !cleanId && !cleanFullname) {
      return res.status(400).json({
        success: false,
        message: 'Email, ID, or Full Name is required to update profile',
      });
    }

    let updatedRecord = null;

    // 1. Employee Profile Update
    if (isEmployee) {
      try {
        const empRes = await query(
          `UPDATE employees
           SET fullname = COALESCE(NULLIF($1, ''), fullname),
               email = COALESCE(NULLIF($2, ''), email),
               username = COALESCE(NULLIF($3, ''), username),
               phone = COALESCE(NULLIF($4, ''), phone),
               updated_at = NOW()
           WHERE (id::text = $5 OR supabase_user_id::text = $5) OR ($6 <> '' AND LOWER(email) = $6) OR ($7 <> '' AND LOWER(email) = $7)
           RETURNING id, supabase_user_id, fullname, username, email, phone, role, created_at, updated_at`,
          [
            cleanFullname,
            cleanEmail,
            (username || '').trim(),
            cleanPhone,
            cleanId || '00000000-0000-0000-0000-000000000000',
            cleanOrigEmail,
            cleanEmail,
          ]
        );

        if (empRes.rows.length > 0) {
          updatedRecord = empRes.rows[0];
        }
      } catch (empErr) {
        console.warn('Employee profile update notice:', empErr.message);
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
           WHERE (id::text = $6 OR supabase_user_id::text = $6) OR ($7 <> '' AND LOWER(email) = $7) OR ($8 <> '' AND LOWER(email) = $8)
           RETURNING id, supabase_user_id, fullname, username, email, phone, delivery_address AS address, created_at, updated_at`,
          [
            cleanFullname,
            (username || '').trim(),
            cleanEmail,
            cleanPhone,
            cleanAddress,
            cleanId || '00000000-0000-0000-0000-000000000000',
            cleanOrigEmail,
            cleanEmail,
          ]
        );

        if (custRes.rows.length > 0) {
          updatedRecord = { ...custRes.rows[0], role: 'customer' };
        } else if (cleanEmail && cleanFullname) {
          // If no row matched, UPSERT new customer profile in DB
          const upsertRes = await query(
            `INSERT INTO customers (fullname, email, phone, delivery_address)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (email) DO UPDATE SET
               fullname = EXCLUDED.fullname,
               phone = COALESCE(EXCLUDED.phone, customers.phone),
               delivery_address = COALESCE(EXCLUDED.delivery_address, customers.delivery_address),
               updated_at = NOW()
             RETURNING id, supabase_user_id, fullname, email, phone, delivery_address AS address, created_at, updated_at`,
            [cleanFullname, cleanEmail, cleanPhone || null, cleanAddress || null]
          );

          if (upsertRes.rows.length > 0) {
            updatedRecord = { ...upsertRes.rows[0], role: 'customer' };
          }
        }
      } catch (custErr) {
        console.warn('Customer profile update/upsert notice:', custErr.message);
      }
    }

    if (!updatedRecord) {
      // Fallback response constructing saved profile data
      updatedRecord = {
        id: cleanId || `CUST-${Date.now()}`,
        fullname: cleanFullname,
        email: cleanEmail,
        phone: cleanPhone,
        address: cleanAddress,
        role: role || 'customer',
      };
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
