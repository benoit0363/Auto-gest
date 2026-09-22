<?php
// ============================================================
//  AutoGest — Configuration base de données
//  Modifiez les constantes ci-dessous pour votre environnement
// ============================================================

define('DB_HOST', 'localhost');
define('DB_NAME', 'auto');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

define('UPLOAD_DIR', __DIR__ . '/../uploads/');
define('UPLOAD_URL', '/auto/uploads/');
define('MAX_FILE_SIZE', 10 * 1024 * 1024); // 10 MB
define('ALLOWED_TYPES', ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']);

// Connexion PDO (singleton)
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            http_response_code(500);
            die(json_encode(['error' => 'Connexion base de données impossible : ' . $e->getMessage()]));
        }
    }
    return $pdo;
}

// En-têtes communs à toutes les réponses
function setCorsHeaders(): void {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// Réponse JSON
function jsonResponse(mixed $data, int $code = 200): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function errorResponse(string $message, int $code = 400): never {
    jsonResponse(['error' => $message], $code);
}

// Vérification du token et récupération de l'utilisateur
function requireAuth(): array {
    $pdo = getDB();
    $headers = getallheaders();
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    $token = trim(str_replace('Bearer', '', $auth));

    if (empty($token)) errorResponse('Token manquant', 401);

    $stmt = $pdo->prepare('SELECT id, name, email FROM users WHERE auth_token = ? AND token_expires > NOW()');
    $stmt->execute([$token]);
    $user = $stmt->fetch();

    if (!$user) errorResponse('Token invalide ou expiré', 401);
    return $user;
}

// Lecture du corps JSON de la requête
function getBody(): array {
    $json = file_get_contents('php://input');
    return json_decode($json, true) ?? [];
}
