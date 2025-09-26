const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db', 'agriholann.db');
const ATTACHMENTS_DIR = path.join(__dirname, 'storage', 'attachments');
const FALLBACK_ADMIN_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'admin';
const SUPER_ADMIN_DEFAULT_PASSWORD = process.env.SUPER_ADMIN_DEFAULT_PASSWORD || 'lannion';
const SUPER_ADMIN_IDENTIFIER = 'lsaquet';
const SUPER_ADMIN_FIRST_NAME = 'Laurent';
const SUPER_ADMIN_LAST_NAME = 'Saquet';
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const ADMIN_CREATABLE_ROLES = ['manager', 'standard'];
const ADMIN_ROLES = new Set(['superadmin', ...ADMIN_CREATABLE_ROLES]);
const DEFAULT_COMPLETION_EMAIL = process.env.DEFAULT_COMPLETION_EMAIL || 'laurent.saquet@agriholann.com';
const DEFAULT_GMAIL_REDIRECT_URI = 'http://localhost';
const GMAIL_SENDER = process.env.GMAIL_SENDER || 'chauffeur.agriholann@gmail.com';
const GMAIL_CONFIG_SOURCES = {
  credentialsPath: process.env.GMAIL_CREDENTIALS_PATH || path.join(__dirname, 'credentials.json'),
  tokenPath: process.env.GMAIL_TOKEN_PATH || path.join(__dirname, 'token.json'),
};
const GMAIL_CLIENT_ID_SETTING_KEY = 'gmail_client_id';
const GMAIL_CLIENT_SECRET_SETTING_KEY = 'gmail_client_secret';
const GMAIL_REFRESH_TOKEN_SETTING_KEY = 'gmail_refresh_token';
const GMAIL_REDIRECT_URI_SETTING_KEY = 'gmail_redirect_uri';

function applyFallback(config, key, value) {
  if (!config[key] && typeof value === 'string' && value.trim()) {
    config[key] = value.trim();
  }
}

function loadGmailConfig() {
  const config = {
    clientId: (process.env.GMAIL_CLIENT_ID || '').trim(),
    clientSecret: (process.env.GMAIL_CLIENT_SECRET || '').trim(),
    redirectUri: (process.env.GMAIL_REDIRECT_URI || '').trim(),
    refreshToken: (process.env.GMAIL_REFRESH_TOKEN || '').trim(),
  };

  if (!config.clientId && gmailDbConfig.clientId) {
    config.clientId = gmailDbConfig.clientId;
  }
  if (!config.clientSecret && gmailDbConfig.clientSecret) {
    config.clientSecret = gmailDbConfig.clientSecret;
  }
  if (!config.redirectUri && gmailDbConfig.redirectUri) {
    config.redirectUri = gmailDbConfig.redirectUri;
  }
  if (!config.refreshToken && gmailDbConfig.refreshToken) {
    config.refreshToken = gmailDbConfig.refreshToken;
  }

  if (fs.existsSync(GMAIL_CONFIG_SOURCES.credentialsPath)) {
    try {
      const rawCredentials = JSON.parse(fs.readFileSync(GMAIL_CONFIG_SOURCES.credentialsPath, 'utf8'));
      const oauthConfig = rawCredentials.web || rawCredentials.installed || {};
      applyFallback(config, 'clientId', oauthConfig.client_id);
      applyFallback(config, 'clientSecret', oauthConfig.client_secret);
      if (Array.isArray(oauthConfig.redirect_uris) && oauthConfig.redirect_uris.length > 0) {
        applyFallback(config, 'redirectUri', oauthConfig.redirect_uris[0]);
      } else if (typeof oauthConfig.redirect_uri === 'string') {
        applyFallback(config, 'redirectUri', oauthConfig.redirect_uri);
      }
    } catch (error) {
      console.error('Impossible de lire credentials.json :', error.message);
    }
  }

  if (fs.existsSync(GMAIL_CONFIG_SOURCES.tokenPath)) {
    try {
      const token = JSON.parse(fs.readFileSync(GMAIL_CONFIG_SOURCES.tokenPath, 'utf8'));
      applyFallback(config, 'refreshToken', token.refresh_token || token.refreshToken);
    } catch (error) {
      console.error('Impossible de lire token.json :', error.message);
    }
  }

  if (!config.redirectUri) {
    config.redirectUri = DEFAULT_GMAIL_REDIRECT_URI;
  }

  return config;
}
const EMAIL_RECIPIENT_SETTING_KEY = 'completion_email_recipient';
const EMAIL_ATTACHMENT_NAME = 'bon-transport.jpg';

const activeAdminSessions = new Map();
const sseClients = new Set();

function generateAdminSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createAdminSession(admin) {
  const token = generateAdminSessionToken();
  activeAdminSessions.set(token, {
    adminId: admin.id,
    expiresAt: Date.now() + ADMIN_SESSION_TTL_MS,
  });
  return token;
}

function sendSseEvent(client, payload) {
  try {
    client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch (error) {
    console.warn('Unable to deliver SSE payload, removing client.', error.message);
    if (client.heartbeat) {
      clearInterval(client.heartbeat);
    }
    sseClients.delete(client);
  }
}

function broadcastEvent(type, payload = {}) {
  if (!sseClients.size) {
    return;
  }

  const message = {
    type,
    payload,
    timestamp: Date.now(),
  };

  for (const client of Array.from(sseClients)) {
    sendSseEvent(client, message);
  }
}

async function enforceAdminSession(req, res, options = {}) {
  const token = req.headers['x-admin-token'];
  if (!token) {
    res.status(401).json({ message: 'Authentification administrateur requise.' });
    return null;
  }

  const session = activeAdminSessions.get(token);
  if (!session) {
    res.status(401).json({ message: 'Session administrateur invalide.' });
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    activeAdminSessions.delete(token);
    res.status(401).json({ message: 'Session administrateur expirée.' });
    return null;
  }

  const admin = await db.get(
    'SELECT id, first_name, last_name, identifier, initials, role FROM admins WHERE id = ?',
    [session.adminId]
  );

  if (!admin) {
    activeAdminSessions.delete(token);
    res.status(401).json({ message: 'Compte administrateur introuvable.' });
    return null;
  }

  if (options.requireSuperAdmin && admin.identifier.toLowerCase() !== SUPER_ADMIN_IDENTIFIER) {
    res.status(403).json({ message: 'Seul Laurent Saquet peut effectuer cette action.' });
    return null;
  }

  if (options.allowSelfOnly && admin.id !== options.allowSelfOnly) {
    res.status(403).json({ message: 'Action non autorisée pour ce compte administrateur.' });
    return null;
  }

  if (options.allowRoles && !options.allowRoles.includes(admin.role)) {
    res.status(403).json({ message: 'Droits administrateur insuffisants pour cette action.' });
    return null;
  }

  session.expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  activeAdminSessions.set(token, session);

  return { admin, token };
}

async function hashPassword(password) {
  const value = password || '';
  return bcrypt.hash(value, 10);
}

async function comparePassword(password, hash) {
  if (!hash) {
    return false;
  }
  return bcrypt.compare(password || '', hash);
}

async function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

let db;

let gmailService = null;
let gmailConfigSignature = null;
let gmailDbConfig = {
  clientId: '',
  clientSecret: '',
  refreshToken: '',
  redirectUri: '',
};

async function columnExists(table, column) {
  const pragma = await db.all(`PRAGMA table_info(${table})`);
  return pragma.some((entry) => entry.name === column);
}

async function getSetting(key) {
  const row = await db.get('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : null;
}

async function setSettingValue(key, value) {
  await db.run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

async function ensureSetting(key, defaultValue) {
  const existing = await getSetting(key);
  if (existing === null || existing === undefined) {
    await setSettingValue(key, defaultValue);
  }
}

async function refreshGmailSettingsCache() {
  const [clientId, clientSecret, refreshToken, redirectUri] = await Promise.all([
    getSetting(GMAIL_CLIENT_ID_SETTING_KEY),
    getSetting(GMAIL_CLIENT_SECRET_SETTING_KEY),
    getSetting(GMAIL_REFRESH_TOKEN_SETTING_KEY),
    getSetting(GMAIL_REDIRECT_URI_SETTING_KEY),
  ]);

  gmailDbConfig = {
    clientId: (clientId || '').trim(),
    clientSecret: (clientSecret || '').trim(),
    refreshToken: (refreshToken || '').trim(),
    redirectUri: (redirectUri || '').trim(),
  };

  return gmailDbConfig;
}

async function ensureDefaultGmailSettings() {
  await ensureSetting(GMAIL_CLIENT_ID_SETTING_KEY, (process.env.GMAIL_CLIENT_ID || '').trim());
  await ensureSetting(GMAIL_CLIENT_SECRET_SETTING_KEY, (process.env.GMAIL_CLIENT_SECRET || '').trim());
  await ensureSetting(GMAIL_REFRESH_TOKEN_SETTING_KEY, (process.env.GMAIL_REFRESH_TOKEN || '').trim());
  await ensureSetting(
    GMAIL_REDIRECT_URI_SETTING_KEY,
    (process.env.GMAIL_REDIRECT_URI || DEFAULT_GMAIL_REDIRECT_URI).trim()
  );

  await refreshGmailSettingsCache();
}

async function getEmailSettingsFromDatabase() {
  const [recipient, gmailSettings] = await Promise.all([
    getCompletionEmailRecipient(),
    refreshGmailSettingsCache(),
  ]);

  return {
    recipient,
    gmailClientId: gmailSettings.clientId,
    gmailClientSecret: gmailSettings.clientSecret,
    gmailRefreshToken: gmailSettings.refreshToken,
    gmailRedirectUri: gmailSettings.redirectUri || DEFAULT_GMAIL_REDIRECT_URI,
  };
}

async function persistEmailSettings({
  recipient,
  gmailClientId,
  gmailClientSecret,
  gmailRefreshToken,
  gmailRedirectUri,
}) {
  const updates = [];

  if (typeof recipient === 'string') {
    updates.push(setSettingValue(EMAIL_RECIPIENT_SETTING_KEY, recipient.trim()));
  }

  if (typeof gmailClientId === 'string') {
    updates.push(setSettingValue(GMAIL_CLIENT_ID_SETTING_KEY, gmailClientId.trim()));
  }

  if (typeof gmailClientSecret === 'string') {
    updates.push(setSettingValue(GMAIL_CLIENT_SECRET_SETTING_KEY, gmailClientSecret.trim()));
  }

  if (typeof gmailRefreshToken === 'string') {
    updates.push(setSettingValue(GMAIL_REFRESH_TOKEN_SETTING_KEY, gmailRefreshToken.trim()));
  }

  if (typeof gmailRedirectUri === 'string') {
    const value = gmailRedirectUri.trim() || DEFAULT_GMAIL_REDIRECT_URI;
    updates.push(setSettingValue(GMAIL_REDIRECT_URI_SETTING_KEY, value));
  }

  if (updates.length) {
    await Promise.all(updates);
    await refreshGmailSettingsCache();
    gmailService = null;
    gmailConfigSignature = null;
  }

  return getEmailSettingsFromDatabase();
}

async function getCompletionEmailRecipient() {
  const recipient = await getSetting(EMAIL_RECIPIENT_SETTING_KEY);
  return recipient || DEFAULT_COMPLETION_EMAIL;
}

function getGmailService() {
  const config = loadGmailConfig();
  const signature = JSON.stringify(config);

  if (!config.clientId || !config.clientSecret || !config.refreshToken) {
    gmailService = null;
    gmailConfigSignature = null;
    return { service: null, config };
  }

  if (!gmailService || gmailConfigSignature !== signature) {
    const oAuth2Client = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
    oAuth2Client.setCredentials({ refresh_token: config.refreshToken });
    gmailService = google.gmail({ version: 'v1', auth: oAuth2Client });
    gmailConfigSignature = signature;
  }

  return { service: gmailService, config };
}

function buildMimeMessage({ from, to, subject, text, attachmentBuffer, attachmentName, attachmentMimeType }) {
  if (attachmentBuffer) {
    const boundary = `===============${Date.now()}==`;
    const base64Attachment = attachmentBuffer
      .toString('base64')
      .replace(/(.{76})/g, '$1\n');

    return [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      text,
      '',
      `--${boundary}`,
      `Content-Type: ${attachmentMimeType || 'application/octet-stream'}; name="${attachmentName}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${attachmentName}"`,
      '',
      base64Attachment,
      '',
      `--${boundary}--`,
      '',
    ].join('\n');
  }

  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    text,
  ].join('\n');
}

async function sendGmailMessage({
  to,
  subject,
  text,
  attachmentBuffer = null,
  attachmentName = EMAIL_ATTACHMENT_NAME,
  attachmentMimeType = 'application/octet-stream',
}) {
  const { service, config } = getGmailService();

  if (!service) {
    const missing = [];
    if (!config.clientId) missing.push('client_id');
    if (!config.clientSecret) missing.push('client_secret');
    if (!config.refreshToken) missing.push('refresh_token');
    const missingDetails = missing.length ? ` (éléments manquants : ${missing.join(', ')})` : '';
    const locationHint = ` Fichiers recherchés : ${GMAIL_CONFIG_SOURCES.credentialsPath}, ${GMAIL_CONFIG_SOURCES.tokenPath}.`;
    throw new Error(
      `Configuration de la messagerie Gmail manquante. Définissez les variables GMAIL_* ou fournissez credentials.json et token.json${missingDetails}.${locationHint}`
    );
  }

  const rawMessage = buildMimeMessage({
    from: GMAIL_SENDER,
    to,
    subject,
    text,
    attachmentBuffer,
    attachmentName,
    attachmentMimeType,
  });

  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await service.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  });

  return response.data;
}

async function ensureColumn(table, column, definition) {
  if (!(await columnExists(table, column))) {
    await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function buildAdminIdentifier(firstName, lastName) {
  if (!firstName || !lastName) {
    return null;
  }
  const normalizedLastName = lastName.replace(/\s+/g, '').toLowerCase();
  const prefix = firstName.trim().charAt(0).toLowerCase();
  return `${prefix}${normalizedLastName}`;
}

function buildAdminInitials(firstName, lastName) {
  const firstInitial = firstName ? firstName.trim().charAt(0) : '';
  const lastInitial = lastName ? lastName.trim().charAt(0) : '';
  const initials = `${firstInitial}${lastInitial}`.toUpperCase();
  return initials || 'AA';
}

function isValidEmail(email) {
  if (!email) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function generateUniqueAdminIdentifier(firstName, lastName) {
  const base = buildAdminIdentifier(firstName, lastName);
  if (!base) {
    return null;
  }

  let identifier = base;
  let suffix = 1;

  while (true) {
    const existing = await db.get('SELECT id FROM admins WHERE identifier = ?', [identifier]);
    if (!existing) {
      return identifier;
    }
    suffix += 1;
    identifier = `${base}${suffix}`;
  }
}

async function ensureSuperAdmin() {
  let admin = await db.get('SELECT * FROM admins WHERE LOWER(identifier) = ?', [SUPER_ADMIN_IDENTIFIER]);

  const expectedInitials = buildAdminInitials(SUPER_ADMIN_FIRST_NAME, SUPER_ADMIN_LAST_NAME);

  if (!admin) {
    const identifier = SUPER_ADMIN_IDENTIFIER;
    const initials = expectedInitials;
    const createdAt = new Date().toISOString();
    const passwordHash = await hashPassword(SUPER_ADMIN_DEFAULT_PASSWORD);

    await db.run(
      `INSERT INTO admins (first_name, last_name, identifier, initials, created_at, password_hash, role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        SUPER_ADMIN_FIRST_NAME,
        SUPER_ADMIN_LAST_NAME,
        identifier,
        initials,
        createdAt,
        passwordHash,
        'superadmin',
      ]
    );
    return;
  }

  const updates = [];
  const params = [];

  if (admin.first_name !== SUPER_ADMIN_FIRST_NAME) {
    updates.push('first_name = ?');
    params.push(SUPER_ADMIN_FIRST_NAME);
  }

  if (admin.last_name !== SUPER_ADMIN_LAST_NAME) {
    updates.push('last_name = ?');
    params.push(SUPER_ADMIN_LAST_NAME);
  }

  if (admin.initials !== expectedInitials) {
    updates.push('initials = ?');
    params.push(expectedInitials);
  }

  if (admin.identifier.toLowerCase() !== SUPER_ADMIN_IDENTIFIER) {
    updates.push('identifier = ?');
    params.push(SUPER_ADMIN_IDENTIFIER);
  }

  if (!admin.password_hash || !admin.password_hash.trim()) {
    updates.push('password_hash = ?');
    params.push(await hashPassword(SUPER_ADMIN_DEFAULT_PASSWORD));
  }

  if (admin.role !== 'superadmin') {
    updates.push("role = 'superadmin'");
  }

  if (updates.length) {
    const setClause = updates.join(', ');
    params.push(admin.id);
    await db.run(`UPDATE admins SET ${setClause} WHERE id = ?`, params);
  }
}

async function ensureDefaultEmailRecipient() {
  await ensureSetting(EMAIL_RECIPIENT_SETTING_KEY, DEFAULT_COMPLETION_EMAIL);
}

async function initDatabase() {
  await ensureDirectoryExists(path.dirname(DB_PATH));
  await ensureDirectoryExists(ATTACHMENTS_DIR);

  db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });

  await db.exec('PRAGMA foreign_keys = ON');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      password_hash TEXT
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      driver_id INTEGER NOT NULL,
      date_time TEXT NOT NULL,
      departure TEXT NOT NULL,
      destination TEXT NOT NULL,
      merchandise TEXT,
      comments TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      photo_path TEXT,
      completion_comments TEXT,
      archived_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(driver_id) REFERENCES drivers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER,
      action TEXT NOT NULL,
      user TEXT NOT NULL,
      details TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER,
      to_address TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      attachment_path TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      identifier TEXT NOT NULL UNIQUE,
      initials TEXT NOT NULL,
      created_at TEXT NOT NULL,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'standard'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  await ensureColumn('courses', 'archived_at', 'TEXT');
  await ensureColumn('admins', 'password_hash', 'TEXT');
  await ensureColumn("admins", 'role', "TEXT NOT NULL DEFAULT 'standard'");
  await ensureColumn('drivers', 'password_hash', 'TEXT');

  const adminsWithoutPassword = await db.all(
    "SELECT id FROM admins WHERE password_hash IS NULL OR TRIM(password_hash) = ''"
  );

  if (adminsWithoutPassword.length) {
    const fallbackHash = await hashPassword(FALLBACK_ADMIN_PASSWORD);
    const updatePromises = adminsWithoutPassword.map((admin) =>
      db.run('UPDATE admins SET password_hash = ? WHERE id = ?', [fallbackHash, admin.id])
    );
    await Promise.all(updatePromises);
  }

  await db.run("UPDATE admins SET role = 'standard' WHERE role IS NULL OR TRIM(role) = ''");

  const driverCount = await db.get('SELECT COUNT(*) as count FROM drivers');
  if (driverCount.count === 0) {
    const now = new Date().toISOString();
    const sampleDrivers = [
      { first_name: 'Jean', last_name: 'Dupont', email: 'jean.dupont@agriholann.com' },
      { first_name: 'Pierre', last_name: 'Dupont', email: 'pierre.dupont@agriholann.com' },
      { first_name: 'Marc', last_name: 'Martin', email: 'marc.martin@agriholann.com' },
      { first_name: 'Luc', last_name: 'Bernard', email: 'luc.bernard@agriholann.com' },
      { first_name: 'Thomas', last_name: 'Petit', email: 'thomas.petit@agriholann.com' },
    ];

    for (const driver of sampleDrivers) {
      await db.run(
        'INSERT INTO drivers (first_name, last_name, email, phone) VALUES (?, ?, ?, ?)',
        [driver.first_name, driver.last_name, driver.email, null]
      );
    }

    const jean = await db.get('SELECT id FROM drivers WHERE last_name = ? AND first_name = ?', ['Dupont', 'Jean']);
    const pierre = await db.get('SELECT id FROM drivers WHERE last_name = ? AND first_name = ?', ['Dupont', 'Pierre']);
    const marc = await db.get('SELECT id FROM drivers WHERE last_name = ? AND first_name = ?', ['Martin', 'Marc']);

    const sampleCourses = [
      {
        driver_id: jean.id,
        date_time: new Date().setHours(10, 0, 0, 0),
        departure: 'Entrepôt Agri Holann',
        destination: 'Coopérative de Bléville',
        merchandise: 'Céréales',
        comments: 'Livraison urgente',
        status: 'pending',
      },
      {
        driver_id: jean.id,
        date_time: new Date().setHours(14, 30, 0, 0),
        departure: 'Coopérative de Bléville',
        destination: 'Minoterie du Nord',
        merchandise: 'Blé',
        comments: 'Contrôle qualité nécessaire',
        status: 'pending',
      },
      {
        driver_id: pierre.id,
        date_time: new Date(Date.now() + 24 * 60 * 60 * 1000).setHours(8, 0, 0, 0),
        departure: 'Entrepôt Agri Holann',
        destination: 'Marché de Provence',
        merchandise: 'Légumes',
        comments: null,
        status: 'pending',
      },
      {
        driver_id: marc.id,
        date_time: new Date(Date.now() - 24 * 60 * 60 * 1000).setHours(7, 30, 0, 0),
        departure: 'Ferme Bio du Sud',
        destination: 'Supermarché Eco',
        merchandise: 'Fruits',
        comments: 'Livraison matinale',
        status: 'completed',
        completion_comments: 'Livraison effectuée sans problème',
      },
    ];

    for (const course of sampleCourses) {
      const createdAt = new Date().toISOString();
      const dateTimeISO = new Date(course.date_time).toISOString();
      const result = await db.run(
        `INSERT INTO courses
          (driver_id, date_time, departure, destination, merchandise, comments, status, completion_comments, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          course.driver_id,
          dateTimeISO,
          course.departure,
          course.destination,
          course.merchandise,
          course.comments,
          course.status,
          course.completion_comments || null,
          createdAt,
          createdAt,
        ]
      );

    }
  }

  await ensureSuperAdmin();
  await ensureDefaultEmailRecipient();
  await ensureDefaultGmailSettings();
}

function normalizeActivityDetails(details) {
  if (!details) {
    return null;
  }

  if (typeof details === 'object') {
    try {
      return JSON.stringify(details);
    } catch (error) {
      console.warn('Unable to stringify activity details', error);
      return null;
    }
  }

  return details;
}

function parseActivityDetails(details) {
  if (!details) {
    return null;
  }

  try {
    return JSON.parse(details);
  } catch (error) {
    return null;
  }
}

async function logActivity(courseId, action, user, details = null) {
  const timestamp = new Date().toISOString();
  await db.run(
    'INSERT INTO activity_log (course_id, action, user, details, timestamp) VALUES (?, ?, ?, ?, ?)',
    [courseId || null, action, user, normalizeActivityDetails(details), timestamp]
  );
  broadcastEvent('activity:changed', { action, courseId: courseId || null });
}

async function mergeCreationAndCompletionActivity(courseId, completionUser, completionDetails = null) {
  const now = new Date().toISOString();
  const creationEntry = await db.get(
    `SELECT id, user, details
       FROM activity_log
      WHERE course_id = ? AND action IN ('created', 'created_completed')
      ORDER BY id ASC
      LIMIT 1`,
    [courseId]
  );

  if (!creationEntry) {
    await logActivity(courseId, 'completed', completionUser, {
      completedBy: completionUser,
      details: completionDetails || undefined,
    });
    return;
  }

  const metadata = parseActivityDetails(creationEntry.details) || {};
  const createdBy = metadata.createdBy || creationEntry.user || completionUser;
  const payload = {
    createdBy,
    completedBy: completionUser,
  };

  if (completionDetails) {
    payload.details = completionDetails;
  }

  const displayUser =
    createdBy === completionUser ? completionUser : `${createdBy}/${completionUser}`;

  await db.run(
    `UPDATE activity_log
        SET action = ?, user = ?, details = ?, timestamp = ?
      WHERE id = ?`,
    ['created_completed', displayUser, JSON.stringify(payload), now, creationEntry.id]
  );
}

async function recordEmail(courseId, to, subject, body, attachmentBuffer, attachmentName = EMAIL_ATTACHMENT_NAME) {
  const createdAt = new Date().toISOString();
  let attachmentPath = null;

  if (attachmentBuffer) {
    attachmentPath = path.join(ATTACHMENTS_DIR, `${courseId}-${Date.now()}-${attachmentName}`);
    await fs.promises.writeFile(attachmentPath, attachmentBuffer);
  }

  await db.run(
    'INSERT INTO emails (course_id, to_address, subject, body, attachment_path, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [courseId, to, subject, body, attachmentPath, createdAt]
  );
}

async function sendCompletionEmail(course, driver, completionComments, photoDataUrl) {
  const to = await getCompletionEmailRecipient();

  if (!to) {
    throw new Error('Aucun destinataire configuré pour les emails de validation.');
  }

  const driverFirstName = driver?.first_name || driver?.firstName || '';
  const driverLastName = driver?.last_name || driver?.lastName || '';
  const driverLabel = `${driverFirstName} ${driverLastName}`.trim() || 'Chauffeur';
  const destination = course.destination || 'Destination inconnue';
  const dateTime = course.date_time || course.dateTime || new Date().toISOString();
  const dateLabel = new Date(dateTime).toLocaleString('fr-FR');
  const comments = completionComments || 'Aucun commentaire';

  const subject = `[Livraison] ${driverLabel} - ${destination}`;
  const body = `Le chauffeur ${driverLabel} a effectué sa course du ${dateLabel}\n\nCommentaires: ${comments}`;

  const baseAttachmentName = EMAIL_ATTACHMENT_NAME.includes('.')
    ? EMAIL_ATTACHMENT_NAME.slice(0, EMAIL_ATTACHMENT_NAME.lastIndexOf('.'))
    : EMAIL_ATTACHMENT_NAME;

  let attachmentBuffer = null;
  let attachmentName = EMAIL_ATTACHMENT_NAME;
  let attachmentMimeType = 'image/jpeg';

  if (photoDataUrl && photoDataUrl.startsWith('data:')) {
    const [header, data] = photoDataUrl.split(',');
    const mimeMatch = header.match(/^data:(.*?);base64$/);
    if (mimeMatch && mimeMatch[1]) {
      attachmentMimeType = mimeMatch[1];
      const extension = attachmentMimeType.split('/')[1] || 'jpg';
      attachmentName = `${baseAttachmentName}.${extension}`;
    }
    attachmentBuffer = Buffer.from(data, 'base64');
  } else if (course.photo_path) {
    try {
      attachmentBuffer = await fs.promises.readFile(course.photo_path);
      const extension = path.extname(course.photo_path) || '.jpg';
      attachmentName = `${baseAttachmentName}${extension}`;
      const lowerExtension = extension.toLowerCase();
      if (lowerExtension === '.png') {
        attachmentMimeType = 'image/png';
      } else if (lowerExtension === '.jpg' || lowerExtension === '.jpeg') {
        attachmentMimeType = 'image/jpeg';
      } else if (lowerExtension === '.pdf') {
        attachmentMimeType = 'application/pdf';
      } else {
        attachmentMimeType = 'application/octet-stream';
      }
    } catch (error) {
      console.warn('Impossible de lire la photo associée à la course pour la pièce jointe', error);
    }
  }

  const response = await sendGmailMessage({
    to,
    subject,
    text: body,
    attachmentBuffer,
    attachmentName,
    attachmentMimeType,
  });

  await recordEmail(course.id, to, subject, body, attachmentBuffer, attachmentName);

  return { to, subject, body, messageId: response?.id || null };
}

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  res.write('retry: 3000\n\n');

  const client = {
    res,
    heartbeat: setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch (error) {
        clearInterval(client.heartbeat);
        sseClients.delete(client);
      }
    }, 30000),
  };

  sseClients.add(client);
  sendSseEvent(client, { type: 'connection', timestamp: Date.now() });

  req.on('close', () => {
    clearInterval(client.heartbeat);
    sseClients.delete(client);
  });
});

app.get('/api/drivers', async (req, res) => {
  try {
    const { search } = req.query;
    let query =
      "SELECT id, first_name, last_name, email, phone, CASE WHEN password_hash IS NULL OR TRIM(password_hash) = '' THEN 0 ELSE 1 END AS has_password FROM drivers";
    const params = [];

    if (search) {
      query += ' WHERE LOWER(last_name) LIKE ? OR LOWER(first_name) LIKE ?';
      const term = `%${search.toLowerCase()}%`;
      params.push(term, term);
    }

    query += ' ORDER BY last_name ASC, first_name ASC';

    const rows = await db.all(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching drivers', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des chauffeurs' });
  }
});

app.post('/api/drivers', async (req, res) => {
  try {
    const sessionInfo = await enforceAdminSession(req, res, {
      allowRoles: Array.from(ADMIN_ROLES),
    });
    if (!sessionInfo) {
      return;
    }

    const { firstName, lastName, email, phone } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ message: 'Le prénom et le nom sont obligatoires.' });
    }

    const result = await db.run(
      `INSERT INTO drivers (first_name, last_name, email, phone) VALUES (?, ?, ?, ?)`,
      [firstName.trim(), lastName.trim(), email || null, phone || null]
    );

    const driver = await db.get('SELECT id, first_name, last_name, email, phone FROM drivers WHERE id = ?', [result.lastID]);
    res.status(201).json(driver);
    broadcastEvent('drivers:updated', { action: 'created', driverId: driver.id });
  } catch (error) {
    console.error('Error creating driver', error);
    res.status(500).json({ message: 'Erreur lors de la création du chauffeur' });
  }
});

app.delete('/api/drivers/:id', async (req, res) => {
  try {
    const sessionInfo = await enforceAdminSession(req, res, {
      allowRoles: Array.from(ADMIN_ROLES),
    });
    if (!sessionInfo) {
      return;
    }

    const driverId = req.params.id;
    const driver = await db.get('SELECT * FROM drivers WHERE id = ?', [driverId]);

    if (!driver) {
      return res.status(404).json({ message: 'Chauffeur introuvable' });
    }

    await db.run('DELETE FROM drivers WHERE id = ?', [driverId]);
    res.status(204).send();
    broadcastEvent('drivers:updated', { action: 'deleted', driverId: Number(driverId) });
  } catch (error) {
    console.error('Error deleting driver', error);
    res.status(500).json({ message: 'Erreur lors de la suppression du chauffeur' });
  }
});

app.get('/api/admins', async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT id, first_name, last_name, identifier, initials, created_at, role FROM admins ORDER BY last_name ASC, first_name ASC`
    );

    res.json(
      rows.map((admin) => ({
        id: admin.id,
        firstName: admin.first_name,
        lastName: admin.last_name,
        identifier: admin.identifier,
        initials: admin.initials,
        createdAt: admin.created_at,
        role: admin.role,
      }))
    );
  } catch (error) {
    console.error('Error fetching admins', error);
    res.status(500).json({ message: "Erreur lors de la récupération des comptes administrateurs" });
  }
});

app.post('/api/admins', async (req, res) => {
  try {
    const sessionInfo = await enforceAdminSession(req, res, { requireSuperAdmin: true });
    if (!sessionInfo) {
      return;
    }

    const { firstName, lastName, password, role } = req.body || {};

    if (!firstName || !lastName) {
      return res.status(400).json({ message: 'Le prénom et le nom sont obligatoires.' });
    }

    if (!password) {
      return res.status(400).json({ message: 'Le mot de passe administrateur est obligatoire.' });
    }

    const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : 'standard';

    if (!ADMIN_CREATABLE_ROLES.includes(normalizedRole)) {
      return res.status(400).json({ message: 'Niveau administrateur invalide.' });
    }

    const identifier = await generateUniqueAdminIdentifier(firstName, lastName);
    if (!identifier) {
      return res.status(400).json({ message: "Impossible de générer l'identifiant administrateur." });
    }

    const initials = buildAdminInitials(firstName, lastName);
    const createdAt = new Date().toISOString();
    const passwordHash = await hashPassword(password);

    const result = await db.run(
      `INSERT INTO admins (first_name, last_name, identifier, initials, created_at, password_hash, role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [firstName.trim(), lastName.trim(), identifier, initials, createdAt, passwordHash, normalizedRole]
    );

    const admin = await db.get(
      'SELECT id, first_name, last_name, identifier, initials, created_at, role FROM admins WHERE id = ?',
      [result.lastID]
    );

    res.status(201).json({
      id: admin.id,
      firstName: admin.first_name,
      lastName: admin.last_name,
      identifier: admin.identifier,
      initials: admin.initials,
      createdAt: admin.created_at,
      role: admin.role,
    });
    broadcastEvent('admins:updated', { action: 'created', adminId: admin.id });
  } catch (error) {
    console.error('Error creating admin', error);
    res.status(500).json({ message: "Erreur lors de la création du compte administrateur" });
  }
});

app.delete('/api/admins/:id', async (req, res) => {
  try {
    const adminId = parseInt(req.params.id, 10);
    if (!Number.isInteger(adminId)) {
      return res.status(400).json({ message: 'Identifiant administrateur invalide.' });
    }

    const sessionInfo = await enforceAdminSession(req, res, { requireSuperAdmin: true });
    if (!sessionInfo) {
      return;
    }

    const target = await db.get('SELECT id, identifier FROM admins WHERE id = ?', [adminId]);
    if (!target) {
      return res.status(404).json({ message: 'Compte administrateur introuvable.' });
    }

    if (target.identifier.toLowerCase() === SUPER_ADMIN_IDENTIFIER) {
      return res.status(400).json({ message: 'Le compte super administrateur ne peut pas être supprimé.' });
    }

    await db.run('DELETE FROM admins WHERE id = ?', [adminId]);
    res.status(204).send();
    broadcastEvent('admins:updated', { action: 'deleted', adminId });
  } catch (error) {
    console.error('Error deleting admin', error);
    res.status(500).json({ message: "Erreur lors de la suppression du compte administrateur" });
  }
});

app.put('/api/admins/:id/password', async (req, res) => {
  try {
    const adminId = parseInt(req.params.id, 10);
    if (!Number.isInteger(adminId)) {
      return res.status(400).json({ message: 'Identifiant administrateur invalide.' });
    }

    const sessionInfo = await enforceAdminSession(req, res, { allowSelfOnly: adminId });
    if (!sessionInfo) {
      return;
    }

    const { currentPassword, newPassword } = req.body || {};
    const trimmedNewPassword = typeof newPassword === 'string' ? newPassword.trim() : '';

    if (!trimmedNewPassword) {
      return res.status(400).json({ message: 'Veuillez renseigner un nouveau mot de passe.' });
    }

    const admin = await db.get('SELECT password_hash FROM admins WHERE id = ?', [adminId]);
    if (!admin) {
      return res.status(404).json({ message: 'Compte administrateur introuvable.' });
    }

    if (admin.password_hash && admin.password_hash.trim()) {
      if (!currentPassword || !currentPassword.trim()) {
        return res.status(400).json({ message: 'Veuillez renseigner votre mot de passe actuel.' });
      }

      const isValid = await comparePassword(currentPassword, admin.password_hash);
      if (!isValid) {
        return res.status(401).json({ message: 'Mot de passe actuel invalide.' });
      }
    }

    const passwordHash = await hashPassword(trimmedNewPassword);
    await db.run('UPDATE admins SET password_hash = ? WHERE id = ?', [passwordHash, adminId]);

    res.json({ message: 'Mot de passe mis à jour.' });
  } catch (error) {
    console.error('Error updating admin password', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du mot de passe administrateur' });
  }
});

app.get('/api/settings/email-config', async (req, res) => {
  try {
    const sessionInfo = await enforceAdminSession(req, res, {
      allowRoles: Array.from(ADMIN_ROLES),
    });
    if (!sessionInfo) {
      return;
    }

    const settings = await getEmailSettingsFromDatabase();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching email configuration', error);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération de la configuration email" });
  }
});

app.put('/api/settings/email-config', async (req, res) => {
  try {
    const sessionInfo = await enforceAdminSession(req, res, {
      allowRoles: Array.from(ADMIN_ROLES),
    });
    if (!sessionInfo) {
      return;
    }

    const {
      recipient,
      gmailClientId,
      gmailClientSecret,
      gmailRefreshToken,
      gmailRedirectUri,
    } = req.body || {};

    const normalizedRecipient = typeof recipient === 'string' ? recipient.trim() : '';
    const normalizedClientId = typeof gmailClientId === 'string' ? gmailClientId.trim() : '';
    const normalizedClientSecret =
      typeof gmailClientSecret === 'string' ? gmailClientSecret.trim() : '';
    const normalizedRefreshToken =
      typeof gmailRefreshToken === 'string' ? gmailRefreshToken.trim() : '';
    const normalizedRedirectUri =
      typeof gmailRedirectUri === 'string' ? gmailRedirectUri.trim() : DEFAULT_GMAIL_REDIRECT_URI;

    if (!isValidEmail(normalizedRecipient)) {
      return res.status(400).json({ message: 'Adresse email de réception invalide.' });
    }

    if (!normalizedClientId || !normalizedClientSecret || !normalizedRefreshToken) {
      return res.status(400).json({ message: 'Veuillez renseigner les identifiants Gmail complets.' });
    }

    const settings = await persistEmailSettings({
      recipient: normalizedRecipient,
      gmailClientId: normalizedClientId,
      gmailClientSecret: normalizedClientSecret,
      gmailRefreshToken: normalizedRefreshToken,
      gmailRedirectUri: normalizedRedirectUri,
    });

    res.json(settings);
  } catch (error) {
    console.error('Error updating email configuration', error);
    res.status(500).json({ message: "Erreur lors de la mise à jour de la configuration email" });
  }
});

app.get('/api/settings/email-recipient', async (req, res) => {
  try {
    const sessionInfo = await enforceAdminSession(req, res, {
      allowRoles: Array.from(ADMIN_ROLES),
    });
    if (!sessionInfo) {
      return;
    }

    const settings = await getEmailSettingsFromDatabase();
    res.json({ email: settings.recipient });
    broadcastEvent('settings:email-updated', {});
  } catch (error) {
    console.error('Error fetching email recipient setting', error);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération de l'adresse email de réception" });
  }
});

app.put('/api/settings/email-recipient', async (req, res) => {
  try {
    const sessionInfo = await enforceAdminSession(req, res, {
      allowRoles: Array.from(ADMIN_ROLES),
    });
    if (!sessionInfo) {
      return;
    }

    const { email } = req.body || {};
    const normalizedEmail = typeof email === 'string' ? email.trim() : '';

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: 'Adresse email invalide.' });
    }

    const settings = await persistEmailSettings({ recipient: normalizedEmail });

    res.json({ email: settings.recipient });
  } catch (error) {
    console.error('Error updating email recipient setting', error);
    res
      .status(500)
      .json({ message: "Erreur lors de la mise à jour de l'adresse email de réception" });
  }
});

app.post('/api/admins/login', async (req, res) => {
  try {
    const { identifier, firstName, lastName, password } = req.body;

    if (!identifier && (!firstName || !lastName)) {
      return res.status(400).json({ message: 'Identifiant ou couple prénom/nom requis.' });
    }

    if (!password) {
      return res.status(400).json({ message: 'Le mot de passe est requis pour la connexion administrateur.' });
    }

    let admin;

    if (identifier) {
      admin = await db.get(
        `SELECT id, first_name, last_name, identifier, initials, created_at, password_hash, role
         FROM admins WHERE LOWER(identifier) = ?`,
        [identifier.toLowerCase()]
      );
    }

    if (!admin && firstName && lastName) {
      admin = await db.get(
        `SELECT id, first_name, last_name, identifier, initials, created_at, password_hash, role
         FROM admins
         WHERE LOWER(first_name) = ? AND LOWER(last_name) = ?`,
        [firstName.trim().toLowerCase(), lastName.trim().toLowerCase()]
      );
    }

    if (!admin) {
      return res.status(404).json({ message: 'Compte administrateur introuvable.' });
    }

    const isValidPassword = await comparePassword(password, admin.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Identifiants administrateur invalides.' });
    }

    const token = createAdminSession(admin);

    res.json({
      id: admin.id,
      firstName: admin.first_name,
      lastName: admin.last_name,
      identifier: admin.identifier,
      initials: admin.initials,
      createdAt: admin.created_at,
      role: admin.role,
      token,
    });
  } catch (error) {
    console.error('Error logging admin', error);
    res.status(500).json({ message: 'Erreur lors de la connexion administrateur' });
  }
});

app.post('/api/admins/logout', (req, res) => {
  const token = req.headers['x-admin-token'];
  if (token && activeAdminSessions.has(token)) {
    activeAdminSessions.delete(token);
  }
  res.status(204).send();
});

app.get('/api/drivers/credentials', async (req, res) => {
  try {
    const sessionInfo = await enforceAdminSession(req, res, {
      allowRoles: Array.from(ADMIN_ROLES),
    });
    if (!sessionInfo) {
      return;
    }

    const drivers = await db.all(
      "SELECT id, first_name, last_name, email, phone, CASE WHEN password_hash IS NULL OR TRIM(password_hash) = '' THEN 0 ELSE 1 END AS has_password FROM drivers ORDER BY last_name ASC, first_name ASC"
    );

    res.json(drivers);
  } catch (error) {
    console.error('Error fetching driver credentials', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des mots de passe chauffeurs' });
  }
});

app.get('/api/drivers/:id', async (req, res) => {
  try {
    const driverId = parseInt(req.params.id, 10);
    if (!Number.isInteger(driverId)) {
      return res.status(400).json({ message: 'Identifiant chauffeur invalide.' });
    }

    const driver = await db.get(
      "SELECT id, first_name, last_name, email, phone, CASE WHEN password_hash IS NULL OR TRIM(password_hash) = '' THEN 0 ELSE 1 END AS has_password FROM drivers WHERE id = ?",
      [driverId]
    );

    if (!driver) {
      return res.status(404).json({ message: 'Chauffeur introuvable.' });
    }

    res.json(driver);
  } catch (error) {
    console.error('Error fetching driver', error);
    res.status(500).json({ message: 'Erreur lors de la récupération du chauffeur' });
  }
});

app.get('/api/admins/session', async (req, res) => {
  try {
    const sessionInfo = await enforceAdminSession(req, res);
    if (!sessionInfo) {
      return;
    }

    const { admin, token } = sessionInfo;
    res.json({
      id: admin.id,
      firstName: admin.first_name,
      lastName: admin.last_name,
      identifier: admin.identifier,
      initials: admin.initials,
      role: admin.role,
      token,
    });
  } catch (error) {
    console.error('Error validating admin session', error);
    res.status(500).json({ message: 'Erreur lors de la validation de la session administrateur' });
  }
});

app.post('/api/drivers/login', async (req, res) => {
  try {
    const { driverId, password } = req.body || {};

    if (!driverId) {
      return res.status(400).json({ message: 'Identifiant chauffeur manquant.' });
    }

    const driver = await db.get('SELECT id, first_name, last_name, email, phone, password_hash FROM drivers WHERE id = ?', [
      driverId,
    ]);

    if (!driver) {
      return res.status(404).json({ message: 'Chauffeur introuvable.' });
    }

    const hasPassword = Boolean(driver.password_hash && driver.password_hash.trim());

    if (hasPassword) {
      if (!password || !password.trim()) {
        return res.status(400).json({ message: 'Mot de passe requis pour ce chauffeur.' });
      }

      const isValid = await comparePassword(password, driver.password_hash);
      if (!isValid) {
        return res.status(401).json({ message: 'Mot de passe chauffeur invalide.' });
      }
    }

    res.json({
      id: driver.id,
      firstName: driver.first_name,
      lastName: driver.last_name,
      email: driver.email,
      phone: driver.phone,
      hasPassword,
    });
  } catch (error) {
    console.error('Error validating driver login', error);
    res.status(500).json({ message: 'Erreur lors de la vérification du mot de passe chauffeur' });
  }
});

app.put('/api/drivers/:id/password', async (req, res) => {
  try {
    const driverId = parseInt(req.params.id, 10);
    if (!Number.isInteger(driverId)) {
      return res.status(400).json({ message: 'Identifiant chauffeur invalide.' });
    }

    const sessionInfo = await enforceAdminSession(req, res, {
      allowRoles: Array.from(ADMIN_ROLES),
    });
    if (!sessionInfo) {
      return;
    }

    const { newPassword } = req.body || {};
    const trimmedPassword = typeof newPassword === 'string' ? newPassword.trim() : '';

    if (!trimmedPassword) {
      return res.status(400).json({ message: 'Veuillez renseigner un mot de passe.' });
    }

    const driver = await db.get('SELECT id FROM drivers WHERE id = ?', [driverId]);
    if (!driver) {
      return res.status(404).json({ message: 'Chauffeur introuvable.' });
    }

    const passwordHash = await hashPassword(trimmedPassword);
    await db.run('UPDATE drivers SET password_hash = ? WHERE id = ?', [passwordHash, driverId]);

    res.json({ id: driverId, hasPassword: true });
    broadcastEvent('driver-passwords:updated', { driverId, hasPassword: true });
  } catch (error) {
    console.error('Error setting driver password', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du mot de passe chauffeur' });
  }
});

app.delete('/api/drivers/:id/password', async (req, res) => {
  try {
    const driverId = parseInt(req.params.id, 10);
    if (!Number.isInteger(driverId)) {
      return res.status(400).json({ message: 'Identifiant chauffeur invalide.' });
    }

    const sessionInfo = await enforceAdminSession(req, res, {
      allowRoles: Array.from(ADMIN_ROLES),
    });
    if (!sessionInfo) {
      return;
    }

    const driver = await db.get('SELECT id FROM drivers WHERE id = ?', [driverId]);
    if (!driver) {
      return res.status(404).json({ message: 'Chauffeur introuvable.' });
    }

    await db.run('UPDATE drivers SET password_hash = NULL WHERE id = ?', [driverId]);
    res.status(204).send();
    broadcastEvent('driver-passwords:updated', { driverId, hasPassword: false });
  } catch (error) {
    console.error('Error removing driver password', error);
    res.status(500).json({ message: 'Erreur lors de la suppression du mot de passe chauffeur' });
  }
});

app.get('/api/courses', async (req, res) => {
  try {
    const { driverId, from, to, archived } = req.query;
    const conditions = [];
    const params = [];

    if (driverId) {
      conditions.push('driver_id = ?');
      params.push(driverId);
    }

    if (archived === 'true') {
      conditions.push('archived_at IS NOT NULL');
    } else if (archived !== 'all') {
      conditions.push('archived_at IS NULL');
    }

    if (from) {
      conditions.push('date_time >= ?');
      params.push(new Date(from).toISOString());
    }

    if (to) {
      conditions.push('date_time <= ?');
      params.push(new Date(to).toISOString());
    }

    let query = `SELECT c.*, d.first_name, d.last_name FROM courses c
      LEFT JOIN drivers d ON d.id = c.driver_id`;

    if (conditions.length) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY date_time ASC';

    const rows = await db.all(query, params);
    res.json(
      rows.map((row) => ({
        id: row.id,
        driverId: row.driver_id,
        driverName:
          row.first_name && row.last_name
            ? `${row.first_name} ${row.last_name}`
            : row.first_name || row.last_name || null,
        dateTime: row.date_time,
        departure: row.departure,
        destination: row.destination,
        merchandise: row.merchandise,
        comments: row.comments,
        status: row.status,
        photoUrl: row.photo_path ? `/storage/attachments/${path.basename(row.photo_path)}` : null,
        completionComments: row.completion_comments,
        archivedAt: row.archived_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))
    );
  } catch (error) {
    console.error('Error fetching courses', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des courses' });
  }
});

app.get('/api/courses/:id', async (req, res) => {
  try {
    const row = await db.get(
      `SELECT c.*, d.first_name, d.last_name
       FROM courses c
       LEFT JOIN drivers d ON d.id = c.driver_id
       WHERE c.id = ?`,
      [req.params.id]
    );

    if (!row) {
      return res.status(404).json({ message: 'Course introuvable' });
    }

    res.json({
      id: row.id,
      driverId: row.driver_id,
      driverName:
        row.first_name && row.last_name
          ? `${row.first_name} ${row.last_name}`
          : row.first_name || row.last_name || null,
      dateTime: row.date_time,
      departure: row.departure,
      destination: row.destination,
      merchandise: row.merchandise,
      comments: row.comments,
      status: row.status,
      photoUrl: row.photo_path ? `/storage/attachments/${path.basename(row.photo_path)}` : null,
      completionComments: row.completion_comments,
      archivedAt: row.archived_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error('Error fetching course', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de la course' });
  }
});

app.post('/api/courses', async (req, res) => {
  try {
    const { driverId, dateTime, departure, destination, merchandise, comments, user } = req.body;

    if (!driverId || !dateTime || !departure || !destination) {
      return res.status(400).json({ message: 'Données de course incomplètes' });
    }

    const now = new Date().toISOString();
    const result = await db.run(
      `INSERT INTO courses
        (driver_id, date_time, departure, destination, merchandise, comments, status, archived_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)`,
      [
        driverId,
        new Date(dateTime).toISOString(),
        departure,
        destination,
        merchandise || null,
        comments || null,
        now,
        now,
      ]
    );

    const course = await db.get('SELECT * FROM courses WHERE id = ?', [result.lastID]);

    const creator = user || 'LS';
    await logActivity(course.id, 'created', creator, { createdBy: creator });

    res.status(201).json(course);
    broadcastEvent('courses:changed', {
      action: 'created',
      courseId: course.id,
      driverId: course.driver_id,
    });
  } catch (error) {
    console.error('Error creating course', error);
    res.status(500).json({ message: 'Erreur lors de la création de la course' });
  }
});

app.put('/api/courses/:id', async (req, res) => {
  try {
    const courseId = req.params.id;
    const { driverId, dateTime, departure, destination, merchandise, comments, status, user } = req.body;

    const existing = await db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!existing) {
      return res.status(404).json({ message: 'Course introuvable' });
    }

    const updatedAt = new Date().toISOString();

    await db.run(
      `UPDATE courses SET
        driver_id = ?,
        date_time = ?,
        departure = ?,
        destination = ?,
        merchandise = ?,
        comments = ?,
        status = ?,
        updated_at = ?
      WHERE id = ?`,
      [
        driverId || existing.driver_id,
        dateTime ? new Date(dateTime).toISOString() : existing.date_time,
        departure || existing.departure,
        destination || existing.destination,
        merchandise || null,
        comments || null,
        status || existing.status,
        updatedAt,
        courseId,
      ]
    );

    await logActivity(courseId, 'modified', user || 'LS', 'Course modifiée');

    const updated = await db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
    res.json(updated);
    broadcastEvent('courses:changed', {
      action: 'updated',
      courseId: updated.id,
      driverId: updated.driver_id,
    });
  } catch (error) {
    console.error('Error updating course', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la course' });
  }
});

app.delete('/api/courses/:id', async (req, res) => {
  try {
    const courseId = req.params.id;
    const { user } = req.query;

    const existing = await db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!existing) {
      return res.status(404).json({ message: 'Course introuvable' });
    }

    await logActivity(courseId, 'deleted', user || 'LS', {
      departure: existing.departure,
      destination: existing.destination,
      driverId: existing.driver_id,
      scheduledAt: existing.date_time,
    });

    await db.run('DELETE FROM courses WHERE id = ?', [courseId]);

    res.status(204).send();
    broadcastEvent('courses:changed', {
      action: 'deleted',
      courseId: Number(courseId),
      driverId: existing.driver_id,
    });
  } catch (error) {
    console.error('Error deleting course', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de la course' });
  }
});

app.post('/api/courses/:id/archive', async (req, res) => {
  try {
    const courseId = req.params.id;
    const { user } = req.body;

    const course = await db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({ message: 'Course introuvable' });
    }

    const archivedAt = new Date().toISOString();
    await db.run('UPDATE courses SET archived_at = ?, updated_at = ? WHERE id = ?', [archivedAt, archivedAt, courseId]);
    await logActivity(courseId, 'archived', user || 'LS', 'Course archivée');

    res.json({ message: 'Course archivée', archivedAt });
    broadcastEvent('courses:changed', {
      action: 'archived',
      courseId: Number(courseId),
      driverId: course.driver_id,
    });
  } catch (error) {
    console.error('Error archiving course', error);
    res.status(500).json({ message: "Erreur lors de l'archivage de la course" });
  }
});

app.post('/api/courses/:id/unarchive', async (req, res) => {
  try {
    const courseId = req.params.id;
    const { user } = req.body;

    const course = await db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({ message: 'Course introuvable' });
    }

    if (!course.archived_at) {
      return res.status(400).json({ message: 'Course déjà active' });
    }

    const updatedAt = new Date().toISOString();
    await db.run('UPDATE courses SET archived_at = NULL, updated_at = ? WHERE id = ?', [updatedAt, courseId]);
    await logActivity(courseId, 'restored', user || 'LS', 'Course désarchivée');

    res.json({ message: 'Course restaurée' });
    broadcastEvent('courses:changed', {
      action: 'restored',
      courseId: Number(courseId),
      driverId: course.driver_id,
    });
  } catch (error) {
    console.error('Error unarchiving course', error);
    res.status(500).json({ message: 'Erreur lors de la restauration de la course' });
  }
});

app.post('/api/courses/:id/complete', async (req, res) => {
  try {
    const courseId = req.params.id;
    const { completionComments, photoDataUrl, userInitials } = req.body;

    const course = await db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({ message: 'Course introuvable' });
    }

    const driver = await db.get('SELECT * FROM drivers WHERE id = ?', [course.driver_id]);
    const updatedAt = new Date().toISOString();

    let photoPath = course.photo_path || null;
    if (photoDataUrl && photoDataUrl.startsWith('data:image')) {
      const base64Data = photoDataUrl.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      photoPath = path.join(ATTACHMENTS_DIR, `course-${courseId}-${Date.now()}.jpg`);
      await fs.promises.writeFile(photoPath, buffer);
    }

    await db.run(
      `UPDATE courses SET status = 'completed', completion_comments = ?, photo_path = ?, updated_at = ? WHERE id = ?`,
      [completionComments || null, photoPath, updatedAt, courseId]
    );

    await mergeCreationAndCompletionActivity(courseId, userInitials || 'LS', completionComments || null);

    const completionEmail = await sendCompletionEmail(
      { ...course, photo_path: photoPath },
      driver,
      completionComments,
      photoDataUrl
    );

    res.json({ message: 'Course complétée', email: completionEmail });
    broadcastEvent('courses:changed', {
      action: 'completed',
      courseId: Number(courseId),
      driverId: course.driver_id,
    });
  } catch (error) {
    console.error('Error completing course', error);
    res
      .status(500)
      .json({ message: error.message || 'Erreur lors de la validation de la course' });
  }
});

app.get('/api/activity', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const rows = await db.all(
      `SELECT a.*, c.departure, c.destination, c.date_time, c.archived_at, d.first_name, d.last_name
       FROM activity_log a
       LEFT JOIN courses c ON c.id = a.course_id
       LEFT JOIN drivers d ON d.id = c.driver_id
       WHERE c.archived_at IS NULL OR c.id IS NULL
       ORDER BY timestamp DESC
       LIMIT ?`,
      [limit]
    );

    res.json(
      rows.map((row) => ({
        id: row.id,
        action: row.action,
        user: row.user,
        details: row.details,
        timestamp: row.timestamp,
        metadata: parseActivityDetails(row.details),
        course: row.course_id
          ? {
              id: row.course_id,
              departure: row.departure,
              destination: row.destination,
              dateTime: row.date_time,
              driverName: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : null,
              archivedAt: row.archived_at,
            }
          : null,
      }))
    );
  } catch (error) {
    console.error('Error fetching activity log', error);
    res.status(500).json({ message: "Erreur lors de la récupération du journal d'activité" });
  }
});

app.get('/api/emails', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM emails ORDER BY created_at DESC LIMIT 20');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching emails', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des emails' });
  }
});

app.get('/storage/attachments/:filename', (req, res) => {
  const filePath = path.join(ATTACHMENTS_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Fichier introuvable');
  }
  res.sendFile(filePath);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

async function start() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize database', error);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = { initDatabase };
