<?php
// public/index.php

// 1. Inclusions obligatoires (Chargement des classes du projet)
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../src/Core/Response.php';
require_once __DIR__ . '/../src/Core/AuthMiddleware.php';
require_once __DIR__ . '/../src/Models/UserModel.php';
require_once __DIR__ . '/../src/Models/VehicleModel.php';
require_once __DIR__ . '/../src/Controllers/AuthController.php';
require_once __DIR__ . '/../src/Controllers/VehicleController.php';

// 2. Configuration CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// 3. Récupération des données de la requête
$pdo        = Database::getConnection();
$method     = $_SERVER['REQUEST_METHOD'];
$body       = json_decode(file_get_contents('php://input'), true) ?? [];

$entity     = $_GET['entity'] ?? null; 
$action     = $_GET['action'] ?? null;
$id         = isset($_GET['id']) ? (int) $_GET['id'] : null;
$vehicle_id = isset($_GET['vehicle_id']) ? (int) $_GET['vehicle_id'] : null;

// 4. Le Routeur (Aiguillage général)
if (!$entity) {
    Response::json(['message' => 'Bienvenue sur l\'API AutoGest. Veuillez spécifier une entité.'], 200);
}

switch ($entity) {
    
    // --- AUTHENTIFICATION ET UTILISATEURS ---
    case 'auth':
        $controller = new AuthController(new UserModel($pdo));
        if ($method === 'POST' && $action === 'login') {
            $controller->login($body);
        } elseif ($method === 'POST' && $action === 'logout') {
            $user = AuthMiddleware::requireAuth($pdo);
            $controller->logout($user);
        } elseif ($method === 'GET' && $action === 'me') {
            $user = AuthMiddleware::requireAuth($pdo);
            Response::json($user, 200);
        } else {
            Response::error('Action non reconnue pour auth', 400);
        }
        break;

    case 'employees':
        $user = AuthMiddleware::requireAuth($pdo);
        $controller = new AuthController(new UserModel($pdo));
        if ($method === 'GET') {
            $controller->listEmployees($user);
        } else {
            Response::error('Méthode non autorisée pour la route employees', 405);
        }
        break;

    // --- VÉHICULES ---
    case 'vehicles':
        $user = AuthMiddleware::requireAuth($pdo);
        $controller = new VehicleController(new VehicleModel($pdo));
        
        if ($method === 'GET') {
            $controller->index($user);
        } elseif ($method === 'POST' && $action === 'assign' && $id) {
            $controller->assign($id, $user);
        } else {
            Response::error('Méthode ou action non reconnue pour les véhicules', 400);
        }
        break;

    // --- DOCUMENTS ---
    case 'documents':
        $user = AuthMiddleware::requireAuth($pdo);
        if ($method === 'GET') {
            if ($vehicle_id) {
                $stmt = $pdo->prepare("SELECT d.*, v.make, v.model, v.license_plate FROM documents d JOIN vehicles v ON d.vehicle_id = v.id WHERE d.vehicle_id = ?");
                $stmt->execute([$vehicle_id]);
            } else {
                $stmt = $pdo->query("SELECT d.*, v.make, v.model, v.license_plate FROM documents d JOIN vehicles v ON d.vehicle_id = v.id");
            }
            Response::json($stmt->fetchAll(PDO::FETCH_ASSOC), 200);
        } else {
            Response::error('Méthode non autorisée pour la route documents', 405);
        }
        break;

    // --- HISTORIQUE DE MAINTENANCE / CARBURANT ---
    case 'maintenance':
    case 'maintenance_history':
        $user = AuthMiddleware::requireAuth($pdo);
        if ($method === 'GET') {
            if ($vehicle_id) {
                $stmt = $pdo->prepare("SELECT m.*, v.make, v.model, v.license_plate FROM maintenance_history m JOIN vehicles v ON m.vehicle_id = v.id WHERE m.vehicle_id = ? ORDER BY m.date DESC");
                $stmt->execute([$vehicle_id]);
            } else {
                $stmt = $pdo->query("SELECT m.*, v.make, v.model, v.license_plate FROM maintenance_history m JOIN vehicles v ON m.vehicle_id = v.id ORDER BY m.date DESC");
            }
            Response::json($stmt->fetchAll(PDO::FETCH_ASSOC), 200);
        } else {
            Response::error('Méthode non autorisée pour la route maintenance', 405);
        }
        break;

    // --- CLÉS DE VÉHICULES ---
    case 'keys':
    case 'vehicle_keys':
        $user = AuthMiddleware::requireAuth($pdo);
        if ($method === 'GET') {
            $stmt = $pdo->query("SELECT k.*, CONCAT(v.make, ' ', v.model, ' (', v.license_plate, ')') AS vehicle_name FROM vehicle_keys k LEFT JOIN vehicles v ON k.vehicle_id = v.id");
            Response::json($stmt->fetchAll(PDO::FETCH_ASSOC), 200);
        } else {
            Response::error('Méthode non autorisée pour la route keys', 405);
        }
        break;

    // --- GUIDE ENTREPRISE (Lecture publique) ---
    case 'guide':
        if ($method === 'GET') {
            if ($id) {
                $stmt = $pdo->prepare("SELECT * FROM guide_articles WHERE id = ?");
                $stmt->execute([$id]);
                $article = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$article) {
                    Response::error('Article introuvable', 404);
                }
                Response::json($article, 200);
            } else {
                $stmt = $pdo->query("SELECT id, title, category, tags, read_time, created_at FROM guide_articles ORDER BY created_at DESC");
                Response::json($stmt->fetchAll(PDO::FETCH_ASSOC), 200);
            }
        } else {
            Response::error('Méthode non autorisée pour la route guide', 405);
        }
        break;

    default:
        Response::error('Entité (Route) introuvable', 404);
}