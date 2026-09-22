<?php
require_once __DIR__ . '/config.php';
setCorsHeaders();

$user      = requireAuth();
$method    = $_SERVER['REQUEST_METHOD'];
$id        = isset($_GET['id'])         ? (int) $_GET['id']         : null;
$vehicleId = isset($_GET['vehicle_id']) ? (int) $_GET['vehicle_id'] : null;

$pdo = getDB();

// --- FONCTIONS UTILITAIRES DE SÉCURITÉ ---

if (!function_exists('isAdmin')) {
    function isAdmin(array $user): bool {
        return isset($user['role']) && strtolower($user['role']) === 'admin';
    }
}

/**
 * Vérifie que le véhicule existe et que l'utilisateur a le droit d'y accéder.
 */
function checkVehicleOwner(PDO $pdo, int $vehicleId, array $user): void {
    if (isAdmin($user)) {
        $chk = $pdo->prepare('SELECT id FROM vehicles WHERE id = ?');
        $chk->execute([$vehicleId]);
    } else {
        $chk = $pdo->prepare('
            SELECT id FROM vehicles 
            WHERE id = ? AND (
                user_id = ? 
                OR current_employee_id = ? 
                OR status = "disponible"
            )
        ');
        $chk->execute([$vehicleId, $user['id'], $user['id']]);
    }

    if (!$chk->fetch()) {
        errorResponse('Véhicule introuvable ou non autorisé', 404);
    }
}

/**
 * Vérifie que le document existe et que l'utilisateur a le droit d'interagir avec.
 */
function checkDocOwner(PDO $pdo, int $docId, array $user): array {
    if (isAdmin($user)) {
        $stmt = $pdo->prepare('SELECT * FROM documents WHERE id = ?');
        $stmt->execute([$docId]);
    } else {
        $stmt = $pdo->prepare('
            SELECT d.* FROM documents d
            JOIN vehicles v ON v.id = d.vehicle_id
            WHERE d.id = ? AND (
                v.user_id = ? 
                OR v.current_employee_id = ?
            )
        ');
        $stmt->execute([$docId, $user['id'], $user['id']]);
    }

    $doc = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$doc) {
        errorResponse('Document introuvable ou non autorisé', 404);
    }
    return $doc;
}

// --- ROUTAGE DES REQUÊTES HTTP ---

match ($method) {
    'GET'    => $vehicleId ? listDocs($pdo, $user, $vehicleId) : errorResponse('vehicle_id requis'),
    'POST'   => uploadDoc($pdo, $user),
    'DELETE' => $id ? removeDoc($pdo, $user, $id) : errorResponse('ID requis'),
    default  => errorResponse('Méthode non supportée', 405),
};

// --- LOGIQUE DES ACTIONS ---

function listDocs(PDO $pdo, array $user, int $vehicleId): void {
    checkVehicleOwner($pdo, $vehicleId, $user);
    $stmt = $pdo->prepare('SELECT * FROM documents WHERE vehicle_id = ? ORDER BY category, uploaded_at DESC');
    $stmt->execute([$vehicleId]);
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

function uploadDoc(PDO $pdo, array $user): void {
    $vehicleId = (int) ($_POST['vehicle_id'] ?? 0);
    if (!$vehicleId) errorResponse('vehicle_id requis');
    
    checkVehicleOwner($pdo, $vehicleId, $user);

    $name       = trim($_POST['name'] ?? '');
    $category   = $_POST['category'] ?? 'autres';
    $expiryDate = !empty($_POST['expiry_date']) ? $_POST['expiry_date'] : null;

    if (!$name) errorResponse('Nom du document requis');
    if (!isset($_FILES['file'])) errorResponse('Fichier requis');

    $file = $_FILES['file'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        errorResponse('Erreur d\'upload : ' . $file['error']);
    }
    if ($file['size'] > MAX_FILE_SIZE) {
        errorResponse('Fichier trop volumineux (max 10 MB)');
    }

    $finfo    = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $finfo->file($file['tmp_name']);
    if (!in_array($mimeType, ALLOWED_TYPES, true)) {
        errorResponse('Type de fichier non autorisé. Formats acceptés : PDF, JPEG, PNG, GIF, WebP');
    }

    if (!is_dir(UPLOAD_DIR)) {
        mkdir(UPLOAD_DIR, 0755, true);
    }

    $ext      = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = uniqid('doc_', true) . '.' . strtolower($ext);
    $dest     = UPLOAD_DIR . $filename;

    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        errorResponse('Impossible de sauvegarder le fichier', 500);
    }

    $stmt = $pdo->prepare('
        INSERT INTO documents (vehicle_id, user_id, name, category, file_path, file_name, file_type, file_size, expiry_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([
        $vehicleId,
        $user['id'],
        $name,
        $category,
        UPLOAD_URL . $filename,
        $file['name'],
        $mimeType,
        $file['size'],
        $expiryDate,
    ]);
    
    $newId = (int) $pdo->lastInsertId();
    $fetch = $pdo->prepare('SELECT * FROM documents WHERE id = ?');
    $fetch->execute([$newId]);
    jsonResponse($fetch->fetch(PDO::FETCH_ASSOC), 201);
}

function removeDoc(PDO $pdo, array $user, int $id): void {
    $doc = checkDocOwner($pdo, $id, $user);

    $filePath = __DIR__ . '/../' . ltrim($doc['file_path'], '/');
    if (file_exists($filePath)) {
        @unlink($filePath);
    }

    $pdo->prepare('DELETE FROM documents WHERE id = ?')->execute([$id]);
    jsonResponse(['message' => 'Document supprimé avec succès']);
}