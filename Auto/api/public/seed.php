<?php
require_once __DIR__ . '/../config/Database.php';

try {
    $pdo = Database::getConnection();
    $name = 'Benoit Flament';
    $email = 'benoit.flament63@gmail.com';
    $password = password_hash('Auto2026!', PASSWORD_BCRYPT);
    $role = 'admin';

    // Ajout du champ 'name' obligatoire
    $stmt = $pdo->prepare("INSERT INTO users (name, email, password) VALUES (?, ?, ?)");
    $stmt->execute([$name, $email, $password]);

    echo "--- Utilisateur créé avec succès ! ---";
} catch (Exception $e) {
    echo "Erreur SQL : " . $e->getMessage();
}