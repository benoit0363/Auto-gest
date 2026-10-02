<?php
// config/Database.php

class Database {
    private static ?PDO $instance = null;

    public static function getConnection(): PDO {
        if (self::$instance === null) {
            // 'db' est le nom du service MySQL dans docker-compose.yml
            $dsn = 'mysql:host=db;dbname=auto;charset=utf8mb4';
            
            self::$instance = new PDO($dsn, 'root', 'root', [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        }
        return self::$instance;
    }
}