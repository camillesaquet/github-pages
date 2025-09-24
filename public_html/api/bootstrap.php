<?php

declare(strict_types=1);

if (!function_exists('str_starts_with')) {
    function str_starts_with(string $haystack, string $needle): bool
    {
        return $needle === '' || strncmp($haystack, $needle, strlen($needle)) === 0;
    }
}

const ADMIN_DEFAULT_PASSWORD = 'admin';

function project_root(): string
{
    return dirname(__DIR__, 2);
}

function storage_root(): string
{
    return project_root() . '/storage';
}

function uploads_directory(): string
{
    return dirname(__DIR__) . '/uploads';
}

function ensure_directory(string $path): void
{
    if (!is_dir($path)) {
        if (!mkdir($path, 0775, true) && !is_dir($path)) {
            throw new RuntimeException(sprintf('Impossible de créer le dossier : %s', $path));
        }
    }
}

function database_path(): string
{
    ensure_directory(storage_root());
    return storage_root() . '/agriholann.db';
}

function uploads_path(string $filename): string
{
    ensure_directory(uploads_directory());
    return uploads_directory() . '/' . $filename;
}

function uploads_url(string $filename): string
{
    return '/uploads/' . rawurlencode($filename);
}

function save_photo_data(?string $photoDataUrl, int $courseId): ?string
{
    if ($photoDataUrl === null || strpos($photoDataUrl, 'data:image') !== 0) {
        return null;
    }

    $parts = explode(',', $photoDataUrl, 2);
    if (count($parts) !== 2) {
        return null;
    }

    $binary = base64_decode($parts[1], true);
    if ($binary === false) {
        return null;
    }

    $filename = sprintf('course-%d-%s.jpg', $courseId, uniqid('', true));
    file_put_contents(uploads_path($filename), $binary);

    return $filename;
}

function get_database(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dbPath = database_path();
    $needsInit = !file_exists($dbPath);

    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA foreign_keys = ON');

    if ($needsInit) {
        initialize_database($pdo);
    } else {
        // Make sure schema upgrades run even if the database already exists.
        initialize_database($pdo);
    }

    return $pdo;
}

function initialize_database(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS drivers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT,
            phone TEXT
        )'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            driver_id INTEGER NOT NULL,
            date_time TEXT NOT NULL,
            departure TEXT NOT NULL,
            destination TEXT NOT NULL,
            merchandise TEXT,
            comments TEXT,
            status TEXT NOT NULL DEFAULT "pending",
            photo_path TEXT,
            completion_comments TEXT,
            archived_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(driver_id) REFERENCES drivers(id) ON DELETE CASCADE
        )'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER,
            action TEXT NOT NULL,
            user TEXT NOT NULL,
            details TEXT,
            timestamp TEXT NOT NULL,
            FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE SET NULL
        )'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS emails (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER,
            to_address TEXT NOT NULL,
            subject TEXT NOT NULL,
            body TEXT NOT NULL,
            attachment_path TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE SET NULL
        )'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            identifier TEXT NOT NULL UNIQUE,
            initials TEXT NOT NULL,
            created_at TEXT NOT NULL,
            password_hash TEXT NOT NULL
        )'
    );

    seed_default_data($pdo);
}

function seed_default_data(PDO $pdo): void
{
    $driverCount = (int) $pdo->query('SELECT COUNT(*) FROM drivers')->fetchColumn();
    if ($driverCount === 0) {
        $drivers = [
            ['Jean', 'Dupont', 'jean.dupont@agriholann.com'],
            ['Pierre', 'Dupont', 'pierre.dupont@agriholann.com'],
            ['Marc', 'Martin', 'marc.martin@agriholann.com'],
            ['Luc', 'Bernard', 'luc.bernard@agriholann.com'],
            ['Thomas', 'Petit', 'thomas.petit@agriholann.com'],
        ];

        $stmt = $pdo->prepare('INSERT INTO drivers (first_name, last_name, email, phone) VALUES (?, ?, ?, NULL)');
        foreach ($drivers as $driver) {
            $stmt->execute($driver);
        }

        $now = new DateTimeImmutable('now');
        $jeanId = (int) $pdo->query("SELECT id FROM drivers WHERE first_name = 'Jean' AND last_name = 'Dupont' LIMIT 1")->fetchColumn();
        $pierreId = (int) $pdo->query("SELECT id FROM drivers WHERE first_name = 'Pierre' AND last_name = 'Dupont' LIMIT 1")->fetchColumn();
        $marcId = (int) $pdo->query("SELECT id FROM drivers WHERE first_name = 'Marc' AND last_name = 'Martin' LIMIT 1")->fetchColumn();

        $courses = [
            [
                'driver_id' => $jeanId,
                'date' => (new DateTimeImmutable('today 10:00'))->format(DateTimeInterface::ATOM),
                'departure' => 'Entrepôt Agri Holann',
                'destination' => 'Coopérative de Bléville',
                'merchandise' => 'Céréales',
                'comments' => 'Livraison urgente',
                'status' => 'pending',
                'completion_comments' => null,
            ],
            [
                'driver_id' => $jeanId,
                'date' => (new DateTimeImmutable('today 14:30'))->format(DateTimeInterface::ATOM),
                'departure' => 'Coopérative de Bléville',
                'destination' => 'Minoterie du Nord',
                'merchandise' => 'Blé',
                'comments' => 'Contrôle qualité nécessaire',
                'status' => 'pending',
                'completion_comments' => null,
            ],
            [
                'driver_id' => $pierreId,
                'date' => (new DateTimeImmutable('tomorrow 08:00'))->format(DateTimeInterface::ATOM),
                'departure' => 'Entrepôt Agri Holann',
                'destination' => 'Marché de Provence',
                'merchandise' => 'Légumes',
                'comments' => null,
                'status' => 'pending',
                'completion_comments' => null,
            ],
            [
                'driver_id' => $marcId,
                'date' => (new DateTimeImmutable('yesterday 07:30'))->format(DateTimeInterface::ATOM),
                'departure' => 'Ferme Bio du Sud',
                'destination' => 'Supermarché Eco',
                'merchandise' => 'Fruits',
                'comments' => 'Livraison matinale',
                'status' => 'completed',
                'completion_comments' => 'Livraison effectuée sans problème',
            ],
        ];

        $stmtCourse = $pdo->prepare(
            'INSERT INTO courses (driver_id, date_time, departure, destination, merchandise, comments, status, completion_comments, created_at, updated_at)
             VALUES (:driver_id, :date_time, :departure, :destination, :merchandise, :comments, :status, :completion_comments, :created_at, :updated_at)'
        );

        foreach ($courses as $course) {
            $createdAt = $now->format(DateTimeInterface::ATOM);
            $stmtCourse->execute([
                ':driver_id' => $course['driver_id'],
                ':date_time' => $course['date'],
                ':departure' => $course['departure'],
                ':destination' => $course['destination'],
                ':merchandise' => $course['merchandise'],
                ':comments' => $course['comments'],
                ':status' => $course['status'],
                ':completion_comments' => $course['completion_comments'],
                ':created_at' => $createdAt,
                ':updated_at' => $createdAt,
            ]);
        }
    }

    $adminCount = (int) $pdo->query('SELECT COUNT(*) FROM admins')->fetchColumn();
    if ($adminCount === 0) {
        create_admin_account($pdo, 'Laurent', 'Saquet', ADMIN_DEFAULT_PASSWORD);
    }
}

function create_admin_account(PDO $pdo, string $firstName, string $lastName, string $password): array
{
    $identifier = generate_unique_identifier($pdo, $firstName, $lastName);
    $initials = build_initials($firstName, $lastName);
    $createdAt = (new DateTimeImmutable('now'))->format(DateTimeInterface::ATOM);
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    $stmt = $pdo->prepare(
        'INSERT INTO admins (first_name, last_name, identifier, initials, created_at, password_hash)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$firstName, $lastName, $identifier, $initials, $createdAt, $passwordHash]);

    $id = (int) $pdo->lastInsertId();

    return [
        'id' => $id,
        'firstName' => $firstName,
        'lastName' => $lastName,
        'identifier' => $identifier,
        'initials' => $initials,
        'createdAt' => $createdAt,
    ];
}

function generate_unique_identifier(PDO $pdo, string $firstName, string $lastName): string
{
    $base = strtolower(substr(trim($firstName), 0, 1) . preg_replace('/\s+/', '', trim($lastName)));
    if ($base === '') {
        $base = 'admin';
    }

    $identifier = $base;
    $suffix = 1;
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM admins WHERE identifier = ?');
    while (true) {
        $stmt->execute([$identifier]);
        $count = (int) $stmt->fetchColumn();
        if ($count === 0) {
            return $identifier;
        }
        $identifier = $base . $suffix;
        $suffix++;
    }
}

function build_initials(string $firstName, string $lastName): string
{
    $first = $firstName !== '' ? mb_substr($firstName, 0, 1) : '';
    $last = $lastName !== '' ? mb_substr($lastName, 0, 1) : '';
    $initials = strtoupper($first . $last);
    return $initials !== '' ? $initials : 'LS';
}

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload);
    exit;
}

function respond_error(string $message, int $status = 400): void
{
    respond(['error' => $message], $status);
}

function read_json_input(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $data = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
        respond_error('Requête JSON invalide', 400);
    }

    return $data;
}

function normalize_activity_details($details): ?string
{
    if ($details === null || $details === '') {
        return null;
    }

    if (is_array($details)) {
        return json_encode($details, JSON_UNESCAPED_UNICODE);
    }

    if (is_string($details)) {
        return $details;
    }

    return json_encode($details, JSON_UNESCAPED_UNICODE);
}

function parse_activity_details(?string $details): ?array
{
    if ($details === null || $details === '') {
        return null;
    }

    $decoded = json_decode($details, true);
    if (json_last_error() === JSON_ERROR_NONE) {
        return $decoded;
    }

    return null;
}

function log_activity(PDO $pdo, ?int $courseId, string $action, string $user, $details = null): void
{
    $timestamp = (new DateTimeImmutable('now'))->format(DateTimeInterface::ATOM);
    $stmt = $pdo->prepare(
        'INSERT INTO activity_log (course_id, action, user, details, timestamp)
         VALUES (?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $courseId,
        $action,
        $user,
        normalize_activity_details($details),
        $timestamp,
    ]);
}

function merge_creation_and_completion(PDO $pdo, int $courseId, string $completionUser, ?string $completionDetails = null): void
{
    $stmt = $pdo->prepare(
        "SELECT id, user, details FROM activity_log WHERE course_id = ? AND action IN ('created', 'created_completed') ORDER BY id ASC LIMIT 1"
    );
    $stmt->execute([$courseId]);
    $entry = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($entry === false) {
        log_activity($pdo, $courseId, 'completed', $completionUser, [
            'completedBy' => $completionUser,
            'details' => $completionDetails,
        ]);
        return;
    }

    $metadata = parse_activity_details($entry['details'] ?? null) ?? [];
    $createdBy = $metadata['createdBy'] ?? ($entry['user'] ?? $completionUser);

    $payload = [
        'createdBy' => $createdBy,
        'completedBy' => $completionUser,
    ];
    if ($completionDetails) {
        $payload['details'] = $completionDetails;
    }

    $displayUser = $createdBy === $completionUser ? $completionUser : $createdBy . '/' . $completionUser;

    $update = $pdo->prepare('UPDATE activity_log SET action = ?, user = ?, details = ?, timestamp = ? WHERE id = ?');
    $update->execute([
        'created_completed',
        $displayUser,
        json_encode($payload, JSON_UNESCAPED_UNICODE),
        (new DateTimeImmutable('now'))->format(DateTimeInterface::ATOM),
        $entry['id'],
    ]);
}

function record_email(PDO $pdo, int $courseId, string $to, string $subject, string $body, ?string $attachmentPath): void
{
    $stmt = $pdo->prepare(
        'INSERT INTO emails (course_id, to_address, subject, body, attachment_path, created_at)
         VALUES (?, ?, ?, ?, ?, ?)' );
    $stmt->execute([
        $courseId,
        $to,
        $subject,
        $body,
        $attachmentPath,
        (new DateTimeImmutable('now'))->format(DateTimeInterface::ATOM),
    ]);
}

function handle_completion_email(PDO $pdo, array $course, array $driver, ?string $completionComments, ?string $photoFilename): void
{
    $to = 'laurent.saquet@agriholann.com';
    $subject = sprintf('[Livraison] %s %s - %s', $driver['first_name'], $driver['last_name'], $course['destination']);
    $date = (new DateTimeImmutable($course['date_time']))->format('d/m/Y H:i');
    $body = sprintf(
        "Le chauffeur %s %s a effectué sa course du %s.\n\nCommentaires: %s",
        $driver['first_name'],
        $driver['last_name'],
        $date,
        $completionComments !== null && $completionComments !== '' ? $completionComments : 'Aucun commentaire'
    );

    record_email($pdo, (int) $course['id'], $to, $subject, $body, $photoFilename);
}
