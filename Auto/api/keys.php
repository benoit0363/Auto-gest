<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
setCorsHeaders();

$user   = requireAuth(); // Récupère l'utilisateur connecté (dont son id et son rôle)
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? null;
$keyId  = isset($_GET['id']) ? (int) $_GET['id'] : null;

$pdo = getDB();

// Aiguillage principal selon la méthode HTTP et l'action
match ($method) {
    'GET'  => getKeys($pdo),
    'POST' => handlePostActions($pdo, $user, $action, $keyId),
    default => errorResponse('Méthode non supportée', 405),
};

/**
 * Récupère toutes les clés (pour peupler le tableau de bord de l'employé)
 */
function getKeys(PDO $pdo): void {
    // On fait une jointure avec la table vehicles pour obtenir le nom du véhicule
    $stmt = $pdo->prepare('
        SELECT k.id, k.status, k.location, k.current_employee_id,
               CONCAT(v.make, " ", v.model, " (", v.license_plate, ")") AS vehicle_name
        FROM vehicle_keys k
        LEFT JOIN vehicles v ON v.id = k.vehicle_id
        ORDER BY k.id ASC
    ');
    $stmt->execute();
    jsonResponse($stmt->fetchAll());
}

/**
 * Gère les actions POST (take et return)
 */
function handlePostActions(PDO $pdo, array $user, ?string $action, ?int $keyId): void {
    if (!$keyId) {
        errorResponse('ID de la clé requis', 400);
    }

    match ($action) {
        'take'   => takeKey($pdo, $user, $keyId),
        'return' => returnKey($pdo, $user, $keyId),
        default  => errorResponse('Action non reconnue', 400),
    };
}

/**
 * Assigne une clé disponible à l'employé connecté
 */
function takeKey(PDO $pdo, array $user, int $keyId): void {
    // 1. Vérifier que la clé existe et qu'elle est disponible
    $stmt = $pdo->prepare('SELECT id, status FROM vehicle_keys WHERE id = ?');
    $stmt->execute([$keyId]);
    $key = $stmt->fetch();

    if (!$key) {
        errorResponse('Clé introuvable', 404);
    }
    if ($key['status'] !== 'disponible') {
        errorResponse('Cette clé n\'est pas disponible', 403);
    }

    // 2. Mettre à jour la clé avec l'ID de l'employé
    $update = $pdo->prepare("
        UPDATE vehicle_keys
        SET status = 'en_utilisation', 
            current_employee_id = ?, 
            updated_at = NOW()
        WHERE id = ?
    ");
    $update->execute([$user['id'], $keyId]);

    jsonResponse(['success' => true, 'message' => 'Clé récupérée avec succès']);
}

/**
 * Restitue une clé pour qu'elle redevienne disponible
 */
function returnKey(PDO $pdo, array $user, int $keyId): void {
    // 1. Vérifier l'appartenance de la clé
    $stmt = $pdo->prepare('SELECT id, current_employee_id FROM vehicle_keys WHERE id = ?');
    $stmt->execute([$keyId]);
    $key = $stmt->fetch();

    if (!$key) {
        errorResponse('Clé introuvable', 404);
    }
    
    // Sécurité : Seul l'employé qui possède la clé (ou un admin) peut la rendre
    if ($key['current_employee_id'] !== $user['id'] && $user['role'] !== 'admin') {
        errorResponse('Vous ne pouvez restituer que les clés qui vous sont assignées', 403);
    }

    // 2. Remettre la clé en disponibilité
    $update = $pdo->prepare("
        UPDATE vehicle_keys
        SET status = 'disponible', 
            current_employee_id = NULL, 
            updated_at = NOW()
        WHERE id = ?
    ");
    $update->execute([$keyId]);

    jsonResponse(['success' => true, 'message' => 'Clé restituée avec succès']);
}