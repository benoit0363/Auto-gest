<?php
require_once __DIR__ . '/config.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

match (true) {
    $method === 'POST' && $action === 'login'    => handleLogin(),
    $method === 'POST' && $action === 'register' => handleRegister(),
    $method === 'POST' && $action === 'logout'   => handleLogout(),
    $method === 'GET'  && $action === 'me'       => handleMe(),
    default => errorResponse('Action inconnue', 404),
};

function handleLogin(): void {
    $body = getBody();
    $email    = trim($body['email'] ?? '');
    $password = $body['password'] ?? '';

    if (!$email || !$password) errorResponse('Email et mot de passe requis');

    $pdo  = getDB();
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        errorResponse('Email ou mot de passe incorrect', 401);
    }

    $token   = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', strtotime('+30 days'));

    $pdo->prepare('UPDATE users SET auth_token = ?, token_expires = ? WHERE id = ?')
        ->execute([$token, $expires, $user['id']]);

    // Renvoi du rôle dans la réponse JSON
    jsonResponse([
        'token' => $token,
        'user'  => [
            'id'    => $user['id'], 
            'name'  => $user['name'], 
            'email' => $user['email'],
            'role'  => $user['role'] ?? 'employee' // Transmet le rôle (admin ou employee)
        ],
    ]);
}

function handleRegister(): void {
    $body  = getBody();
    $name  = trim($body['name'] ?? '');
    $email = trim(strtolower($body['email'] ?? ''));
    $pass  = $body['password'] ?? '';
    $role  = $body['role'] ?? 'employee';

    if (!$name || !$email || !$pass) errorResponse('Tous les champs sont requis');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) errorResponse('Email invalide');
    if (strlen($pass) < 6) errorResponse('Le mot de passe doit faire au moins 6 caractères');

    $pdo = getDB();
    $chk = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $chk->execute([$email]);
    if ($chk->fetch()) errorResponse('Cet email est déjà utilisé');

    $hash    = password_hash($pass, PASSWORD_BCRYPT);
    $token   = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', strtotime('+30 days'));

    $stmt = $pdo->prepare('INSERT INTO users (name, email, password, role, auth_token, token_expires) VALUES (?,?,?,?,?,?)');
    $stmt->execute([$name, $email, $hash, $role, $token, $expires]);
    $userId = (int) $pdo->lastInsertId();

    jsonResponse([
        'token' => $token,
        'user'  => ['id' => $userId, 'name' => $name, 'email' => $email, 'role' => $role],
    ], 201);
}

function handleLogout(): void {
    $user = requireAuth();
    getDB()->prepare('UPDATE users SET auth_token = NULL, token_expires = NULL WHERE id = ?')
           ->execute([$user['id']]);
    jsonResponse(['message' => 'Déconnexion réussie']);
}

function handleMe(): void {
    $user = requireAuth();
    jsonResponse($user);
}