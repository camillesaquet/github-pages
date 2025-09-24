<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$pdo = get_database();

$uriPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '';
$basePath = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
if ($basePath !== '' && str_starts_with($uriPath, $basePath)) {
    $uriPath = substr($uriPath, strlen($basePath));
}
$path = trim($uriPath, '/');

if ($path === '') {
    respond_error('Endpoint introuvable', 404);
}

$segments = explode('/', $path);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

switch ($segments[0]) {
    case 'drivers':
        handle_drivers($pdo, $segments, $method);
        break;
    case 'admins':
        handle_admins($pdo, $segments, $method);
        break;
    case 'courses':
        handle_courses($pdo, $segments, $method);
        break;
    case 'activity':
        handle_activity($pdo, $_GET);
        break;
    case 'emails':
        handle_emails($pdo);
        break;
    default:
        respond_error('Endpoint introuvable', 404);
}

function handle_drivers(PDO $pdo, array $segments, string $method): void
{
    if (count($segments) === 1) {
        if ($method === 'GET') {
            $search = isset($_GET['search']) ? trim((string) $_GET['search']) : '';
            $query = 'SELECT * FROM drivers';
            $params = [];
            if ($search !== '') {
                $query .= ' WHERE lower(first_name || " " || last_name) LIKE :search OR lower(last_name || " " || first_name) LIKE :search';
                $params[':search'] = '%' . strtolower($search) . '%';
            }
            $query .= ' ORDER BY last_name ASC, first_name ASC';
            $stmt = $pdo->prepare($query);
            $stmt->execute($params);
            $drivers = array_map('driver_payload', $stmt->fetchAll(PDO::FETCH_ASSOC));
            respond($drivers);
        }

        if ($method === 'POST') {
            $data = read_json_input();
            $firstName = trim((string) ($data['firstName'] ?? ''));
            $lastName = trim((string) ($data['lastName'] ?? ''));
            $email = isset($data['email']) ? trim((string) $data['email']) : null;
            $phone = isset($data['phone']) ? trim((string) $data['phone']) : null;

            if ($firstName === '' || $lastName === '') {
                respond_error('Prénom et nom requis', 422);
            }

            $stmt = $pdo->prepare('INSERT INTO drivers (first_name, last_name, email, phone) VALUES (?, ?, ?, ?)');
            $stmt->execute([$firstName, $lastName, $email ?: null, $phone ?: null]);
            $id = (int) $pdo->lastInsertId();

            respond(driver_payload([
                'id' => $id,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $email,
                'phone' => $phone,
            ]), 201);
        }

        respond_error('Méthode non autorisée', 405);
    }

    if (count($segments) === 2 && is_numeric($segments[1])) {
        $driverId = (int) $segments[1];

        if ($method === 'GET') {
            $stmt = $pdo->prepare('SELECT * FROM drivers WHERE id = ?');
            $stmt->execute([$driverId]);
            $driver = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($driver === false) {
                respond_error('Chauffeur introuvable', 404);
            }
            respond(driver_payload($driver));
        }

        if ($method === 'DELETE') {
            $exists = $pdo->prepare('SELECT id FROM drivers WHERE id = ? LIMIT 1');
            $exists->execute([$driverId]);
            if ($exists->fetchColumn() === false) {
                respond_error('Chauffeur introuvable', 404);
            }

            $stmt = $pdo->prepare('SELECT photo_path FROM courses WHERE driver_id = ? AND photo_path IS NOT NULL');
            $stmt->execute([$driverId]);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $course) {
                if (!empty($course['photo_path'])) {
                    $file = uploads_path($course['photo_path']);
                    if (is_file($file)) {
                        @unlink($file);
                    }
                }
            }

            $delete = $pdo->prepare('DELETE FROM drivers WHERE id = ?');
            $delete->execute([$driverId]);
            respond(['message' => 'Chauffeur supprimé']);
        }

        respond_error('Méthode non autorisée', 405);
    }

    respond_error('Endpoint introuvable', 404);
}

function handle_admins(PDO $pdo, array $segments, string $method): void
{
    if (count($segments) === 1) {
        if ($method === 'GET') {
            $rows = $pdo->query('SELECT id, first_name, last_name, identifier, initials, created_at FROM admins ORDER BY created_at ASC')->fetchAll(PDO::FETCH_ASSOC);
            $admins = array_map('admin_payload', $rows);
            respond($admins);
        }

        if ($method === 'POST') {
            $data = read_json_input();
            $firstName = trim((string) ($data['firstName'] ?? ''));
            $lastName = trim((string) ($data['lastName'] ?? ''));
            $password = (string) ($data['password'] ?? '');

            if ($firstName === '' || $lastName === '' || $password === '') {
                respond_error('Informations administrateur incomplètes', 422);
            }

            $admin = create_admin_account($pdo, $firstName, $lastName, $password);
            respond($admin, 201);
        }

        respond_error('Méthode non autorisée', 405);
    }

    if (count($segments) === 2 && $segments[1] === 'login') {
        if ($method !== 'POST') {
            respond_error('Méthode non autorisée', 405);
        }

        $data = read_json_input();
        $identifier = strtolower(trim((string) ($data['identifier'] ?? '')));
        $password = (string) ($data['password'] ?? '');

        if ($identifier === '' || $password === '') {
            respond_error('Identifiants requis', 422);
        }

        $stmt = $pdo->prepare('SELECT * FROM admins WHERE identifier = ? LIMIT 1');
        $stmt->execute([$identifier]);
        $admin = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($admin === false || !password_verify($password, $admin['password_hash'])) {
            respond_error('Identifiants invalides', 401);
        }

        respond(admin_payload($admin));
    }

    respond_error('Endpoint introuvable', 404);
}

function handle_courses(PDO $pdo, array $segments, string $method): void
{
    if (count($segments) === 1) {
        if ($method === 'GET') {
            respond(list_courses($pdo, $_GET));
        }

        if ($method === 'POST') {
            $data = read_json_input();
            $driverId = (int) ($data['driverId'] ?? 0);
            $dateTime = (string) ($data['dateTime'] ?? '');
            $departure = trim((string) ($data['departure'] ?? ''));
            $destination = trim((string) ($data['destination'] ?? ''));
            $merchandise = isset($data['merchandise']) ? trim((string) $data['merchandise']) : null;
            $comments = isset($data['comments']) ? trim((string) $data['comments']) : null;
            $user = trim((string) ($data['user'] ?? 'LS')) ?: 'LS';

            if ($driverId <= 0 || $dateTime === '' || $departure === '' || $destination === '') {
                respond_error('Données de course incomplètes', 422);
            }

            try {
                $isoDate = (new DateTimeImmutable($dateTime))->format(DateTimeInterface::ATOM);
            } catch (Exception $exception) {
                respond_error('Date de course invalide', 422);
            }
            $now = (new DateTimeImmutable('now'))->format(DateTimeInterface::ATOM);

            $stmt = $pdo->prepare(
                'INSERT INTO courses (driver_id, date_time, departure, destination, merchandise, comments, status, archived_at, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, "pending", NULL, ?, ?)'
            );
            $stmt->execute([
                $driverId,
                $isoDate,
                $departure,
                $destination,
                $merchandise ?: null,
                $comments ?: null,
                $now,
                $now,
            ]);

            $courseId = (int) $pdo->lastInsertId();
            log_activity($pdo, $courseId, 'created', $user, ['createdBy' => $user]);
            respond(course_payload(fetch_course($pdo, $courseId)), 201);
        }

        respond_error('Méthode non autorisée', 405);
    }

    if (count($segments) >= 2 && is_numeric($segments[1])) {
        $courseId = (int) $segments[1];

        if (count($segments) === 2) {
            if ($method === 'GET') {
                respond(course_payload(fetch_course($pdo, $courseId)));
            }

            if ($method === 'PUT') {
                $existing = fetch_course_row($pdo, $courseId);
                $data = read_json_input();

                $driverId = isset($data['driverId']) ? (int) $data['driverId'] : (int) $existing['driver_id'];
                if (isset($data['dateTime'])) {
                    try {
                        $dateTime = (new DateTimeImmutable((string) $data['dateTime']))->format(DateTimeInterface::ATOM);
                    } catch (Exception $exception) {
                        respond_error('Date de course invalide', 422);
                    }
                } else {
                    $dateTime = $existing['date_time'];
                }
                $departure = isset($data['departure']) ? trim((string) $data['departure']) : $existing['departure'];
                $destination = isset($data['destination']) ? trim((string) $data['destination']) : $existing['destination'];
                $merchandise = array_key_exists('merchandise', $data) ? trim((string) $data['merchandise']) : $existing['merchandise'];
                $comments = array_key_exists('comments', $data) ? trim((string) $data['comments']) : $existing['comments'];
                $status = isset($data['status']) ? (string) $data['status'] : $existing['status'];
                $user = trim((string) ($data['user'] ?? 'LS')) ?: 'LS';

                $stmt = $pdo->prepare(
                    'UPDATE courses SET driver_id = ?, date_time = ?, departure = ?, destination = ?, merchandise = ?, comments = ?, status = ?, updated_at = ? WHERE id = ?'
                );
                $stmt->execute([
                    $driverId,
                    $dateTime,
                    $departure,
                    $destination,
                    $merchandise !== '' ? $merchandise : null,
                    $comments !== '' ? $comments : null,
                    $status,
                    (new DateTimeImmutable('now'))->format(DateTimeInterface::ATOM),
                    $courseId,
                ]);

                log_activity($pdo, $courseId, 'modified', $user, 'Course modifiée');
                respond(course_payload(fetch_course($pdo, $courseId)));
            }

            if ($method === 'DELETE') {
                $existing = fetch_course_row($pdo, $courseId);
                $user = isset($_GET['user']) ? trim((string) $_GET['user']) : 'LS';

                if (!empty($existing['photo_path'])) {
                    $file = uploads_path($existing['photo_path']);
                    if (is_file($file)) {
                        @unlink($file);
                    }
                }

                $stmt = $pdo->prepare('DELETE FROM courses WHERE id = ?');
                $stmt->execute([$courseId]);
                log_activity($pdo, $courseId, 'deleted', $user ?: 'LS', 'Course supprimée');
                respond(['message' => 'Course supprimée']);
            }
        }

        if (count($segments) === 3) {
            if ($segments[2] === 'archive' && $method === 'POST') {
                $existing = fetch_course_row($pdo, $courseId);
                $data = read_json_input();
                $user = trim((string) ($data['user'] ?? 'LS')) ?: 'LS';
                $stmt = $pdo->prepare('UPDATE courses SET archived_at = ?, updated_at = ? WHERE id = ?');
                $timestamp = (new DateTimeImmutable('now'))->format(DateTimeInterface::ATOM);
                $stmt->execute([$timestamp, $timestamp, $courseId]);
                log_activity($pdo, $courseId, 'archived', $user, 'Course archivée');
                respond(['message' => 'Course archivée', 'archivedAt' => $timestamp]);
            }

            if ($segments[2] === 'unarchive' && $method === 'POST') {
                $existing = fetch_course_row($pdo, $courseId);
                if (empty($existing['archived_at'])) {
                    respond_error('Course déjà active', 400);
                }
                $data = read_json_input();
                $user = trim((string) ($data['user'] ?? 'LS')) ?: 'LS';
                $stmt = $pdo->prepare('UPDATE courses SET archived_at = NULL, updated_at = ? WHERE id = ?');
                $timestamp = (new DateTimeImmutable('now'))->format(DateTimeInterface::ATOM);
                $stmt->execute([$timestamp, $courseId]);
                log_activity($pdo, $courseId, 'restored', $user, 'Course désarchivée');
                respond(['message' => 'Course restaurée']);
            }

            if ($segments[2] === 'complete' && $method === 'POST') {
                $existing = fetch_course_row($pdo, $courseId);
                $data = read_json_input();
                $comments = isset($data['completionComments']) ? trim((string) $data['completionComments']) : null;
                $photoDataUrl = isset($data['photoDataUrl']) ? (string) $data['photoDataUrl'] : null;
                $user = trim((string) ($data['userInitials'] ?? 'LS')) ?: 'LS';

                $photoFilename = save_photo_data($photoDataUrl, $courseId) ?: $existing['photo_path'];

                $stmt = $pdo->prepare('UPDATE courses SET status = "completed", completion_comments = ?, photo_path = ?, updated_at = ? WHERE id = ?');
                $stmt->execute([
                    $comments !== '' ? $comments : null,
                    $photoFilename,
                    (new DateTimeImmutable('now'))->format(DateTimeInterface::ATOM),
                    $courseId,
                ]);

                merge_creation_and_completion($pdo, $courseId, $user, $comments !== '' ? $comments : null);

                $driverStmt = $pdo->prepare('SELECT * FROM drivers WHERE id = ? LIMIT 1');
                $driverStmt->execute([$existing['driver_id']]);
                $driver = $driverStmt->fetch(PDO::FETCH_ASSOC) ?: ['first_name' => 'Chauffeur', 'last_name' => 'Inconnu'];

                handle_completion_email($pdo, $existing, $driver, $comments !== '' ? $comments : null, $photoFilename);

                respond(['message' => 'Course validée']);
            }
        }
    }

    respond_error('Endpoint introuvable', 404);
}

function handle_activity(PDO $pdo, array $query): void
{
    $limit = isset($query['limit']) ? max(1, (int) $query['limit']) : 50;
    $stmt = $pdo->prepare(
        'SELECT a.*, c.departure, c.destination, c.date_time, c.archived_at, c.driver_id, d.first_name, d.last_name
         FROM activity_log a
         LEFT JOIN courses c ON c.id = a.course_id
         LEFT JOIN drivers d ON d.id = c.driver_id
         WHERE c.archived_at IS NULL OR c.id IS NULL
         ORDER BY a.timestamp DESC
         LIMIT ?'
    );
    $stmt->execute([$limit]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $activities = array_map(static function (array $row) {
        return [
            'id' => (int) $row['id'],
            'action' => $row['action'],
            'user' => $row['user'],
            'details' => $row['details'],
            'timestamp' => $row['timestamp'],
            'metadata' => parse_activity_details($row['details'] ?? null),
            'course' => $row['course_id'] ? [
                'id' => (int) $row['course_id'],
                'departure' => $row['departure'],
                'destination' => $row['destination'],
                'dateTime' => $row['date_time'],
                'driverName' => $row['first_name'] && $row['last_name'] ? $row['first_name'] . ' ' . $row['last_name'] : null,
                'archivedAt' => $row['archived_at'],
            ] : null,
        ];
    }, $rows);

    respond($activities);
}

function handle_emails(PDO $pdo): void
{
    $rows = $pdo->query('SELECT * FROM emails ORDER BY created_at DESC LIMIT 20')->fetchAll(PDO::FETCH_ASSOC);
    respond($rows);
}

function driver_payload(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'firstName' => $row['first_name'],
        'lastName' => $row['last_name'],
        'email' => $row['email'] ?? null,
        'phone' => $row['phone'] ?? null,
    ];
}

function admin_payload(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'firstName' => $row['first_name'],
        'lastName' => $row['last_name'],
        'identifier' => $row['identifier'],
        'initials' => $row['initials'],
        'createdAt' => $row['created_at'] ?? null,
    ];
}

function list_courses(PDO $pdo, array $query): array
{
    $sql = 'SELECT c.*, d.first_name, d.last_name FROM courses c LEFT JOIN drivers d ON d.id = c.driver_id WHERE 1 = 1';
    $params = [];

    if (isset($query['driverId']) && is_numeric($query['driverId'])) {
        $sql .= ' AND c.driver_id = :driverId';
        $params[':driverId'] = (int) $query['driverId'];
    }

    if (!empty($query['from'])) {
        $sql .= ' AND datetime(c.date_time) >= datetime(:from)';
        $params[':from'] = (string) $query['from'];
    }

    if (!empty($query['to'])) {
        $sql .= ' AND datetime(c.date_time) <= datetime(:to)';
        $params[':to'] = (string) $query['to'];
    }

    $archived = isset($query['archived']) ? strtolower((string) $query['archived']) : 'false';
    if ($archived === 'true' || $archived === 'only') {
        $sql .= ' AND c.archived_at IS NOT NULL';
    } elseif ($archived === 'all') {
        // no filter
    } else {
        $sql .= ' AND c.archived_at IS NULL';
    }

    $sql .= ' ORDER BY datetime(c.date_time) ASC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    return array_map('course_payload', $rows);
}

function fetch_course(PDO $pdo, int $courseId): array
{
    $stmt = $pdo->prepare('SELECT c.*, d.first_name, d.last_name FROM courses c LEFT JOIN drivers d ON d.id = c.driver_id WHERE c.id = ?');
    $stmt->execute([$courseId]);
    $course = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($course === false) {
        respond_error('Course introuvable', 404);
    }
    return course_payload($course);
}

function fetch_course_row(PDO $pdo, int $courseId): array
{
    $stmt = $pdo->prepare('SELECT * FROM courses WHERE id = ?');
    $stmt->execute([$courseId]);
    $course = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($course === false) {
        respond_error('Course introuvable', 404);
    }
    return $course;
}

function course_payload(array $row): array
{
    $driverName = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
    $photoUrl = null;
    if (!empty($row['photo_path'])) {
        $photoUrl = uploads_url($row['photo_path']);
    }

    return [
        'id' => (int) $row['id'],
        'driverId' => (int) $row['driver_id'],
        'driverName' => $driverName !== '' ? $driverName : null,
        'dateTime' => $row['date_time'],
        'departure' => $row['departure'],
        'destination' => $row['destination'],
        'merchandise' => $row['merchandise'],
        'comments' => $row['comments'],
        'status' => $row['status'],
        'photoUrl' => $photoUrl,
        'completionComments' => $row['completion_comments'],
        'createdAt' => $row['created_at'],
        'updatedAt' => $row['updated_at'],
        'archivedAt' => $row['archived_at'],
    ];
}
