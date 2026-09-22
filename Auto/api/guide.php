<?php
require_once __DIR__ . '/config.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int) $_GET['id'] : null;

$pdo = getDB();

// ==========================================
// 1. LECTURE DES ARTICLES (Méthode GET)
// ==========================================
if ($method === 'GET') {
    if ($id) {
        $stmt = $pdo->prepare('SELECT * FROM guide_articles WHERE id = ?');
        $stmt->execute([$id]);
        $article = $stmt->fetch();
        if (!$article) errorResponse('Article introuvable', 404);
        jsonResponse($article);
    } else {
        $category = $_GET['category'] ?? '';
        $search   = $_GET['q'] ?? '';

        $sql    = 'SELECT id, title, category, tags, read_time, created_at FROM guide_articles';
        $params = [];
        $where  = [];

        if ($category) {
            $where[] = 'category = ?';
            $params[] = $category;
        }
        if ($search) {
            $where[] = '(title LIKE ? OR tags LIKE ? OR content LIKE ?)';
            $like = '%' . $search . '%';
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }
        if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
        $sql .= ' ORDER BY created_at DESC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        jsonResponse($stmt->fetchAll());
    }
} 
// ==========================================
// 2. CRÉATION D'UN ARTICLE (Méthode POST)
// ==========================================
elseif ($method === 'POST') {
    // Récupération des données envoyées par le formulaire JS
    $input = json_decode(file_get_contents('php://input'), true);

    $title     = trim($input['title'] ?? '');
    $category  = trim($input['category'] ?? '');
    $read_time = (int) ($input['read_time'] ?? 3);
    $content   = trim($input['content'] ?? '');
    $tags      = ''; // Optionnel, laissé vide par défaut si non fourni

    // Vérification des champs obligatoires
    if (empty($title) || empty($content)) {
        errorResponse('Le titre et le contenu sont requis.', 400);
    }

    // Insertion dans la base de données
    $sql = 'INSERT INTO guide_articles (title, category, tags, read_time, content) VALUES (?, ?, ?, ?, ?)';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$title, $category, $tags, $read_time, $content]);
    
    // Récupération de l'ID généré
    $newId = $pdo->lastInsertId();
    
    // On renvoie l'article créé pour que l'interface s'actualise
    jsonResponse([
        'id'        => $newId,
        'title'     => $title,
        'category'  => $category,
        'read_time' => $read_time,
        'content'   => $content,
        'tags'      => $tags
    ], 201);
} 
// ==========================================
// 3. AUTRES MÉTHODES (PUT, DELETE...)
// ==========================================
else {
    errorResponse('Méthode non supportée', 405);
}