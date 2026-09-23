<?php
// src/Models/VehicleModel.php

class VehicleModel {
    private PDO $pdo;

    public function __construct(PDO $pdo) {
        $this->pdo = $pdo;
    }

    public function findAll(array $user, bool $isAdmin): array {
        if ($isAdmin) {
            $stmt = $this->pdo->query('SELECT v.*, u.name as employee_name FROM vehicles v LEFT JOIN users u ON v.current_employee_id = u.id ORDER BY v.created_at DESC');
            return $stmt->fetchAll();
        } else {
            $stmt = $this->pdo->prepare('SELECT * FROM vehicles WHERE status = "disponible" OR current_employee_id = ? ORDER BY created_at DESC');
            $stmt->execute([$user['id']]);
            return $stmt->fetchAll();
        }
    }

    public function assign(int $vehicleId, int $userId): bool {
        $stmt = $this->pdo->prepare('UPDATE vehicles SET status = "en_utilisation", current_employee_id = ? WHERE id = ? AND status = "disponible"');
        return $stmt->execute([$userId, $vehicleId]);
    }
}