<?php
// src/Core/AuthMiddleware.php

class AuthMiddleware {
    public static function requireAuth(PDO $pdo): array {
        $headers = getallheaders();
        $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        $token = trim(str_replace('Bearer', '', $auth));

        if (empty($token)) {
            Response::error('Token d\'authentification manquant', 401);
        }

        $stmt = $pdo->prepare('SELECT id, name, email, role FROM users WHERE auth_token = ? AND token_expires > NOW()');
        $stmt->execute([$token]);
        $user = $stmt->fetch();

        if (!$user) {
            Response::error('Session expirée ou token invalide', 401);
        }

        return $user;
    }

    public static function isAdmin(array $user): bool {
        return isset($user['role']) && strtolower(trim($user['role'])) === 'admin';
    }
}