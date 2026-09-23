<?php
// public/index.php

// 1. Inclusions obligatoires (On charge tout notre code)
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../src/Core/Response.php';
require_once __DIR__ . '/../src/Core/AuthMiddleware.php';
require_once __DIR__ . '/../src/Models/UserModel.php';
require_once __DIR__ . '/../src/Models/VehicleModel.php';
require_once __DIR__ . '/../src/Controllers/AuthController.php';
require_once __DIR__ . '/../src/Controllers/VehicleController.php';

// 2. Configuration CORS (Pour autoriser ton Front-End à communiquer avec l'API)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// 3. Récupération des infos de la requête
$pdo    = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'];
$body   = json_decode(file_get_contents('php://input'), true) ?? [];

// On lit l'URL pour savoir quoi faire (ex: monsite.fr/api/public/index.php?entity=vehicles&action=assign&id=5)
$entity = $_GET['entity'] ?? null; 
$action = $_GET['action'] ?? null;
$id     = isset($_GET['id']) ? (int) $_GET['id'] : null;

// 4. Le Routeur (L'aiguillage)
if (!$entity) {
    Response::json(['message' => 'Bienvenue sur l\'API AutoGest. Veuillez spécifier une entité.'], 200);
}

switch ($entity) {
    
    // --- GESTION DE L'AUTHENTIFICATION ET EMPLOYÉS ---
    case 'auth':
        $controller = new AuthController(new UserModel($pdo));
        if ($method === 'POST' && $action === 'login') {
            $controller->login($body);
        } elseif ($method === 'POST' && $action === 'logout') {
            $user = AuthMiddleware::requireAuth($pdo);
            $controller->logout($user);
        } else {
            Response::error('Action non reconnue pour auth');
        }
        break;

    case 'employees':
        $user = AuthMiddleware::requireAuth($pdo);
        $controller = new AuthController(new UserModel($pdo));
        if ($method === 'GET') {
            $controller->listEmployees($user);
        }
        break;

    // --- GESTION DES VÉHICULES ---
    case 'vehicles':
        $user = AuthMiddleware::requireAuth($pdo);
        $controller = new VehicleController(new VehicleModel($pdo));
        
        if ($method === 'GET') {
            $controller->index($user); // Liste les véhicules
        } elseif ($method === 'POST' && $action === 'assign' && $id) {
            $controller->assign($id, $user); // Assigne un véhicule
        } else {
            Response::error('Méthode ou action non reconnue pour les véhicules');
        }
        break;

    default:
        Response::error('Entité (Route) introuvable', 404);
}