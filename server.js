const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db', 'agriholann.db');
const MESSAGES_DB_PATH = path.join(__dirname, 'db', 'agriholann-messages.db');
const ATTACHMENTS_DIR = path.join(__dirname, 'storage', 'attachments');
const FALLBACK_ADMIN_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'admin';
const SUPER_ADMIN_DEFAULT_PASSWORD = process.env.SUPER_ADMIN_DEFAULT_PASSWORD || 'lannion';
const SUPER_ADMIN_IDENTIFIER = 'lsaquet';
const SUPER_ADMIN_FIRST_NAME = 'Laurent';
const SUPER_ADMIN_LAST_NAME = 'Saquet';
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const DRIVER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
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

const COURSE_STATUS_PENDING = 'pending';
const COURSE_STATUS_COMPLETED = 'completed';
const COURSE_STATUS_ISSUE_REPORTED = 'issue_reported';
const COURSE_STATUSES = new Set([
  COURSE_STATUS_PENDING,
  COURSE_STATUS_COMPLETED,
  COURSE_STATUS_ISSUE_REPORTED,
]);

const NOTIFICATION_DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
});
const DRIVER_NOTIFICATION_CTA = "Ouvrez l'application pour consulter les détails.";
const MESSAGE_NOTIFICATION_CTA = "Ouvrez l'application pour lire et répondre.";

const activeAdminSessions = new Map();
const adminSessionIndex = new Map();
const activeDriverSessions = new Map();
const driverSessionIndex = new Map();
const sseClients = new Set();

function parseBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
      return false;
    }
  }

  return false;
}

function normalizeArrayParam(value) {
  if (!value && value !== 0) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : String(item)))
      .filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function mapCourseRow(row, options = {}) {
  const { includePhotoPath = false } = options;

  const mapped = {
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
    issueReportedAt: row.issue_reported_at,
    issueReportComment: row.issue_report_comment,
    issueReportedBy: row.issue_reported_by,
    photoUrl: row.photo_path ? `/storage/attachments/${path.basename(row.photo_path)}` : null,
    completionComments: row.completion_comments,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (includePhotoPath) {
    mapped.photoPath = row.photo_path || null;
  }

  return mapped;
}

function sanitizeNotificationText(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).replace(/\s+/g, ' ').trim();
}

function truncateNotificationText(value, maxLength = 160) {
  const text = sanitizeNotificationText(value);
  if (!text) {
    return '';
  }
  if (text.length <= maxLength) {
    return text;
  }
  const safeLength = Math.max(0, maxLength - 1);
  return `${text.slice(0, safeLength)}…`;
}

function formatNotificationDateTime(value) {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  try {
    return NOTIFICATION_DATE_FORMATTER.format(date);
  } catch (error) {
    return '';
  }
}

function buildCourseNotificationSummary(course) {
  if (!course) {
    return null;
  }
  return {
    id: Number(course.id) || null,
    driverId: Number(course.driver_id) || null,
    dateTime: course.date_time || null,
    departure: course.departure || null,
    destination: course.destination || null,
    merchandise: course.merchandise || null,
    status: course.status || null,
    archivedAt: course.archived_at || null,
    issueReportedAt: course.issue_reported_at || null,
    issueReportComment: course.issue_report_comment || null,
  };
}

function buildCourseNotificationMessage(action, course) {
  if (!course) {
    return null;
  }

  const summary = buildCourseNotificationSummary(course);
  const segments = [];

  if (summary?.departure || summary?.destination) {
    const departure = summary?.departure ? sanitizeNotificationText(summary.departure) : '';
    const destination = summary?.destination ? sanitizeNotificationText(summary.destination) : '';
    const route = [departure, destination].filter(Boolean).join(' → ');
    if (route) {
      segments.push(route);
    }
  }

  const formattedDate = formatNotificationDateTime(summary?.dateTime);
  if (formattedDate) {
    segments.push(`Prévue ${formattedDate}`);
  }

  let title = '';
  let mainText = '';

  switch (action) {
    case 'created':
    case 'restored':
    case 'reopened':
      title = 'Nouvelle course disponible';
      mainText = 'Une nouvelle course vient d’être planifiée pour vous.';
      break;
    case 'updated':
      title = 'Course mise à jour';
      mainText = 'Des modifications ont été apportées à l’une de vos courses.';
      break;
    case 'deleted':
      title = 'Course annulée';
      mainText = 'Cette course a été retirée de votre planning.';
      break;
    case 'archived':
      title = 'Course archivée';
      mainText = 'Cette course a été archivée par l’administration.';
      break;
    case 'completed':
      title = 'Course validée';
      mainText = 'La course a été marquée comme terminée.';
      break;
    case 'issue_reported': {
      title = 'Problème signalé';
      const comment = truncateNotificationText(summary?.issueReportComment, 120);
      mainText = comment ? `Problème signalé : ${comment}` : 'Un problème a été signalé sur cette course.';
      break;
    }
    default:
      title = 'Mise à jour de votre planning';
      mainText = 'Votre planning vient d’être actualisé.';
      break;
  }

  const bodyParts = [];
  if (segments.length) {
    bodyParts.push(segments.join(' · '));
  }
  if (mainText) {
    bodyParts.push(mainText);
  }
  bodyParts.push(DRIVER_NOTIFICATION_CTA);

  const body = sanitizeNotificationText(bodyParts.filter(Boolean).join(' '));
  const titleText = sanitizeNotificationText(title) || 'Notification';

  const notification = {
    title: titleText,
    body,
    context: 'course',
    audience: 'driver',
    tag: `course-${summary?.id || course.id || 'update'}-${action || 'updated'}`,
  };

  if (summary?.id || summary?.driverId) {
    notification.data = {};
    if (summary?.id) {
      notification.data.courseId = summary.id;
    }
    if (summary?.driverId) {
      notification.data.driverId = summary.driverId;
    }
  }

  return notification;
}

function buildMessageNotificationPayload(senderType, message) {
  if (!message) {
    return null;
  }

  const driverId = Number(message.driverId ?? message.driver_id ?? message.driverID) || null;
  const snippet = truncateNotificationText(message.body, 140);
  const baseTag = driverId ? `message-${driverId}` : 'message-thread';
  const tag = message.id ? `${baseTag}-${message.id}` : `${baseTag}-${Date.now()}`;

  if (senderType === 'admin') {
    const segments = [];
    if (snippet) {
      segments.push(snippet);
    }
    segments.push(MESSAGE_NOTIFICATION_CTA);

    const notification = {
      title: "Nouveau message de l'administration",
      body: sanitizeNotificationText(segments.join(' ')),
      context: 'message',
      audience: 'driver',
      tag,
    };

    if (driverId) {
      notification.data = { driverId };
    }

    return notification;
  }

  const senderLabel = sanitizeNotificationText(message.senderLabel || 'Un chauffeur');
  const segments = [];
  if (snippet) {
    segments.push(snippet);
  }
  segments.push(MESSAGE_NOTIFICATION_CTA);

  const notification = {
    title: `${senderLabel} vous a écrit`,
    body: sanitizeNotificationText(segments.join(' ')),
    context: 'message',
    audience: 'admin',
    tag,
  };

  if (driverId) {
    notification.data = { driverId };
  }

  return notification;
}

function buildCourseQuery(filters = {}) {
  const conditions = [];
  const params = [];

  if (filters.id) {
    conditions.push('c.id = ?');
    params.push(filters.id);
  }

  if (filters.driverId) {
    conditions.push('c.driver_id = ?');
    params.push(filters.driverId);
  }

  if (filters.driverIds && filters.driverIds.length) {
    const placeholders = filters.driverIds.map(() => '?').join(',');
    conditions.push(`c.driver_id IN (${placeholders})`);
    params.push(...filters.driverIds);
  }

  if (filters.archived === 'true') {
    conditions.push('c.archived_at IS NOT NULL');
  } else if (filters.archived === 'false') {
    conditions.push('c.archived_at IS NULL');
  } else if (!filters.archived || filters.archived === 'pending') {
    conditions.push('c.archived_at IS NULL');
  }

  if (filters.from) {
    const fromDate = new Date(filters.from);
    if (!Number.isNaN(fromDate.getTime())) {
      conditions.push('c.date_time >= ?');
      params.push(fromDate.toISOString());
    }
  }

  if (filters.to) {
    const toDate = new Date(filters.to);
    if (!Number.isNaN(toDate.getTime())) {
      conditions.push('c.date_time <= ?');
      params.push(toDate.toISOString());
    }
  }

  if (filters.status) {
    const statuses = normalizeArrayParam(filters.status).filter((status) => COURSE_STATUSES.has(status));
    if (statuses.length === 1) {
      conditions.push('c.status = ?');
      params.push(statuses[0]);
    } else if (statuses.length > 1) {
      const placeholders = statuses.map(() => '?').join(',');
      conditions.push(`c.status IN (${placeholders})`);
      params.push(...statuses);
    }
  }

  if (filters.merchandise) {
    const merchValues = normalizeArrayParam(filters.merchandise);
    if (merchValues.length === 1) {
      conditions.push('LOWER(c.merchandise) = LOWER(?)');
      params.push(merchValues[0]);
    } else if (merchValues.length > 1) {
      const placeholders = merchValues.map(() => '?').join(',');
      conditions.push(`LOWER(c.merchandise) IN (${placeholders})`);
      params.push(...merchValues.map((value) => value.toLowerCase()));
    }
  }

  if (filters.issue === 'reported') {
    conditions.push('(c.status = ? OR c.issue_reported_at IS NOT NULL)');
    params.push(COURSE_STATUS_ISSUE_REPORTED);
  } else if (filters.issue === 'none') {
    conditions.push('(c.status <> ? AND c.issue_reported_at IS NULL)');
    params.push(COURSE_STATUS_ISSUE_REPORTED);
  }

  if (filters.hasPhoto !== undefined) {
    const hasPhoto = parseBoolean(filters.hasPhoto);
    if (hasPhoto) {
      conditions.push('c.photo_path IS NOT NULL');
    } else {
      conditions.push('c.photo_path IS NULL');
    }
  }

  if (filters.hasComments !== undefined) {
    const hasComments = parseBoolean(filters.hasComments);
    if (hasComments) {
      conditions.push("(c.comments IS NOT NULL AND TRIM(c.comments) <> '')");
    } else {
      conditions.push("(c.comments IS NULL OR TRIM(c.comments) = '')");
    }
  }

  if (filters.search) {
    const term = `%${String(filters.search).trim().toLowerCase()}%`;
    const searchConditions = [
      'LOWER(c.departure) LIKE ?',
      'LOWER(c.destination) LIKE ?',
      'LOWER(c.merchandise) LIKE ?',
      'LOWER(c.comments) LIKE ?',
      'LOWER(d.first_name || " " || d.last_name) LIKE ?',
    ];
    conditions.push(`(${searchConditions.join(' OR ')})`);
    params.push(term, term, term, term, term);
  }

  let query = `SELECT c.*, d.first_name, d.last_name FROM courses c
    LEFT JOIN drivers d ON d.id = c.driver_id`;

  if (conditions.length) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  const orderDirection = filters.order === 'desc' ? 'DESC' : 'ASC';
  query += ` ORDER BY c.date_time ${orderDirection}`;

  return { query, params };
}

async function fetchCoursesWithFilters(filters = {}, options = {}) {
  const { query, params } = buildCourseQuery(filters);
  if (options.single) {
    return db.get(query, params);
  }
  return db.all(query, params);
}

function generateAdminSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createAdminSession(admin) {
  const adminId = admin.id;
  const previousToken = adminSessionIndex.get(adminId);
  if (previousToken) {
    activeAdminSessions.delete(previousToken);
    adminSessionIndex.delete(adminId);
    broadcastEvent('sessions:admin:revoked', {
      adminId,
      token: previousToken,
    });
  }

  const token = generateAdminSessionToken();
  activeAdminSessions.set(token, {
    adminId,
    expiresAt: Date.now() + ADMIN_SESSION_TTL_MS,
  });
  adminSessionIndex.set(adminId, token);
  return token;
}

function generateDriverSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createDriverSession(driver) {
  const driverId = driver?.id ?? driver;
  if (!driverId) {
    throw new Error('Identifiant chauffeur manquant pour la création de session.');
  }

  const previousToken = driverSessionIndex.get(driverId);
  if (previousToken) {
    activeDriverSessions.delete(previousToken);
    driverSessionIndex.delete(driverId);
    broadcastEvent('sessions:driver:revoked', {
      driverId,
      token: previousToken,
    });
  }

  const token = generateDriverSessionToken();
  activeDriverSessions.set(token, {
    driverId,
    expiresAt: Date.now() + DRIVER_SESSION_TTL_MS,
  });
  driverSessionIndex.set(driverId, token);
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
    adminSessionIndex.delete(session.adminId);
    res.status(401).json({ message: 'Session administrateur expirée.' });
    return null;
  }

  const admin = await db.get(
    'SELECT id, first_name, last_name, identifier, initials, role FROM admins WHERE id = ?',
    [session.adminId]
  );

  if (!admin) {
    activeAdminSessions.delete(token);
    adminSessionIndex.delete(session.adminId);
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
  adminSessionIndex.set(admin.id, token);

  return { admin, token };
}

async function enforceDriverSession(req, res, options = {}) {
  const token = req.headers['x-driver-token'];
  if (!token) {
    res.status(401).json({ message: 'Authentification chauffeur requise.' });
    return null;
  }

  const session = activeDriverSessions.get(token);
  if (!session) {
    res.status(401).json({ message: 'Session chauffeur invalide.' });
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    activeDriverSessions.delete(token);
    driverSessionIndex.delete(session.driverId);
    res.status(401).json({ message: 'Session chauffeur expirée.' });
    return null;
  }

  if (options.requireDriverId && session.driverId !== options.requireDriverId) {
    res.status(403).json({ message: 'Accès refusé pour ce chauffeur.' });
    return null;
  }

  session.expiresAt = Date.now() + DRIVER_SESSION_TTL_MS;
  activeDriverSessions.set(token, session);
  driverSessionIndex.set(session.driverId, token);

  return { driverId: session.driverId, token };
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
let messagesDb;

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

async function ensureMessagesDatabase() {
  await ensureDirectoryExists(path.dirname(MESSAGES_DB_PATH));

  messagesDb = await open({
    filename: MESSAGES_DB_PATH,
    driver: sqlite3.Database,
  });

  await messagesDb.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      driver_id INTEGER NOT NULL,
      sender_type TEXT NOT NULL CHECK(sender_type IN ('driver','admin')),
      sender_id INTEGER,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      admin_read_at TEXT,
      driver_read_at TEXT
    );
  `);
}

function buildPersonInitials(firstName, lastName) {
  const firstInitial = firstName ? firstName.trim().charAt(0) : '';
  const lastInitial = lastName ? lastName.trim().charAt(0) : '';
  const initials = `${firstInitial}${lastInitial}`.toUpperCase();
  return initials || 'LS';
}

async function ensureDefaultEmailRecipient() {
  await ensureSetting(EMAIL_RECIPIENT_SETTING_KEY, DEFAULT_COMPLETION_EMAIL);
}

async function getDriverSummary(driverId) {
  if (!Number.isInteger(driverId)) {
    return null;
  }
  return db.get(
    `SELECT id, first_name, last_name, email FROM drivers WHERE id = ?`,
    [driverId]
  );
}

async function getAdminSummary(adminId) {
  if (!Number.isInteger(adminId)) {
    return null;
  }
  return db.get(
    `SELECT id, first_name, last_name, identifier FROM admins WHERE id = ?`,
    [adminId]
  );
}

function normalizeMessageBody(body) {
  if (typeof body !== 'string') {
    return '';
  }
  return body.trim();
}

async function serializeMessage(row) {
  if (!row) {
    return null;
  }

  const base = {
    id: row.id,
    driverId: row.driver_id,
    senderType: row.sender_type,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
    adminReadAt: row.admin_read_at || null,
    driverReadAt: row.driver_read_at || null,
  };

  if (row.sender_type === 'driver') {
    const driver = await getDriverSummary(row.driver_id);
    const firstName = driver?.first_name || '';
    const lastName = driver?.last_name || '';
    base.senderLabel = `${firstName} ${lastName}`.trim() || 'Chauffeur';
    base.senderInitials = buildPersonInitials(firstName, lastName);
  } else if (row.sender_type === 'admin') {
    const admin = await getAdminSummary(row.sender_id ?? 0);
    const firstName = admin?.first_name || '';
    const lastName = admin?.last_name || '';
    base.senderLabel = admin ? `${firstName} ${lastName}`.trim() || admin.identifier || 'Admin' : 'Admin';
    base.senderInitials = buildPersonInitials(firstName, lastName);
  } else {
    base.senderLabel = 'Système';
    base.senderInitials = 'SYS';
  }

  return base;
}

async function markMessagesAsRead(driverId, readerType) {
  if (!messagesDb) {
    return;
  }

  const now = new Date().toISOString();

  if (readerType === 'admin') {
    await messagesDb.run(
      `UPDATE messages SET admin_read_at = ? WHERE driver_id = ? AND sender_type = 'driver' AND admin_read_at IS NULL`,
      [now, driverId]
    );
  } else if (readerType === 'driver') {
    await messagesDb.run(
      `UPDATE messages SET driver_read_at = ? WHERE driver_id = ? AND sender_type = 'admin' AND driver_read_at IS NULL`,
      [now, driverId]
    );
  }
}

async function initDatabase() {
  await ensureDirectoryExists(path.dirname(DB_PATH));
  await ensureDirectoryExists(ATTACHMENTS_DIR);

  db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });

  await db.exec('PRAGMA foreign_keys = ON');

  await ensureMessagesDatabase();

  if (messagesDb) {
    await messagesDb.exec('PRAGMA foreign_keys = ON');
  }

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
      issue_reported_at TEXT,
      issue_report_comment TEXT,
      issue_reported_by INTEGER,
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
  await ensureColumn('courses', 'issue_reported_at', 'TEXT');
  await ensureColumn('courses', 'issue_report_comment', 'TEXT');
  await ensureColumn('courses', 'issue_reported_by', 'INTEGER');
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

async function sendCourseIssueEmail(course, driver, issueComment) {
  const to = await getCompletionEmailRecipient();

  if (!to) {
    throw new Error('Aucun destinataire configuré pour les notifications de problème.');
  }

  const driverFirstName = driver?.first_name || driver?.firstName || '';
  const driverLastName = driver?.last_name || driver?.lastName || '';
  const driverLabel = `${driverFirstName} ${driverLastName}`.trim() || 'Chauffeur';
  const departure = course.departure || 'Lieu de départ non renseigné';
  const destination = course.destination || 'Destination non renseignée';
  const dateTime = course.date_time || course.dateTime || new Date().toISOString();
  const dateLabel = new Date(dateTime).toLocaleString('fr-FR');
  const comment = issueComment && issueComment.trim() ? issueComment.trim() : 'Aucun détail fourni';

  const subject = `[Incident] ${driverLabel} – ${destination}`;
  const body = `Le chauffeur ${driverLabel} a signalé un problème sur la course prévue le ${dateLabel}.\n\nTrajet : ${departure} → ${destination}\nCommentaire : ${comment}`;

  const response = await sendGmailMessage({
    to,
    subject,
    text: body,
  });

  await recordEmail(course.id, to, subject, body, null, EMAIL_ATTACHMENT_NAME);

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

app.put('/api/admins/:id', async (req, res) => {
  try {
    const adminId = parseInt(req.params.id, 10);
    if (!Number.isInteger(adminId)) {
      return res.status(400).json({ message: 'Identifiant administrateur invalide.' });
    }

    const sessionInfo = await enforceAdminSession(req, res, { requireSuperAdmin: true });
    if (!sessionInfo) {
      return;
    }

    const existing = await db.get(
      'SELECT id, first_name, last_name, identifier, role, created_at FROM admins WHERE id = ?',
      [adminId]
    );

    if (!existing) {
      return res.status(404).json({ message: 'Compte administrateur introuvable.' });
    }

    if (existing.identifier.toLowerCase() === SUPER_ADMIN_IDENTIFIER) {
      return res.status(400).json({ message: 'Le compte super administrateur ne peut pas être modifié.' });
    }

    const { firstName, lastName, identifier, role } = req.body || {};

    const trimmedFirstName = typeof firstName === 'string' ? firstName.trim() : '';
    const trimmedLastName = typeof lastName === 'string' ? lastName.trim() : '';
    const normalizedIdentifier = typeof identifier === 'string' ? identifier.trim().toLowerCase() : '';
    const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : existing.role;

    if (!trimmedFirstName || !trimmedLastName || !normalizedIdentifier) {
      return res.status(400).json({ message: 'Prénom, nom et identifiant sont obligatoires.' });
    }

    if (normalizedIdentifier === SUPER_ADMIN_IDENTIFIER) {
      return res.status(400).json({ message: "Cet identifiant est réservé au super administrateur." });
    }

    if (!ADMIN_CREATABLE_ROLES.includes(normalizedRole)) {
      return res.status(400).json({ message: 'Niveau administrateur invalide.' });
    }

    const identifierOwner = await db.get(
      'SELECT id FROM admins WHERE LOWER(identifier) = ? LIMIT 1',
      [normalizedIdentifier]
    );

    if (identifierOwner && identifierOwner.id !== adminId) {
      return res.status(409).json({ message: "Cet identifiant est déjà utilisé par un autre administrateur." });
    }

    const updates = [];
    const params = [];

    if (existing.first_name !== trimmedFirstName) {
      updates.push('first_name = ?');
      params.push(trimmedFirstName);
    }

    if (existing.last_name !== trimmedLastName) {
      updates.push('last_name = ?');
      params.push(trimmedLastName);
    }

    if (existing.identifier.toLowerCase() !== normalizedIdentifier) {
      updates.push('identifier = ?');
      params.push(normalizedIdentifier);
    }

    if (existing.role !== normalizedRole) {
      updates.push('role = ?');
      params.push(normalizedRole);
    }

    const initials = buildAdminInitials(trimmedFirstName, trimmedLastName);

    if (existing.first_name !== trimmedFirstName || existing.last_name !== trimmedLastName) {
      updates.push('initials = ?');
      params.push(initials);
    }

    if (!updates.length) {
      const admin = {
        id: existing.id,
        firstName: existing.first_name,
        lastName: existing.last_name,
        identifier: existing.identifier,
        initials,
        role: existing.role,
        createdAt: existing.created_at,
      };
      return res.json(admin);
    }

    await db.run(`UPDATE admins SET ${updates.join(', ')} WHERE id = ?`, [...params, adminId]);

    const updated = await db.get(
      'SELECT id, first_name, last_name, identifier, initials, created_at, role FROM admins WHERE id = ?',
      [adminId]
    );

    res.json({
      id: updated.id,
      firstName: updated.first_name,
      lastName: updated.last_name,
      identifier: updated.identifier,
      initials: updated.initials,
      createdAt: updated.created_at,
      role: updated.role,
    });
    broadcastEvent('admins:updated', { action: 'updated', adminId });
  } catch (error) {
    console.error('Error updating admin', error);
    res.status(500).json({ message: "Erreur lors de la mise à jour du compte administrateur" });
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
  if (token) {
    const session = activeAdminSessions.get(token);
    if (session) {
      activeAdminSessions.delete(token);
      adminSessionIndex.delete(session.adminId);
    }
  }
  res.status(204).send();
});

app.post('/api/drivers/logout', (req, res) => {
  const token = req.headers['x-driver-token'];
  if (token) {
    const session = activeDriverSessions.get(token);
    if (session) {
      activeDriverSessions.delete(token);
      driverSessionIndex.delete(session.driverId);
    }
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

app.get('/api/drivers/session', async (req, res) => {
  try {
    const sessionInfo = await enforceDriverSession(req, res);
    if (!sessionInfo) {
      return;
    }

    const driver = await db.get(
      `SELECT id, first_name, last_name, email, phone, password_hash
         FROM drivers WHERE id = ?`,
      [sessionInfo.driverId]
    );

    if (!driver) {
      activeDriverSessions.delete(sessionInfo.token);
      driverSessionIndex.delete(sessionInfo.driverId);
      res.status(401).json({ message: 'Compte chauffeur introuvable.' });
      return;
    }

    const hasPassword = Boolean(driver.password_hash && driver.password_hash.trim());

    res.json({
      id: driver.id,
      firstName: driver.first_name,
      lastName: driver.last_name,
      email: driver.email,
      phone: driver.phone,
      hasPassword,
    });
  } catch (error) {
    console.error('Error validating driver session', error);
    res.status(500).json({ message: 'Erreur lors de la validation de la session chauffeur' });
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

    const token = createDriverSession(driver);

    res.json({
      id: driver.id,
      firstName: driver.first_name,
      lastName: driver.last_name,
      email: driver.email,
      phone: driver.phone,
      hasPassword,
      token,
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
    const requestedDriverId =
      typeof req.query.driverId !== 'undefined' && req.query.driverId !== 'all'
        ? Number.parseInt(req.query.driverId, 10)
        : null;

    if (req.headers['x-admin-token']) {
      const sessionInfo = await enforceAdminSession(req, res);
      if (!sessionInfo) {
        return;
      }
    } else {
      if (!Number.isInteger(requestedDriverId)) {
        res.status(401).json({ message: 'Authentification requise pour consulter ces courses.' });
        return;
      }

      const sessionInfo = await enforceDriverSession(req, res, { requireDriverId: requestedDriverId });
      if (!sessionInfo) {
        return;
      }
    }

    const rows = await fetchCoursesWithFilters(req.query);
    res.json(rows.map((row) => mapCourseRow(row)));
  } catch (error) {
    console.error('Error fetching courses', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des courses' });
  }
});

app.get('/api/courses/export', async (req, res) => {
  try {
    const { format: requestedFormat, ...rawFilters } = req.query;
    const format = (requestedFormat || 'pdf').toString().toLowerCase();

    if (!['pdf', 'xlsx'].includes(format)) {
      return res.status(400).json({ message: "Format d'export non supporté." });
    }

    const filters = { ...rawFilters, order: 'asc' };
    const rows = await fetchCoursesWithFilters(filters);
    const courses = rows.map((row) => mapCourseRow(row, { includePhotoPath: true }));

    if (!courses.length) {
      return res.status(404).json({ message: 'Aucune course trouvée pour les filtres sélectionnés.' });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = `export-courses-${timestamp}`;

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}.pdf"`);

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      doc.pipe(res);

      doc.fontSize(18).text('Export des courses filtrées', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Total des courses : ${courses.length}`);
      doc.moveDown();

      courses.forEach((course, index) => {
        doc.fontSize(14).fillColor('#111111').text(`Course #${course.id}`, { continued: false });
        doc.moveDown(0.2);
        doc.fontSize(11).fillColor('#333333');
        doc.text(`Chauffeur : ${course.driverName || '—'}`);
        const courseDate = new Date(course.dateTime);
        doc.text(
          `Date : ${courseDate.toLocaleDateString('fr-FR')} ${courseDate.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })}`
        );
        doc.text(`Trajet : ${course.departure || '—'} → ${course.destination || '—'}`);
        doc.text(`Marchandise : ${course.merchandise || '—'}`);
        doc.text(`Statut : ${course.status || '—'}`);
        if (course.comments) {
          doc.text(`Commentaire : ${course.comments}`);
        }
        if (course.completionComments) {
          doc.text(`Commentaire de clôture : ${course.completionComments}`);
        }
        if (course.issueReportComment) {
          doc.text(`Problème signalé : ${course.issueReportComment}`);
        }

        if (course.photoPath && fs.existsSync(course.photoPath)) {
          try {
            doc.moveDown(0.3);
            doc.text('Photo du bon de livraison :');
            doc.moveDown(0.3);
            doc.image(course.photoPath, {
              fit: [430, 320],
              align: 'left',
            });
          } catch (error) {
            console.warn(`Impossible d\'ajouter la photo pour la course ${course.id}`, error.message);
            doc.text('Photo indisponible (erreur de lecture).');
          }
        }

        if (index < courses.length - 1) {
          doc.moveDown();
          doc.addPage();
        }
      });

      doc.end();
      return;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.xlsx"`);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Agri Holann';
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet('Courses');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Chauffeur', key: 'driverName', width: 25 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Heure', key: 'time', width: 10 },
      { header: 'Départ', key: 'departure', width: 20 },
      { header: 'Destination', key: 'destination', width: 20 },
      { header: 'Marchandise', key: 'merchandise', width: 20 },
      { header: 'Statut', key: 'status', width: 16 },
      { header: 'Commentaire', key: 'comments', width: 30 },
      { header: 'Clôture', key: 'completionComments', width: 30 },
      { header: 'Problème signalé', key: 'issueReportComment', width: 30 },
      { header: 'Photo', key: 'photo', width: 18 },
    ];

    for (const course of courses) {
      const date = new Date(course.dateTime);
      const row = worksheet.addRow({
        id: course.id,
        driverName: course.driverName || '—',
        date: date.toLocaleDateString('fr-FR'),
        time: date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        departure: course.departure || '—',
        destination: course.destination || '—',
        merchandise: course.merchandise || '—',
        status: course.status || '—',
        comments: course.comments || '',
        completionComments: course.completionComments || '',
        issueReportComment: course.issueReportComment || '',
      });

      row.alignment = { vertical: 'top', wrapText: true };

      if (course.photoPath && fs.existsSync(course.photoPath)) {
        try {
          const imageBuffer = await fs.promises.readFile(course.photoPath);
          const extension = path.extname(course.photoPath).replace('.', '').toLowerCase() || 'jpg';
          const imageId = workbook.addImage({
            buffer: imageBuffer,
            extension,
          });

          const rowIndex = row.number - 1; // zero-based for ExcelJS image positioning
          worksheet.addImage(imageId, {
            tl: { col: 11, row: rowIndex },
            ext: { width: 160, height: 120 },
            editAs: 'oneCell',
          });
          row.height = Math.max(row.height || 20, 95);
        } catch (error) {
          console.warn(`Impossible d\'embarquer la photo pour la course ${course.id}`, error.message);
        }
      }
    }

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Erreur lors de la génération de l'export", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Erreur lors de la génération de l'export" });
    } else {
      res.end();
    }
  }
});

app.get('/api/courses/:id', async (req, res) => {
  try {
    const row = await fetchCoursesWithFilters({ id: req.params.id }, { single: true });

    if (!row) {
      return res.status(404).json({ message: 'Course introuvable' });
    }

    res.json(mapCourseRow(row));
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

    const summary = buildCourseNotificationSummary(course);
    const notification = buildCourseNotificationMessage('created', course);

    res.status(201).json(course);
    broadcastEvent('courses:changed', {
      action: 'created',
      courseId: course.id,
      driverId: course.driver_id,
      summary,
      notification,
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
    const summary = buildCourseNotificationSummary(updated);
    const notification = buildCourseNotificationMessage('updated', updated);

    res.json(updated);
    broadcastEvent('courses:changed', {
      action: 'updated',
      courseId: updated.id,
      driverId: updated.driver_id,
      summary,
      notification,
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

    const deletedCourse = { ...existing, status: 'deleted' };
    const summary = buildCourseNotificationSummary(deletedCourse);
    const notification = buildCourseNotificationMessage('deleted', deletedCourse);

    res.status(204).send();
    broadcastEvent('courses:changed', {
      action: 'deleted',
      courseId: Number(courseId),
      driverId: existing.driver_id,
      summary,
      notification,
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

    const updatedCourse = await db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
    const summary = buildCourseNotificationSummary(updatedCourse);
    const notification = buildCourseNotificationMessage('archived', updatedCourse);

    res.json({ message: 'Course archivée', archivedAt });
    broadcastEvent('courses:changed', {
      action: 'archived',
      courseId: Number(courseId),
      driverId: course.driver_id,
      summary,
      notification,
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

    const updatedCourse = await db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
    const summary = buildCourseNotificationSummary(updatedCourse);
    const notification = buildCourseNotificationMessage('restored', updatedCourse);

    res.json({ message: 'Course restaurée' });
    broadcastEvent('courses:changed', {
      action: 'restored',
      courseId: Number(courseId),
      driverId: course.driver_id,
      summary,
      notification,
    });
  } catch (error) {
    console.error('Error unarchiving course', error);
    res.status(500).json({ message: 'Erreur lors de la restauration de la course' });
  }
});

app.post('/api/courses/:id/report-issue', async (req, res) => {
  try {
    const courseId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(courseId)) {
      return res.status(400).json({ message: 'Identifiant de course invalide.' });
    }

    const { driverId, comment } = req.body || {};
    const normalizedComment = typeof comment === 'string' ? comment.trim() : '';

    if (!driverId || !Number.isInteger(Number(driverId))) {
      return res.status(400).json({ message: 'Chauffeur requis pour signaler un problème.' });
    }

    const driverSession = await enforceDriverSession(req, res, {
      requireDriverId: Number(driverId),
    });
    if (!driverSession) {
      return;
    }

    const course = await db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({ message: 'Course introuvable.' });
    }

    if (course.driver_id !== Number(driverId)) {
      return res.status(403).json({ message: 'Ce chauffeur ne peut pas signaler cette course.' });
    }

    if (course.status === COURSE_STATUS_COMPLETED) {
      return res.status(400).json({ message: 'Impossible de signaler une course déjà validée.' });
    }

    const driver = await getDriverSummary(course.driver_id);
    if (!driver) {
      return res.status(404).json({ message: 'Chauffeur introuvable.' });
    }

    const updatedAt = new Date().toISOString();

    await db.run(
      `UPDATE courses
          SET status = ?,
              issue_reported_at = ?,
              issue_report_comment = ?,
              issue_reported_by = ?,
              updated_at = ?
        WHERE id = ?`,
      [
        COURSE_STATUS_ISSUE_REPORTED,
        updatedAt,
        normalizedComment || null,
        course.driver_id,
        updatedAt,
        courseId,
      ]
    );

    const initials = buildPersonInitials(driver.first_name, driver.last_name);
    await logActivity(courseId, 'issue_reported', initials, {
      comment: normalizedComment || undefined,
    });

    let emailResult = null;
    try {
      emailResult = await sendCourseIssueEmail(course, driver, normalizedComment);
    } catch (emailError) {
      console.error("Erreur lors de l'envoi de la notification de problème", emailError);
    }

    const updatedCourse = await db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
    const summary = buildCourseNotificationSummary(updatedCourse);
    const notification = buildCourseNotificationMessage('issue_reported', updatedCourse);

    res.json({ message: 'Problème signalé', email: emailResult });
    broadcastEvent('courses:changed', {
      action: 'issue_reported',
      courseId,
      driverId: course.driver_id,
      summary,
      notification,
    });
  } catch (error) {
    console.error('Error reporting course issue', error);
    res.status(500).json({ message: "Erreur lors du signalement du problème" });
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

    if (req.headers['x-admin-token']) {
      const sessionInfo = await enforceAdminSession(req, res);
      if (!sessionInfo) {
        return;
      }
    } else {
      const sessionInfo = await enforceDriverSession(req, res, {
        requireDriverId: course.driver_id,
      });
      if (!sessionInfo) {
        return;
      }
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

    const updatedCourse = await db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
    const summary = buildCourseNotificationSummary(updatedCourse);
    const notification = buildCourseNotificationMessage('completed', updatedCourse);

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
      summary,
      notification,
    });
  } catch (error) {
    console.error('Error completing course', error);
    res
      .status(500)
      .json({ message: error.message || 'Erreur lors de la validation de la course' });
  }
});

app.post('/api/courses/:id/reopen', async (req, res) => {
  try {
    const courseId = req.params.id;
    const { user } = req.body || {};

    const course = await db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({ message: 'Course introuvable' });
    }

    if (course.status !== COURSE_STATUS_COMPLETED) {
      return res.status(400).json({ message: 'Seules les courses validées peuvent être remises en attente.' });
    }

    if (course.photo_path) {
      try {
        await fs.promises.unlink(course.photo_path);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn(`Impossible de supprimer la photo ${course.photo_path}`, error.message);
        }
      }
    }

    const updatedAt = new Date().toISOString();
    await db.run(
      `UPDATE courses
          SET status = ?,
              completion_comments = NULL,
              photo_path = NULL,
              issue_reported_at = NULL,
              issue_report_comment = NULL,
              issue_reported_by = NULL,
              updated_at = ?
        WHERE id = ?`,
      [COURSE_STATUS_PENDING, updatedAt, courseId]
    );

    await logActivity(courseId, 'reopened', user || 'LS', 'Course réouverte');

    const updatedCourse = await db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
    const summary = buildCourseNotificationSummary(updatedCourse);
    const notification = buildCourseNotificationMessage('reopened', updatedCourse);

    res.json({ message: 'Course remise en attente' });
    broadcastEvent('courses:changed', {
      action: 'reopened',
      courseId: Number(courseId),
      driverId: course.driver_id,
      summary,
      notification,
    });
  } catch (error) {
    console.error('Error reopening course', error);
    res.status(500).json({ message: 'Erreur lors de la remise en attente de la course' });
  }
});

app.get('/api/messages/unread-count', async (req, res) => {
  try {
    if (!messagesDb) {
      throw new Error('Base de données des messages indisponible');
    }

    const role = (req.query.role || '').toLowerCase();

    if (role === 'admin') {
      const sessionInfo = await enforceAdminSession(req, res, {
        allowRoles: Array.from(ADMIN_ROLES),
      });
      if (!sessionInfo) {
        return;
      }

      const totalRow = await messagesDb.get(
        `SELECT COUNT(*) AS total FROM messages WHERE sender_type = 'driver' AND admin_read_at IS NULL`
      );
      const perDriverRows = await messagesDb.all(
        `SELECT driver_id AS driverId, COUNT(*) AS count
           FROM messages
          WHERE sender_type = 'driver' AND admin_read_at IS NULL
          GROUP BY driver_id`
      );

      res.json({
        total: totalRow?.total || 0,
        perDriver: perDriverRows || [],
      });
      return;
    }

    if (role === 'driver') {
      const driverId = Number.parseInt(req.query.driverId, 10);
      if (!Number.isInteger(driverId)) {
        return res.status(400).json({ message: 'Identifiant chauffeur invalide.' });
      }

      const sessionInfo = await enforceDriverSession(req, res, {
        requireDriverId: driverId,
      });
      if (!sessionInfo) {
        return;
      }

      const driver = await getDriverSummary(driverId);
      if (!driver) {
        return res.status(404).json({ message: 'Chauffeur introuvable.' });
      }

      const row = await messagesDb.get(
        `SELECT COUNT(*) AS total
           FROM messages
          WHERE driver_id = ? AND sender_type = 'admin' AND driver_read_at IS NULL`,
        [driverId]
      );

      res.json({ total: row?.total || 0 });
      return;
    }

    res.status(400).json({ message: 'Rôle invalide pour la récupération des messages.' });
  } catch (error) {
    console.error('Error fetching unread message count', error);
    res.status(500).json({ message: 'Erreur lors de la récupération du nombre de messages.' });
  }
});

app.get('/api/messages/inbox', async (req, res) => {
  try {
    if (!messagesDb) {
      throw new Error('Base de données des messages indisponible');
    }

    const sessionInfo = await enforceAdminSession(req, res, {
      allowRoles: Array.from(ADMIN_ROLES),
    });
    if (!sessionInfo) {
      return;
    }

    const rows = await messagesDb.all(
      `SELECT * FROM messages ORDER BY datetime(created_at) DESC LIMIT 500`
    );

    const threads = new Map();

    for (const row of rows) {
      const thread = threads.get(row.driver_id) || {
        driverId: row.driver_id,
        lastMessageAt: row.created_at,
        lastMessageBody: row.body,
        lastSenderType: row.sender_type,
        unreadFromDriver: 0,
      };

      if (!threads.has(row.driver_id)) {
        thread.lastMessageAt = row.created_at;
        thread.lastMessageBody = row.body;
        thread.lastSenderType = row.sender_type;
      }

      if (row.sender_type === 'driver' && !row.admin_read_at) {
        thread.unreadFromDriver += 1;
      }

      threads.set(row.driver_id, thread);
    }

    const driverIds = Array.from(threads.keys());
    const driverSummaries = await Promise.all(driverIds.map((id) => getDriverSummary(id)));

    const payload = driverIds.map((driverId, index) => {
      const summary = driverSummaries[index];
      const info = threads.get(driverId);
      return {
        driverId,
        driverName: summary
          ? `${summary.first_name || ''} ${summary.last_name || ''}`.trim() || 'Chauffeur'
          : 'Chauffeur',
        unreadFromDriver: info.unreadFromDriver,
        lastMessageAt: info.lastMessageAt,
        lastMessageBody: info.lastMessageBody,
        lastSenderType: info.lastSenderType,
      };
    });

    res.json(payload);
  } catch (error) {
    console.error('Error fetching message inbox', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des conversations.' });
  }
});

app.get('/api/messages/threads/:driverId', async (req, res) => {
  try {
    if (!messagesDb) {
      throw new Error('Base de données des messages indisponible');
    }

    const driverId = Number.parseInt(req.params.driverId, 10);
    if (!Number.isInteger(driverId)) {
      return res.status(400).json({ message: 'Identifiant chauffeur invalide.' });
    }

    const role = (req.query.role || '').toLowerCase();

    if (role === 'admin') {
      const sessionInfo = await enforceAdminSession(req, res, {
        allowRoles: Array.from(ADMIN_ROLES),
      });
      if (!sessionInfo) {
        return;
      }
    } else {
      const driverIdQuery = Number.parseInt(req.query.driverId || driverId, 10);
      if (driverIdQuery !== driverId) {
        return res.status(403).json({ message: 'Accès refusé.' });
      }

      const sessionInfo = await enforceDriverSession(req, res, { requireDriverId: driverId });
      if (!sessionInfo) {
        return;
      }
    }

    const driver = await getDriverSummary(driverId);
    if (!driver) {
      return res.status(404).json({ message: 'Chauffeur introuvable.' });
    }

    const rows = await messagesDb.all(
      `SELECT * FROM messages WHERE driver_id = ? ORDER BY datetime(created_at) ASC`,
      [driverId]
    );

    const messages = await Promise.all(rows.map((row) => serializeMessage(row)));

    const readerType = role === 'admin' ? 'admin' : 'driver';
    await markMessagesAsRead(driverId, readerType);

    broadcastEvent('messages:read', {
      driverId,
      readerType,
    });

    res.json({
      driver: {
        id: driver.id,
        firstName: driver.first_name,
        lastName: driver.last_name,
      },
      messages,
    });
  } catch (error) {
    console.error('Error fetching message thread', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de la conversation.' });
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    if (!messagesDb) {
      throw new Error('Base de données des messages indisponible');
    }

    const { driverId, body, senderType } = req.body || {};
    const normalizedBody = normalizeMessageBody(body);

    if (!driverId || !Number.isInteger(Number(driverId))) {
      return res.status(400).json({ message: 'Identifiant chauffeur manquant.' });
    }

    if (!normalizedBody) {
      return res.status(400).json({ message: 'Le message ne peut pas être vide.' });
    }

    const driver = await getDriverSummary(Number(driverId));
    if (!driver) {
      return res.status(404).json({ message: 'Chauffeur introuvable.' });
    }

    let senderId = null;
    const now = new Date().toISOString();
    let adminReadAt = null;
    let driverReadAt = null;

    if (senderType === 'admin') {
      const sessionInfo = await enforceAdminSession(req, res, {
        allowRoles: Array.from(ADMIN_ROLES),
      });
      if (!sessionInfo) {
        return;
      }
      senderId = sessionInfo.admin.id;
      adminReadAt = now;
    } else if (senderType === 'driver') {
      const sessionInfo = await enforceDriverSession(req, res, {
        requireDriverId: Number(driverId),
      });
      if (!sessionInfo) {
        return;
      }
      senderId = sessionInfo.driverId;
      driverReadAt = now;
    } else {
      return res.status(400).json({ message: "Type d'envoyeur invalide." });
    }

    const insertResult = await messagesDb.run(
      `INSERT INTO messages (driver_id, sender_type, sender_id, body, created_at, admin_read_at, driver_read_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [Number(driverId), senderType, senderId, normalizedBody, now, adminReadAt, driverReadAt]
    );

    const row = await messagesDb.get('SELECT * FROM messages WHERE id = ?', [insertResult.lastID]);
    const message = await serializeMessage(row);
    const notification = buildMessageNotificationPayload(senderType, message);

    broadcastEvent('messages:new', {
      driverId: Number(driverId),
      senderType,
      message,
      notification,
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('Error creating message', error);
    res.status(500).json({ message: "Erreur lors de l'envoi du message." });
  }
});

app.post('/api/messages/:driverId/read', async (req, res) => {
  try {
    if (!messagesDb) {
      throw new Error('Base de données des messages indisponible');
    }

    const driverId = Number.parseInt(req.params.driverId, 10);
    if (!Number.isInteger(driverId)) {
      return res.status(400).json({ message: 'Identifiant chauffeur invalide.' });
    }

    const { readerType } = req.body || {};
    if (!readerType || (readerType !== 'admin' && readerType !== 'driver')) {
      return res.status(400).json({ message: 'Type de lecteur invalide.' });
    }

    if (readerType === 'admin') {
      const sessionInfo = await enforceAdminSession(req, res, {
        allowRoles: Array.from(ADMIN_ROLES),
      });
      if (!sessionInfo) {
        return;
      }
    } else {
      const sessionInfo = await enforceDriverSession(req, res, { requireDriverId: driverId });
      if (!sessionInfo) {
        return;
      }
    }

    await markMessagesAsRead(driverId, readerType);

    broadcastEvent('messages:read', {
      driverId,
      readerType,
    });

    res.json({ message: 'Messages marqués comme lus.' });
  } catch (error) {
    console.error('Error marking messages as read', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour des messages.' });
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
