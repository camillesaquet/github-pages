const express = require('express');
const bcrypt = require('bcryptjs');
const {
  getDb,
  driverPayload,
  adminPayload,
  listCourses,
  fetchCourse,
  fetchCourseRow,
  logActivity,
  mergeCreationAndCompletion,
  handleCompletionEmail,
  savePhotoData,
  deletePhoto,
  parseActivityDetails,
  createAdminAccount
} = require('./database');

const router = express.Router();

function sendError(res, status, message) {
  res.status(status).json({ error: message });
}

router.get('/drivers', (req, res) => {
  const db = getDb();
  const search = (req.query.search || '').toString().trim().toLowerCase();
  let sql = 'SELECT * FROM drivers';
  const params = {};
  if (search) {
    sql += ' WHERE lower(first_name || " " || last_name) LIKE @search OR lower(last_name || " " || first_name) LIKE @search';
    params.search = `%${search}%`;
  }
  sql += ' ORDER BY last_name ASC, first_name ASC';
  const rows = db.prepare(sql).all(params);
  res.json(rows.map(driverPayload));
});

router.post('/drivers', (req, res) => {
  const db = getDb();
  const firstName = (req.body.firstName || '').toString().trim();
  const lastName = (req.body.lastName || '').toString().trim();
  const email = req.body.email ? req.body.email.toString().trim() : null;
  const phone = req.body.phone ? req.body.phone.toString().trim() : null;

  if (!firstName || !lastName) {
    return sendError(res, 422, 'Prénom et nom requis');
  }

  const stmt = db.prepare('INSERT INTO drivers (first_name, last_name, email, phone) VALUES (?, ?, ?, ?)');
  const info = stmt.run(firstName, lastName, email || null, phone || null);
  res.status(201).json(driverPayload({
    id: info.lastInsertRowid,
    first_name: firstName,
    last_name: lastName,
    email,
    phone
  }));
});

router.get('/drivers/:id', (req, res) => {
  const db = getDb();
  const driver = db.prepare('SELECT * FROM drivers WHERE id = ?').get(Number(req.params.id));
  if (!driver) {
    return sendError(res, 404, 'Chauffeur introuvable');
  }
  res.json(driverPayload(driver));
});

router.delete('/drivers/:id', (req, res) => {
  const db = getDb();
  const driverId = Number(req.params.id);
  const driver = db.prepare('SELECT * FROM drivers WHERE id = ?').get(driverId);
  if (!driver) {
    return sendError(res, 404, 'Chauffeur introuvable');
  }

  const photos = db.prepare('SELECT photo_path FROM courses WHERE driver_id = ? AND photo_path IS NOT NULL').all(driverId);
  photos.forEach((row) => deletePhoto(row.photo_path));

  db.prepare('DELETE FROM drivers WHERE id = ?').run(driverId);
  res.json({ message: 'Chauffeur supprimé' });
});

router.get('/admins', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT id, first_name, last_name, identifier, initials, created_at FROM admins ORDER BY created_at ASC').all();
  res.json(rows.map(adminPayload));
});

router.post('/admins', (req, res) => {
  const db = getDb();
  const firstName = (req.body.firstName || '').toString().trim();
  const lastName = (req.body.lastName || '').toString().trim();
  const password = (req.body.password || '').toString();

  if (!firstName || !lastName || !password) {
    return sendError(res, 422, 'Informations administrateur incomplètes');
  }

  try {
    const admin = createAdminAccount(db, firstName, lastName, password);
    res.status(201).json(admin);
  } catch (error) {
    sendError(res, 500, 'Impossible de créer le compte administrateur');
  }
});

router.post('/admins/login', (req, res) => {
  const db = getDb();
  const identifier = (req.body.identifier || '').toString().trim().toLowerCase();
  const password = (req.body.password || '').toString();

  if (!identifier || !password) {
    return sendError(res, 422, 'Identifiants requis');
  }

  const admin = db.prepare('SELECT * FROM admins WHERE identifier = ? LIMIT 1').get(identifier);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return sendError(res, 401, 'Identifiants invalides');
  }

  res.json(adminPayload(admin));
});

router.get('/courses', (req, res) => {
  const db = getDb();
  try {
    const courses = listCourses(db, req.query);
    res.json(courses);
  } catch (error) {
    sendError(res, 400, error.message || 'Requête invalide');
  }
});

router.post('/courses', (req, res) => {
  const db = getDb();
  const driverId = Number(req.body.driverId);
  const dateTime = req.body.dateTime ? new Date(req.body.dateTime) : null;
  const departure = (req.body.departure || '').toString().trim();
  const destination = (req.body.destination || '').toString().trim();
  const merchandise = req.body.merchandise ? req.body.merchandise.toString().trim() : null;
  const comments = req.body.comments ? req.body.comments.toString().trim() : null;
  const user = (req.body.user || 'LS').toString().trim() || 'LS';

  if (!driverId || !dateTime || Number.isNaN(dateTime.getTime()) || !departure || !destination) {
    return sendError(res, 422, 'Données de course incomplètes');
  }

  const isoDate = dateTime.toISOString();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO courses (driver_id, date_time, departure, destination, merchandise, comments, status, archived_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)
  `);
  const info = stmt.run(driverId, isoDate, departure, destination, merchandise || null, comments || null, now, now);

  const courseId = info.lastInsertRowid;
  logActivity(db, courseId, 'created', user, { createdBy: user });
  const course = fetchCourse(db, courseId);
  res.status(201).json(course);
});

router.get('/courses/:id', (req, res) => {
  const db = getDb();
  try {
    const course = fetchCourse(db, Number(req.params.id));
    res.json(course);
  } catch (error) {
    sendError(res, error.status || 400, error.message || 'Course introuvable');
  }
});

router.put('/courses/:id', (req, res) => {
  const db = getDb();
  const courseId = Number(req.params.id);
  let existing;
  try {
    existing = fetchCourseRow(db, courseId);
  } catch (error) {
    return sendError(res, error.status || 404, error.message);
  }

  const driverId = req.body.driverId ? Number(req.body.driverId) : existing.driver_id;
  let dateTime = existing.date_time;
  if (req.body.dateTime) {
    const parsed = new Date(req.body.dateTime);
    if (Number.isNaN(parsed.getTime())) {
      return sendError(res, 422, 'Date de course invalide');
    }
    dateTime = parsed.toISOString();
  }

  const departure = req.body.departure !== undefined ? req.body.departure.toString().trim() : existing.departure;
  const destination = req.body.destination !== undefined ? req.body.destination.toString().trim() : existing.destination;
  const merchandise = req.body.merchandise !== undefined ? req.body.merchandise.toString().trim() : existing.merchandise;
  const comments = req.body.comments !== undefined ? req.body.comments.toString().trim() : existing.comments;
  const status = req.body.status ? req.body.status.toString() : existing.status;
  const user = (req.body.user || 'LS').toString().trim() || 'LS';

  db.prepare(`
    UPDATE courses SET driver_id = ?, date_time = ?, departure = ?, destination = ?, merchandise = ?, comments = ?, status = ?, updated_at = ?
    WHERE id = ?
  `).run(
    driverId,
    dateTime,
    departure,
    destination,
    merchandise ? merchandise : null,
    comments ? comments : null,
    status,
    new Date().toISOString(),
    courseId
  );

  logActivity(db, courseId, 'modified', user, 'Course modifiée');
  const course = fetchCourse(db, courseId);
  res.json(course);
});

router.delete('/courses/:id', (req, res) => {
  const db = getDb();
  const courseId = Number(req.params.id);
  const user = (req.query.user || 'LS').toString().trim() || 'LS';
  let existing;
  try {
    existing = fetchCourseRow(db, courseId);
  } catch (error) {
    return sendError(res, error.status || 404, error.message);
  }

  if (existing.photo_path) {
    deletePhoto(existing.photo_path);
  }

  db.prepare('DELETE FROM courses WHERE id = ?').run(courseId);
  logActivity(db, courseId, 'deleted', user, 'Course supprimée');
  res.json({ message: 'Course supprimée' });
});

router.post('/courses/:id/archive', (req, res) => {
  const db = getDb();
  const courseId = Number(req.params.id);
  const user = (req.body.user || 'LS').toString().trim() || 'LS';

  try {
    fetchCourseRow(db, courseId);
  } catch (error) {
    return sendError(res, error.status || 404, error.message);
  }

  const timestamp = new Date().toISOString();
  db.prepare('UPDATE courses SET archived_at = ?, updated_at = ? WHERE id = ?').run(timestamp, timestamp, courseId);
  logActivity(db, courseId, 'archived', user, 'Course archivée');
  res.json({ message: 'Course archivée', archivedAt: timestamp });
});

router.post('/courses/:id/unarchive', (req, res) => {
  const db = getDb();
  const courseId = Number(req.params.id);
  const user = (req.body.user || 'LS').toString().trim() || 'LS';

  const existing = (() => {
    try {
      return fetchCourseRow(db, courseId);
    } catch (error) {
      return null;
    }
  })();

  if (!existing) {
    return sendError(res, 404, 'Course introuvable');
  }
  if (!existing.archived_at) {
    return sendError(res, 400, 'Course déjà active');
  }

  const timestamp = new Date().toISOString();
  db.prepare('UPDATE courses SET archived_at = NULL, updated_at = ? WHERE id = ?').run(timestamp, courseId);
  logActivity(db, courseId, 'restored', user, 'Course désarchivée');
  res.json({ message: 'Course restaurée' });
});

router.post('/courses/:id/complete', (req, res) => {
  const db = getDb();
  const courseId = Number(req.params.id);
  let existing;
  try {
    existing = fetchCourseRow(db, courseId);
  } catch (error) {
    return sendError(res, error.status || 404, error.message);
  }

  const comments = req.body.completionComments ? req.body.completionComments.toString().trim() : null;
  const photoDataUrl = req.body.photoDataUrl ? req.body.photoDataUrl.toString() : null;
  const userInitials = (req.body.userInitials || 'LS').toString().trim() || 'LS';

  const photoFilename = savePhotoData(photoDataUrl, courseId) || existing.photo_path;

  db.prepare(`
    UPDATE courses SET status = 'completed', completion_comments = ?, photo_path = ?, updated_at = ? WHERE id = ?
  `).run(comments ? comments : null, photoFilename, new Date().toISOString(), courseId);

  mergeCreationAndCompletion(db, courseId, userInitials, comments || null);

  const driver = db.prepare('SELECT * FROM drivers WHERE id = ? LIMIT 1').get(existing.driver_id) || {
    first_name: 'Chauffeur',
    last_name: 'Inconnu'
  };

  handleCompletionEmail(db, { ...existing, date_time: existing.date_time, destination: existing.destination, id: courseId }, driver, comments || null, photoFilename);

  res.json({ message: 'Course validée' });
});

router.get('/activity', (req, res) => {
  const db = getDb();
  const limit = Math.max(1, Number(req.query.limit) || 50);
  const rows = db.prepare(`
    SELECT a.*, c.departure, c.destination, c.date_time, c.archived_at, c.driver_id, d.first_name, d.last_name
    FROM activity_log a
    LEFT JOIN courses c ON c.id = a.course_id
    LEFT JOIN drivers d ON d.id = c.driver_id
    WHERE c.archived_at IS NULL OR c.id IS NULL
    ORDER BY a.timestamp DESC
    LIMIT ?
  `).all(limit);

  const activities = rows.map((row) => ({
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
          archivedAt: row.archived_at
        }
      : null
  }));

  res.json(activities);
});

router.get('/emails', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM emails ORDER BY created_at DESC LIMIT 20').all();
  res.json(rows);
});

module.exports = router;
