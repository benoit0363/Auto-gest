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
    /**
     * Vérifie si l'utilisateur connecté possède le rôle administrateur.
     */
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
 * Vérifie que l'entrée d'historique existe et appartient à un véhicule accessible.
 */
function checkEntryOwner(PDO $pdo, int $entryId, array $user): array {
    if (isAdmin($user)) {
        $stmt = $pdo->prepare('SELECT * FROM maintenance_history WHERE id = ?');
        $stmt->execute([$entryId]);
    } else {
        $stmt = $pdo->prepare('
            SELECT mh.* FROM maintenance_history mh
            JOIN vehicles v ON v.id = mh.vehicle_id
            WHERE mh.id = ? AND (
                v.user_id = ? 
                OR v.current_employee_id = ?
            )
        ');
        $stmt->execute([$entryId, $user['id'], $user['id']]);
    }

    $entry = $stmt->fetch();
    if (!$entry) {
        errorResponse('Entrée d\'historique introuvable ou non autorisée', 404);
    }
    return $entry;
}

// --- ROUTAGE DES REQUÊTES HTTP ---

match ($method) {
    'GET'    => $vehicleId ? getHistory($pdo, $user, $vehicleId) : errorResponse('vehicle_id requis'),
    'POST'   => create($pdo, $user),
    'PUT'    => $id ? update($pdo, $user, $id) : errorResponse('ID requis'),
    'DELETE' => $id ? remove($pdo, $user, $id) : errorResponse('ID requis'),
    default  => errorResponse('Méthode non supportée', 405),
};

// --- LOGIQUE DES ACTIONS ---

function getHistory(PDO $pdo, array $user, int $vehicleId): void {
    checkVehicleOwner($pdo, $vehicleId, $user);
    $stmt = $pdo->prepare('SELECT * FROM maintenance_history WHERE vehicle_id = ? ORDER BY date DESC, id DESC');
    $stmt->execute([$vehicleId]);
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

function create(PDO $pdo, array $user): void {
    $body      = getBody();
    $vehicleId = (int) ($body['vehicle_id'] ?? 0);
    if (!$vehicleId) errorResponse('vehicle_id requis');
    
    checkVehicleOwner($pdo, $vehicleId, $user);

    $required = ['type', 'date', 'mileage'];
    foreach ($required as $f) {
        if (empty($body[$f])) errorResponse("Champ requis : $f");
    }

    $stmt = $pdo->prepare('
        INSERT INTO maintenance_history (vehicle_id, type, date, mileage, cost, description, liters, station)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([
        $vehicleId,
        $body['type'],
        $body['date'],
        (int) $body['mileage'],
        isset($body['cost'])   && $body['cost']   !== '' ? (float) $body['cost']   : null,
        trim($body['description'] ?? ''),
        isset($body['liters']) && $body['liters'] !== '' ? (float) $body['liters'] : null,
        trim($body['station'] ?? ''),
    ]);

    $newId = (int) $pdo->lastInsertId();
    $fetch = $pdo->prepare('SELECT * FROM maintenance_history WHERE id = ?');
    $fetch->execute([$newId]);
    jsonResponse($fetch->fetch(PDO::FETCH_ASSOC), 201);
}

function update(PDO $pdo, array $user, int $id): void {
    checkEntryOwner($pdo, $id, $user);
    $body = getBody();
    
    $stmt = $pdo->prepare('
        UPDATE maintenance_history 
        SET type = ?, date = ?, mileage = ?, cost = ?, description = ?, liters = ?, station = ?
        WHERE id = ?
    ');
    $stmt->execute([
        $body['type'] ?? 'autre',
        $body['date'] ?? date('Y-m-d'),
        (int) ($body['mileage'] ?? 0),
        isset($body['cost'])   && $body['cost']   !== '' ? (float) $body['cost']   : null,
        trim($body['description'] ?? ''),
        isset($body['liters']) && $body['liters'] !== '' ? (float) $body['liters'] : null,
        trim($body['station'] ?? ''),
        $id,
    ]);

    $fetch = $pdo->prepare('SELECT * FROM maintenance_history WHERE id = ?');
    $fetch->execute([$id]);
    jsonResponse($fetch->fetch(PDO::FETCH_ASSOC));
}

function remove(PDO $pdo, array $user, int $id): void {
    checkEntryOwner($pdo, $id, $user);
    $pdo->prepare('DELETE FROM maintenance_history WHERE id = ?')->execute([$id]);
    jsonResponse(['message' => 'Entrée supprimée avec succès']);
}