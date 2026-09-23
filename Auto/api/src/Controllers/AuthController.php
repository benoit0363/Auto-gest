<?php
// src/Controllers/AuthController.php

class AuthController {
    private UserModel $model;

    public function __construct(UserModel $model) {
        $this->model = $model;
    }

    public function login(array $body): void {
        if (empty($body['email']) || empty($body['password'])) {
            Response::error('Email et mot de passe requis');
        }

        $user = $this->model->findByEmail(trim($body['email']));
        
        // Vérification du mot de passe
        if (!$user || !password_verify($body['password'], $user['password'])) {
            Response::error('Identifiants incorrects', 401);
        }

        // Génération du token
        $token = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));
        
        $this->model->updateToken($user['id'], $token, $expiresAt);

        Response::json([
            'message' => 'Connexion réussie',
            'token'   => $token,
            'user'    => ['id' => $user['id'], 'name' => $user['name'], 'role' => $user['role']]
        ]);
    }

    public function logout(array $user): void {
        $this->model->clearToken($user['id']);
        Response::json(['message' => 'Déconnexion réussie']);
    }

    public function listEmployees(array $user): void {
        if (!AuthMiddleware::isAdmin($user)) {
            Response::error('Accès refusé. Réservé aux administrateurs.', 403);
        }
        $employees = $this->model->findAllEmployees();
        Response::json($employees);
    }
}