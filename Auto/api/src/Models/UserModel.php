<?php
// src/Models/UserModel.php

class UserModel {
    private PDO $pdo;

    public function __construct(PDO $pdo) {
        $this->pdo = $pdo;
    }

    public function findByEmail(string $email): ?array {
        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE email = ?');
        $stmt->execute([$email]);
        return $stmt->fetch() ?: null;
    }

    public function updateToken(int $userId, string $token, string $expiresAt): void {
        $stmt = $this->pdo->prepare('UPDATE users SET auth_token = ?, token_expires = ? WHERE id = ?');
        $stmt->execute([$token, $expiresAt, $userId]);
    }

    public function clearToken(int $userId): void {
        $stmt = $this->pdo->prepare('UPDATE users SET auth_token = NULL, token_expires = NULL WHERE id = ?');
        $stmt->execute([$userId]);
    }

    public function findAllEmployees(): array {
        $stmt = $this->pdo->query('SELECT id, name, email, role, created_at FROM users ORDER BY name ASC');
        return $stmt->fetchAll();
    }
}