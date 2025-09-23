const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db', 'agriholann.db');
const ATTACHMENTS_DIR = path.join(__dirname, 'storage', 'attachments');

async function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

let db;

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
  `);

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

      if (course.status === 'completed') {
        await logActivity(result.lastID, 'completed', 'LS', 'Course importée comme terminée');
      } else {
        await logActivity(result.lastID, 'created', 'LS', 'Course importée');
      }
    }
  }
}

async function logActivity(courseId, action, user, details = null) {
  const timestamp = new Date().toISOString();
  await db.run(
    'INSERT INTO activity_log (course_id, action, user, details, timestamp) VALUES (?, ?, ?, ?, ?)',
    [courseId, action, user, details, timestamp]
  );
}

const emailTransport = nodemailer.createTransport({
  streamTransport: true,
  newline: 'unix',
  buffer: true,
});

async function recordEmail(courseId, to, subject, body, attachmentBuffer, attachmentName = 'bon-transport.jpg') {
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
  const to = 'laurent.saquet@agriholann.com';
  const subject = `[Livraison] ${driver.first_name} ${driver.last_name} - ${course.destination}`;
  const body = `Le chauffeur ${driver.first_name} ${driver.last_name} a effectué sa course du ${new Date(
    course.date_time
  ).toLocaleString('fr-FR')}\n\nCommentaires: ${completionComments || 'Aucun commentaire'}`;

  let attachmentBuffer = null;
  if (photoDataUrl && photoDataUrl.startsWith('data:image')) {
    const base64Data = photoDataUrl.split(',')[1];
    attachmentBuffer = Buffer.from(base64Data, 'base64');
  }

  await recordEmail(course.id, to, subject, body, attachmentBuffer);

  await emailTransport.sendMail({
    from: 'no-reply@agriholann.com',
    to,
    subject,
    text: body,
    attachments: attachmentBuffer
      ? [
          {
            filename: 'bon-transport.jpg',
            content: attachmentBuffer,
          },
        ]
      : [],
  });

  return { to, subject, body };
}

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

app.get('/api/drivers', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT id, first_name, last_name, email, phone FROM drivers';
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

app.get('/api/drivers/:id', async (req, res) => {
  try {
    const driver = await db.get('SELECT id, first_name, last_name, email, phone FROM drivers WHERE id = ?', [
      req.params.id,
    ]);

    if (!driver) {
      return res.status(404).json({ message: 'Chauffeur introuvable' });
    }

    res.json(driver);
  } catch (error) {
    console.error('Error fetching driver', error);
    res.status(500).json({ message: 'Erreur lors de la récupération du chauffeur' });
  }
});

app.get('/api/courses', async (req, res) => {
  try {
    const { driverId, from, to } = req.query;
    const conditions = [];
    const params = [];

    if (driverId) {
      conditions.push('driver_id = ?');
      params.push(driverId);
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
      JOIN drivers d ON d.id = c.driver_id`;

    if (conditions.length) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY date_time ASC';

    const rows = await db.all(query, params);
    res.json(
      rows.map((row) => ({
        id: row.id,
        driverId: row.driver_id,
        driverName: `${row.first_name} ${row.last_name}`,
        dateTime: row.date_time,
        departure: row.departure,
        destination: row.destination,
        merchandise: row.merchandise,
        comments: row.comments,
        status: row.status,
        photoUrl: row.photo_path ? `/storage/attachments/${path.basename(row.photo_path)}` : null,
        completionComments: row.completion_comments,
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
       JOIN drivers d ON d.id = c.driver_id
       WHERE c.id = ?`,
      [req.params.id]
    );

    if (!row) {
      return res.status(404).json({ message: 'Course introuvable' });
    }

    res.json({
      id: row.id,
      driverId: row.driver_id,
      driverName: `${row.first_name} ${row.last_name}`,
      dateTime: row.date_time,
      departure: row.departure,
      destination: row.destination,
      merchandise: row.merchandise,
      comments: row.comments,
      status: row.status,
      photoUrl: row.photo_path ? `/storage/attachments/${path.basename(row.photo_path)}` : null,
      completionComments: row.completion_comments,
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
        (driver_id, date_time, departure, destination, merchandise, comments, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [driverId, new Date(dateTime).toISOString(), departure, destination, merchandise || null, comments || null, now, now]
    );

    const course = await db.get('SELECT * FROM courses WHERE id = ?', [result.lastID]);

    await logActivity(course.id, 'created', user || 'LS', 'Course créée');

    res.status(201).json(course);
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

    await db.run('DELETE FROM courses WHERE id = ?', [courseId]);
    await logActivity(courseId, 'deleted', user || 'LS', 'Course supprimée');

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting course', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de la course' });
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

    await logActivity(courseId, 'completed', userInitials || 'LS', 'Course terminée');

    const completionEmail = await sendCompletionEmail(
      { ...course, photo_path: photoPath },
      driver,
      completionComments,
      photoDataUrl
    );

    res.json({ message: 'Course complétée', email: completionEmail });
  } catch (error) {
    console.error('Error completing course', error);
    res.status(500).json({ message: 'Erreur lors de la validation de la course' });
  }
});

app.get('/api/activity', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const rows = await db.all(
      `SELECT a.*, c.departure, c.destination, c.date_time, d.first_name, d.last_name
       FROM activity_log a
       LEFT JOIN courses c ON c.id = a.course_id
       LEFT JOIN drivers d ON d.id = c.driver_id
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
        course: row.course_id
          ? {
              id: row.course_id,
              departure: row.departure,
              destination: row.destination,
              dateTime: row.date_time,
              driverName: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : null,
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
