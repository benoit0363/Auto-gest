FROM php:8.2-apache

# Installer les extensions PDO MySQL nécessaires pour ton API
RUN docker-php-ext-install pdo pdo_mysql

# Activer la réécriture d'URL (utile pour Apache)
RUN a2enmod rewrite

# Copier le contenu du dossier api dans le serveur web du conteneur
COPY ./api /var/www/html/

# Exposer le port 80
EXPOSE 80