# OPERA Config Manager

Aplicación independiente para gestionar, versionar, validar y desplegar configuraciones OPERA Cloud.

## Objetivo

Este proyecto está preparado para funcionar como aplicación independiente, con su propio backend, frontend, esquema Oracle y configuración de despliegue.

La aplicación se conecta al esquema Oracle:

OPERA_CFG_APP

## Estructura

backend/      API Node.js + Express
frontend/     HTML, CSS y JavaScript sin framework inicial
database/     Scripts SQL y migraciones
deploy/       Ejemplos para systemd y Nginx
docs/         Documentación operativa
wallet/       Carpeta local para wallet Oracle, no versionar contenido real

## Primer arranque local

1. Copiar backend/.env.example a backend/.env
2. Ajustar DB_USER, DB_PASSWORD, DB_CONNECT_STRING y DB_WALLET_DIR
3. Instalar dependencias en backend
4. Arrancar backend
5. Abrir frontend/login.html o servir frontend desde Nginx/Express

## Seguridad

No subir nunca a Git:

- backend/.env
- wallet real
- passwords
- certificados privados
- logs con datos sensibles
