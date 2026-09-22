<?php
require_once __DIR__ . '/config.php';
setCorsHeaders();

$user   = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int) $_GET['id'] : null;
$action = $_GET['action'] ?? null;

// Modification du routeur pour intégrer 'assign' et 'release'
match ($method) {
    'GET'    => $id ? getOne($user, $id) : getAll($user),
    'POST'   => match ($action) {
        'assign'  => $id ? assignVehicle($user, $id) : errorResponse('ID requis'),
        'release' => $id ? releaseVehicle($user, $id) : errorResponse('ID requis'),
        default   => create($user),
    },
    'PUT'    => $id ? update($user, $id) : errorResponse('ID requis'),
    'DELETE' => $id ? remove($user, $id) : errorResponse('ID requis'),
    default  => errorResponse('Méthode non supportée', 405),
};

// Fonction utilitaire pour vérifier le rôle
function isAdmin(array $user): bool {
    if (empty($user['id'])) {
        return false;
    }
    
    $pdo = getDB();
    $stmt = $pdo->prepare('SELECT role FROM users WHERE id = ?');
    $stmt->execute([$user['id']]);
    $dbUser = $stmt->fetch();
    
    $role = $dbUser['role'] ?? $user['role'] ?? 'employee';
    
    // Nettoyage et vérification stricte
    return strtolower(trim($role)) === 'admin';
}

function getAll(array $user): void {
    $pdo = getDB();
    
    if (isAdmin($user)) {
        $stmt = $pdo->prepare('
            SELECT v.*, u.name as employee_name, u.email as employee_email 
            FROM vehicles v
            LEFT JOIN users u ON v.current_employee_id = u.id
            ORDER BY v.created_at DESC
        ');
        $stmt->execute();
    } else {
        $stmt = $pdo->prepare('
            SELECT v.*, u.name as employee_name, u.email as employee_email 
            FROM vehicles v
            LEFT JOIN users u ON v.current_employee_id = u.id
            WHERE v.status = "disponible" OR v.current_employee_id = ? 
            ORDER BY v.created_at DESC
        ');
        $stmt->execute([$user['id']]);
    }
    
    jsonResponse($stmt->fetchAll());
}

function getOne(array $user, int $id): void {
    $pdo = getDB();
    
    if (isAdmin($user)) {
        $stmt = $pdo->prepare('SELECT * FROM vehicles WHERE id = ?');
        $stmt->execute([$id]);
    } else {
        $stmt = $pdo->prepare('SELECT * FROM vehicles WHERE id = ? AND (status = "disponible" OR current_employee_id = ?)');
        $stmt->execute([$id, $user['id']]);
    }
    
    $vehicle = $stmt->fetch();
    if (!$vehicle) errorResponse('Véhicule introuvable ou accès refusé', 404);
    jsonResponse($vehicle);
}

function create(array $user): void {
    // Sécurisation : Seuls les admins peuvent ajouter des véhicules
    if (!isAdmin($user)) errorResponse('Seuls les administrateurs peuvent ajouter un véhicule', 403);

    $body = getBody();
    $required = ['make', 'model', 'year', 'license_plate'];
    foreach ($required as $field) {
        if (!isset($body[$field]) || trim((string)$body[$field]) === '') {
            errorResponse("Champ requis : $field");
        }
    }

    $pdo = getDB();
    
    try {
        // Début de la transaction pour garantir que le véhicule ET les clés sont créés ensemble
        $pdo->beginTransaction();

        $stmt = $pdo->prepare('
            INSERT INTO vehicles (user_id, make, model, year, license_plate, color, mileage, fuel_type, vin, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        
        $stmt->execute([
            $user['id'],
            trim($body['make']),
            trim($body['model']),
            (int) $body['year'],
            strtoupper(trim($body['license_plate'])),
            trim($body['color'] ?? ''),
            (int) ($body['mileage'] ?? 0),
            $body['fuel_type'] ?? 'essence',
            trim($body['vin'] ?? ''),
            trim($body['notes'] ?? ''),
        ]);
        
        $newId = (int) $pdo->lastInsertId();

        $keyStmt = $pdo->prepare('INSERT INTO vehicle_keys (vehicle_id, key_number, holder_type) VALUES (?,?,?)');
        $keyStmt->execute([$newId, 1, 'owner']);
        $keyStmt->execute([$newId, 2, 'owner']);

        $pdo->commit();
        
        // Retourne le nouveau véhicule
        $fetchStmt = $pdo->prepare('SELECT * FROM vehicles WHERE id = ?');
        $fetchStmt->execute([$newId]);
        jsonResponse($fetchStmt->fetch());

    } catch (Exception $e) {
        $pdo->rollBack();
        errorResponse('Erreur système lors de la création : ' . $e->getMessage(), 500);
    }
}

function update(array $user, int $id): void {
    if (!isAdmin($user)) errorResponse('Action non autorisée', 403);

    $pdo = getDB();
    $chk = $pdo->prepare('SELECT id FROM vehicles WHERE id = ?');
    $chk->execute([$id]);
    if (!$chk->fetch()) errorResponse('Véhicule introuvable', 404);

    $body = getBody();
    $pdo->prepare('
        UPDATE vehicles SET make=?, model=?, year=?, license_plate=?, color=?, mileage=?, fuel_type=?, vin=?, notes=?
        WHERE id = ?
    ')->execute([
        trim($body['make'] ?? ''),
        trim($body['model'] ?? ''),
        (int) ($body['year'] ?? 0),
        strtoupper(trim($body['license_plate'] ?? '')),
        trim($body['color'] ?? ''),
        (int) ($body['mileage'] ?? 0),
        $body['fuel_type'] ?? 'essence',
        trim($body['vin'] ?? ''),
        trim($body['notes'] ?? ''),
        $id,
    ]);
    
    $stmt = $pdo->prepare('SELECT * FROM vehicles WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch());
}

function remove(array $user, int $id): void {
    if (!isAdmin($user)) errorResponse('Action non autorisée', 403);

    $pdo = getDB();
    $chk = $pdo->prepare('SELECT id FROM vehicles WHERE id = ?');
    $chk->execute([$id]);
    if (!$chk->fetch()) errorResponse('Véhicule introuvable', 404);

    $pdo->prepare('DELETE FROM vehicles WHERE id = ?')->execute([$id]);
    jsonResponse(['message' => 'Véhicule supprimé']);
}

function assignVehicle(array $user, int $vehicleId): void {
    $pdo = getDB();
    
    $chk = $pdo->prepare('SELECT status FROM vehicles WHERE id = ?');
    $chk->execute([$vehicleId]);
    $vehicle = $chk->fetch();
    
    if (!$vehicle) errorResponse('Véhicule introuvable', 404);
    if ($vehicle['status'] !== 'disponible') errorResponse('Ce véhicule n\'est pas disponible', 400);

    $stmt = $pdo->prepare('
        UPDATE vehicles 
        SET status = "en_utilisation", current_employee_id = ? 
        WHERE id = ?
    ');
    $stmt->execute([$user['id'], $vehicleId]);

    jsonResponse(['message' => 'Véhicule assigné avec succès', 'vehicle_id' => $vehicleId]);
}

// NOUVELLE FONCTION : Permet de terminer une réservation et de remettre le véhicule en disponible
function releaseVehicle(array $user, int $vehicleId): void {
    $pdo = getDB();
    
    // On vérifie à qui est assigné le véhicule actuellement
    $chk = $pdo->prepare('SELECT current_employee_id FROM vehicles WHERE id = ?');
    $chk->execute([$vehicleId]);
    $vehicle = $chk->fetch();

    if (!$vehicle) errorResponse('Véhicule introuvable', 404);
    
    // Seul l'employé qui a réservé la voiture ou un admin peut la relâcher
    if ($vehicle['current_employee_id'] !== $user['id'] && !isAdmin($user)) {
        errorResponse('Action non autorisée', 403);
    }

    // On met à jour le statut et on vide l'ID de l'employé
    $stmt = $pdo->prepare('
        UPDATE vehicles 
        SET status = "disponible", current_employee_id = NULL 
        WHERE id = ?
    ');
    $stmt->execute([$vehicleId]);

    jsonResponse(['message' => 'Véhicule rendu et remis en disponibilité']);
}