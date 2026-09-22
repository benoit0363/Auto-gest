-- Création de la base de données (si elle n'existe pas déjà)
CREATE DATABASE IF NOT EXISTS auto CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE auto;

-- 1. Table unique des utilisateurs (Administrateurs et Employés)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(50) DEFAULT NULL,
    role ENUM('admin', 'employee') DEFAULT 'employee',
    auth_token VARCHAR(64) DEFAULT NULL,
    token_expires DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table des véhicules
CREATE TABLE IF NOT EXISTS vehicles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL, -- ID de l'administrateur propriétaire / gestionnaire du parc
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INT NOT NULL,
    license_plate VARCHAR(20) NOT NULL,
    color VARCHAR(50) DEFAULT NULL,
    mileage INT DEFAULT 0,
    fuel_type VARCHAR(50) DEFAULT 'essence',
    vin VARCHAR(50) DEFAULT NULL,
    notes TEXT,
    status ENUM('disponible', 'en_utilisation') DEFAULT 'disponible',
    current_employee_id INT DEFAULT NULL, -- Employé utilisant actuellement le véhicule
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (current_employee_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 3. Table des clés de véhicules
CREATE TABLE IF NOT EXISTS vehicle_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT NOT NULL,
    key_number INT NOT NULL,
    status ENUM('disponible', 'en_utilisation') DEFAULT 'disponible',
    location VARCHAR(255) DEFAULT NULL,
    current_employee_id INT DEFAULT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
    FOREIGN KEY (current_employee_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 4. Table des documents (Assurances, cartes grises, etc.)
CREATE TABLE IF NOT EXISTS documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT NOT NULL,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'autres',
    file_path VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size INT NOT NULL,
    expiry_date DATE DEFAULT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Table de l'historique d'entretien et carburant
CREATE TABLE IF NOT EXISTS maintenance_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT NOT NULL,
    type VARCHAR(100) NOT NULL DEFAULT 'autre',
    date DATE NOT NULL,
    mileage INT NOT NULL,
    cost DECIMAL(10, 2) DEFAULT NULL,
    description TEXT,
    liters DECIMAL(8, 2) DEFAULT NULL,
    station VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- 6. Table des articles de guide (Documentation interne/entreprise)
CREATE TABLE IF NOT EXISTS guide_articles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    tags VARCHAR(255) DEFAULT NULL,
    content LONGTEXT NOT NULL,
    read_time VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);