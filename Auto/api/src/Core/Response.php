<?php
// src/Core/Response.php

class Response {
    public static function json(mixed $data, int $code = 200): never {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit; // Arrête l'exécution après avoir envoyé la réponse
    }

    public static function error(string $message, int $code = 400): never {
        self::json(['error' => $message], $code);
    }
}