<?php
require_once __DIR__ . '/config.php';
setCorsHeaders();

$user   = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int) $_GET['id'] : null;

// Fonction utilitaire robuste pour vérifier si l'utilisateur est admin
function isAdmin(array $user): bool {
    if (empty($user['id'])) {
        return false;
    }
    $pdo = getDB();
    $stmt = $pdo->prepare('SELECT role FROM users WHERE id = ?');
    $stmt->execute([$user['id']]);
    $dbUser = $stmt->fetch();
    
    $role = $dbUser['role'] ?? $user['role'] ?? 'employee';
    return strtolower(trim($role)) === 'admin';
}

$isAdmin = isAdmin($user);

// Le routage autorise le GET (lecture) pour tout le monde, mais bloque les mutations pour les employés
match ($method) {
    'GET'    => getAll(),
    'POST'   => $isAdmin ? create() : errorResponse("Seul l'administrateur peut ajouter un membre", 403),
    'PUT'    => $isAdmin ? ($id ? update($id) : errorResponse('ID requis')) : errorResponse("Accès refusé", 403),
    'DELETE' => $isAdmin ? ($id ? remove($id) : errorResponse('ID requis')) : errorResponse("Accès refusé", 403),
    default  => errorResponse('Méthode non supportée', 405),
};

function getAll(): void {
    $pdo  = getDB();
    $stmt = $pdo->prepare("SELECT id, name, email, phone FROM users WHERE role = 'employee' ORDER BY name");
    $stmt->execute();
    $employees = $stmt->fetchAll();
    
    foreach ($employees as &$emp) {
        $parts = explode(' ', $emp['name'], 2);
        $emp['firstname'] = $parts[0];
        $emp['name']      = $parts[1] ?? $parts[0];
    }
    
    jsonResponse($employees);
}

function create(): void {
    $body = getBody();
    
    $lastName  = trim($body['name'] ?? '');
    $firstName = trim($body['firstname'] ?? '');
    $email     = trim(strtolower($body['email'] ?? ''));
    $phone     = trim($body['phone'] ?? ''); 
    $password  = $body['password'] ?? '';

    if (!$lastName || !$firstName || !$email || !$password) {
        errorResponse('Nom, prénom, email et mot de passe sont requis');
    }

    $fullName = $firstName . ' ' . $lastName;
    $pdo = getDB();
    
    $chk = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $chk->execute([$email]);
    if ($chk->fetch()) errorResponse('Cet email est déjà utilisé');

    $hash = password_hash($password, PASSWORD_BCRYPT);

    $stmt = $pdo->prepare("
        INSERT INTO users (name, email, phone, password, role) 
        VALUES (?, ?, ?, ?, 'employee')
    ");
    
    $stmt->execute([
        $fullName, 
        $email, 
        $phone, 
        $hash
    ]);
    
    $newId = (int) $pdo->lastInsertId();
    $fetch = $pdo->prepare('SELECT id, name, email, phone FROM users WHERE id = ?');
    $fetch->execute([$newId]);
    $newEmp = $fetch->fetch();
    
    $newEmp['firstname'] = $firstName;
    $newEmp['name']      = $lastName;

    jsonResponse($newEmp, 201);
}

function update(int $id): void {
    $pdo = getDB();
    
    $chk = $pdo->prepare("SELECT id FROM users WHERE id = ? AND role = 'employee'");
    $chk->execute([$id]);
    if (!$chk->fetch()) errorResponse('Employé introuvable', 404);

    $body = getBody();
    $lastName  = trim($body['name'] ?? '');
    $firstName = trim($body['firstname'] ?? '');
    $email     = trim(strtolower($body['email'] ?? ''));
    $phone     = trim($body['phone'] ?? '');

    if (!$lastName || !$firstName || !$email) {
        errorResponse('Le nom, le prénom et l\'email sont requis');
    }

    $fullName = $firstName . ' ' . $lastName;

    $pdo->prepare('UPDATE users SET name=?, email=?, phone=? WHERE id=?')
        ->execute([$fullName, $email, $phone, $id]);

    $fetch = $pdo->prepare('SELECT id, name, email, phone FROM users WHERE id = ?');
    $fetch->execute([$id]);
    $updated = $fetch->fetch();
    
    $updated['firstname'] = $firstName;
    $updated['name']      = $lastName;

    jsonResponse($updated);
}

function remove(int $id): void {
    $pdo = getDB();
    
    $chk = $pdo->prepare("SELECT id FROM users WHERE id = ? AND role = 'employee'");
    $chk->execute([$id]);
    if (!$chk->fetch()) errorResponse('Employé introuvable', 404);

    try {
        $pdo->beginTransaction();
        $pdo->prepare("UPDATE vehicle_keys SET status = 'disponible', current_employee_id = NULL WHERE current_employee_id = ?")->execute([$id]);
        $pdo->prepare("UPDATE vehicles SET status = 'disponible', current_employee_id = NULL WHERE current_employee_id = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$id]);
        
        $pdo->commit();
        jsonResponse(['message' => 'Employé supprimé et équipements libérés avec succès']);
    } catch (Exception $e) {
        $pdo->rollBack();
        errorResponse('Erreur lors de la suppression : ' . $e->getMessage(), 500);
    }
}