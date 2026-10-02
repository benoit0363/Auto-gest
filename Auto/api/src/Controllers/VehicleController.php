<?php
// src/Controllers/VehicleController.php

class VehicleController {
    private VehicleModel $model;

    public function __construct(VehicleModel $model) {
        $this->model = $model;
    }

    public function index(array $user): void {
        $isAdmin = AuthMiddleware::isAdmin($user);
        $vehicles = $this->model->findAll($user, $isAdmin);
        Response::json($vehicles);
    }

    public function assign(int $vehicleId, array $user): void {
        $success = $this->model->assign($vehicleId, $user['id']);
        if (!$success) {
            Response::error('Impossible d\'assigner ce véhicule (déjà pris ou inexistant)', 400);
        }
        Response::json(['message' => 'Véhicule assigné avec succès']);
    }
}