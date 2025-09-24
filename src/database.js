const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const STORAGE_DIR = path.join(__dirname, '..', 'storage');
const UPLOADS_DIR = path.join(__dirname, '..', 'public_html', 'uploads');
const DATABASE_FILE = path.join(STORAGE_DIR, 'agriholann.db');
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'admin';

let dbInstance = null;

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true, mode: 0o775 });
  }
}

function openDatabase() {
  ensureDirectory(STORAGE_DIR);
  ensureDirectory(UPLOADS_DIR);
  const db = new Database(DATABASE_FILE);
  db.pragma('foreign_keys = ON');
  return db;
}

function getDb() {
  if (!dbInstance) {
    dbInstance = openDatabase();
    initializeDatabase(dbInstance);
  }
  return dbInstance;
}

function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

function resetDatabase() {
  closeDb();
  if (fs.existsSync(DATABASE_FILE)) {
    fs.unlinkSync(DATABASE_FILE);
  }
  const db = getDb();
  initializeDatabase(db, { forceSeed: true });
}

function initializeDatabase(db, options = {}) {
  const { forceSeed = false } = options;

  db.exec(`
    CREATE TABLE IF NOT EXISTS drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT
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
      FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER,
      action TEXT NOT NULL,
      user TEXT NOT NULL,
      details TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER,
      to_address TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      attachment_path TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      identifier TEXT NOT NULL UNIQUE,
      initials TEXT NOT NULL,
      created_at TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );
  `);

  if (forceSeed) {
    seedDefaultData(db, { reset: true });
  } else {
    seedDefaultData(db);
  }
}

function seedDefaultData(db, { reset = false } = {}) {
  if (reset) {
    db.exec('DELETE FROM activity_log; DELETE FROM emails; DELETE FROM courses; DELETE FROM drivers; DELETE FROM admins;');
  }

  const driverCount = db.prepare('SELECT COUNT(*) as count FROM drivers').get().count;
  if (driverCount === 0) {
    const driverStmt = db.prepare('INSERT INTO drivers (first_name, last_name, email, phone) VALUES (?, ?, ?, NULL)');
    const drivers = [
      ['Jean', 'Dupont', 'jean.dupont@agriholann.com'],
      ['Pierre', 'Dupont', 'pierre.dupont@agriholann.com'],
      ['Marc', 'Martin', 'marc.martin@agriholann.com'],
      ['Luc', 'Bernard', 'luc.bernard@agriholann.com'],
      ['Thomas', 'Petit', 'thomas.petit@agriholann.com']
    ];
    drivers.forEach((driver) => driverStmt.run(driver));

    const nowIso = new Date().toISOString();
    const driverIds = {
      jean: db.prepare("SELECT id FROM drivers WHERE first_name = 'Jean' AND last_name = 'Dupont' LIMIT 1").get()?.id,
      pierre: db.prepare("SELECT id FROM drivers WHERE first_name = 'Pierre' AND last_name = 'Dupont' LIMIT 1").get()?.id,
      marc: db.prepare("SELECT id FROM drivers WHERE first_name = 'Marc' AND last_name = 'Martin' LIMIT 1").get()?.id
    };

    const courses = [
      {
        driver_id: driverIds.jean,
        date: new Date().setHours(10, 0, 0, 0),
        departure: 'Entrepôt Agri Holann',
        destination: 'Coopérative de Bléville',
        merchandise: 'Céréales',
        comments: 'Livraison urgente',
        status: 'pending',
        completion_comments: null
      },
      {
        driver_id: driverIds.jean,
        date: new Date().setHours(14, 30, 0, 0),
        departure: 'Coopérative de Bléville',
        destination: 'Minoterie du Nord',
        merchandise: 'Blé',
        comments: 'Contrôle qualité nécessaire',
        status: 'pending',
        completion_comments: null
      },
      {
        driver_id: driverIds.pierre,
        date: new Date(Date.now() + 24 * 60 * 60 * 1000).setHours(8, 0, 0, 0),
        departure: 'Entrepôt Agri Holann',
        destination: 'Marché de Provence',
        merchandise: 'Légumes',
        comments: null,
        status: 'pending',
        completion_comments: null
      },
      {
        driver_id: driverIds.marc,
        date: new Date(Date.now() - 24 * 60 * 60 * 1000).setHours(7, 30, 0, 0),
        departure: 'Ferme Bio du Sud',
        destination: 'Supermarché Eco',
        merchandise: 'Fruits',
        comments: 'Livraison matinale',
        status: 'completed',
        completion_comments: 'Livraison effectuée sans problème'
      }
    ];

    const insertCourse = db.prepare(`
      INSERT INTO courses (driver_id, date_time, departure, destination, merchandise, comments, status, completion_comments, created_at, updated_at)
      VALUES (@driver_id, @date_time, @departure, @destination, @merchandise, @comments, @status, @completion_comments, @created_at, @updated_at)
    `);

    const today = new Date();
    courses.forEach((course) => {
      const date = new Date(course.date);
      const isoDate = new Date(date).toISOString();
      insertCourse.run({
        driver_id: course.driver_id,
        date_time: isoDate,
        departure: course.departure,
        destination: course.destination,
        merchandise: course.merchandise,
        comments: course.comments,
        status: course.status,
        completion_comments: course.completion_comments,
        created_at: nowIso,
        updated_at: nowIso
      });
    });
  }

  const adminCount = db.prepare('SELECT COUNT(*) as count FROM admins').get().count;
  if (adminCount === 0) {
    createAdminAccount(db, 'Laurent', 'Saquet', DEFAULT_ADMIN_PASSWORD);
  }
}

function driverPayload(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email || null,
    phone: row.phone || null
  };
}

function adminPayload(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    identifier: row.identifier,
    initials: row.initials,
    createdAt: row.created_at || null
  };
}

function uploadsUrl(filename) {
  return filename ? `/uploads/${encodeURIComponent(filename)}` : null;
}

function coursePayload(row) {
  const driverName = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();
  return {
    id: row.id,
    driverId: row.driver_id,
    driverName: driverName || null,
    dateTime: row.date_time,
    departure: row.departure,
    destination: row.destination,
    merchandise: row.merchandise,
    comments: row.comments,
    status: row.status,
    photoUrl: uploadsUrl(row.photo_path),
    completionComments: row.completion_comments,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at
  };
}

function listCourses(db, query) {
  let sql = 'SELECT c.*, d.first_name, d.last_name FROM courses c LEFT JOIN drivers d ON d.id = c.driver_id WHERE 1 = 1';
  const params = {};

  if (query.driverId && !Number.isNaN(Number(query.driverId))) {
    sql += ' AND c.driver_id = @driverId';
    params.driverId = Number(query.driverId);
  }

  if (query.from) {
    sql += ' AND datetime(c.date_time) >= datetime(@from)';
    params.from = query.from;
  }

  if (query.to) {
    sql += ' AND datetime(c.date_time) <= datetime(@to)';
    params.to = query.to;
  }

  const archived = (query.archived || 'false').toLowerCase();
  if (archived === 'true' || archived === 'only') {
    sql += ' AND c.archived_at IS NOT NULL';
  } else if (archived === 'all') {
    // no filter
  } else {
    sql += ' AND c.archived_at IS NULL';
  }

  sql += ' ORDER BY datetime(c.date_time) ASC';

  const rows = db.prepare(sql).all(params);
  return rows.map(coursePayload);
}

function fetchCourse(db, courseId) {
  const row = db.prepare('SELECT c.*, d.first_name, d.last_name FROM courses c LEFT JOIN drivers d ON d.id = c.driver_id WHERE c.id = ?').get(courseId);
  if (!row) {
    const error = new Error('Course introuvable');
    error.status = 404;
    throw error;
  }
  return coursePayload(row);
}

function fetchCourseRow(db, courseId) {
  const row = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
  if (!row) {
    const error = new Error('Course introuvable');
    error.status = 404;
    throw error;
  }
  return row;
}

function normalizeActivityDetails(details) {
  if (details === undefined || details === null || details === '') {
    return null;
  }
  if (typeof details === 'string') {
    return details;
  }
  return JSON.stringify(details);
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

function logActivity(db, courseId, action, user, details = null) {
  const stmt = db.prepare(`
    INSERT INTO activity_log (course_id, action, user, details, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(courseId ?? null, action, user, normalizeActivityDetails(details), new Date().toISOString());
}

function mergeCreationAndCompletion(db, courseId, completionUser, completionDetails = null) {
  const entry = db.prepare(`
    SELECT id, user, details FROM activity_log
    WHERE course_id = ? AND action IN ('created', 'created_completed')
    ORDER BY id ASC LIMIT 1
  `).get(courseId);

  if (!entry) {
    logActivity(db, courseId, 'completed', completionUser, {
      completedBy: completionUser,
      details: completionDetails || undefined
    });
    return;
  }

  const metadata = parseActivityDetails(entry.details) || {};
  const createdBy = metadata.createdBy || entry.user || completionUser;
  const payload = {
    createdBy,
    completedBy: completionUser
  };
  if (completionDetails) {
    payload.details = completionDetails;
  }

  const displayUser = createdBy === completionUser ? completionUser : `${createdBy}/${completionUser}`;

  db.prepare('UPDATE activity_log SET action = ?, user = ?, details = ?, timestamp = ? WHERE id = ?').run(
    'created_completed',
    displayUser,
    JSON.stringify(payload),
    new Date().toISOString(),
    entry.id
  );
}

function recordEmail(db, courseId, to, subject, body, attachmentPath) {
  db.prepare(`
    INSERT INTO emails (course_id, to_address, subject, body, attachment_path, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(courseId ?? null, to, subject, body, attachmentPath ?? null, new Date().toISOString());
}

function handleCompletionEmail(db, course, driver, completionComments, photoFilename) {
  const to = 'laurent.saquet@agriholann.com';
  const subject = `[Livraison] ${driver.first_name} ${driver.last_name} - ${course.destination}`;
  const date = new Date(course.date_time).toLocaleString('fr-FR');
  const body = `Le chauffeur ${driver.first_name} ${driver.last_name} a effectué sa course du ${date}.\n\nCommentaires: ${completionComments || 'Aucun commentaire'}`;
  recordEmail(db, course.id, to, subject, body, photoFilename ?? null);
}

function savePhotoData(photoDataUrl, courseId) {
  if (!photoDataUrl || !photoDataUrl.startsWith('data:image')) {
    return null;
  }
  const [meta, base64] = photoDataUrl.split(',', 2);
  if (!base64) {
    return null;
  }
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) {
    return null;
  }
  ensureDirectory(UPLOADS_DIR);
  const filename = `course-${courseId}-${Date.now()}.jpg`;
  const filePath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  return filename;
}

function deletePhoto(filename) {
  if (!filename) return;
  const filePath = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function buildInitials(firstName, lastName) {
  const first = firstName ? firstName.trim().charAt(0) : '';
  const last = lastName ? lastName.trim().charAt(0) : '';
  const initials = `${first}${last}`.toUpperCase();
  return initials || 'LS';
}

function generateUniqueIdentifier(db, firstName, lastName) {
  const base = (firstName?.trim()[0] || '').toLowerCase() + (lastName || '').trim().replace(/\s+/g, '').toLowerCase();
  const sanitized = base || 'admin';
  let identifier = sanitized;
  let suffix = 1;
  const existsStmt = db.prepare('SELECT COUNT(*) as count FROM admins WHERE identifier = ?');
  while (existsStmt.get(identifier).count > 0) {
    identifier = `${sanitized}${suffix}`;
    suffix += 1;
  }
  return identifier;
}

function createAdminAccount(db, firstName, lastName, password) {
  const identifier = generateUniqueIdentifier(db, firstName, lastName);
  const initials = buildInitials(firstName, lastName);
  const createdAt = new Date().toISOString();
  const passwordHash = bcrypt.hashSync(password, 10);

  const stmt = db.prepare(`
    INSERT INTO admins (first_name, last_name, identifier, initials, created_at, password_hash)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(firstName, lastName, identifier, initials, createdAt, passwordHash);

  return {
    id: info.lastInsertRowid,
    firstName,
    lastName,
    identifier,
    initials,
    createdAt
  };
}

module.exports = {
  getDb,
  resetDatabase,
  initializeDatabase,
  driverPayload,
  adminPayload,
  coursePayload,
  listCourses,
  fetchCourse,
  fetchCourseRow,
  logActivity,
  mergeCreationAndCompletion,
  recordEmail,
  handleCompletionEmail,
  savePhotoData,
  deletePhoto,
  parseActivityDetails,
  createAdminAccount,
  buildInitials,
  generateUniqueIdentifier
};
