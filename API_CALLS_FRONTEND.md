# Documentation des appels API du Frontend

Base URL: `http://localhost:8000`

## Authentification (`/auth`)

### POST `/auth/token`
- **Fichier**: `LoginPage.tsx`
- **Méthode**: POST
- **Headers**: `Content-Type: application/x-www-form-urlencoded`
- **Body**: 
  - `username`
  - `password`
  - `grant_type: password`
  - `scope: ""`
- **Description**: Connexion utilisateur et obtention du token d'accès

### GET `/auth/me`
- **Fichiers**: 
  - `LoginPage.tsx` (après connexion)
  - `UserDashboard.tsx`
  - `SecretaryDashboard.tsx`
  - `TechnicianDashboard.tsx`
  - `DSIDashboard.tsx`
  - `App.tsx`
- **Méthode**: GET
- **Headers**: `Authorization: Bearer {token}`
- **Description**: Récupère les informations de l'utilisateur connecté (id, full_name, email, role, agency)

### GET `/auth/roles`
- **Fichier**: `DSIDashboard.tsx`
- **Méthode**: GET
- **Headers**: `Authorization: Bearer {token}`
- **Description**: Récupère la liste des rôles disponibles

---

## Tickets (`/tickets`)

### GET `/tickets/`
- **Fichiers**: 
  - `SecretaryDashboard.tsx`
  - `DSIDashboard.tsx`
- **Méthode**: GET
- **Headers**: `Authorization: Bearer {token}`
- **Description**: Récupère tous les tickets

### GET `/tickets/me`
- **Fichier**: `UserDashboard.tsx`
- **Méthode**: GET
- **Headers**: `Authorization: Bearer {token}`
- **Description**: Récupère les tickets de l'utilisateur connecté

### GET `/tickets/assigned`
- **Fichier**: `TechnicianDashboard.tsx`
- **Méthode**: GET
- **Headers**: `Authorization: Bearer {token}`
- **Description**: Récupère les tickets assignés au technicien connecté

### GET `/tickets/{ticketId}`
- **Fichiers**: 
  - `UserDashboard.tsx`
  - `SecretaryDashboard.tsx`
  - `TechnicianDashboard.tsx`
  - `DSIDashboard.tsx`
- **Méthode**: GET
- **Headers**: `Authorization: Bearer {token}`
- **Description**: Récupère les détails d'un ticket spécifique

### POST `/tickets/`
- **Fichier**: `UserDashboard.tsx`
- **Méthode**: POST
- **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer {token}`
- **Body**: 
  ```json
  {
    "title": "string",
    "description": "string",
    "priority": "string",
    "type": "string",
    "category": "string" (optionnel)
  }
  ```
- **Description**: Crée un nouveau ticket

### PUT `/tickets/{ticketId}`
- **Fichier**: `UserDashboard.tsx`
- **Méthode**: PUT
- **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer {token}`
- **Body**: 
  ```json
  {
    "title": "string",
    "description": "string",
    "priority": "string",
    "type": "string",
    "category": "string" | null
  }
  ```
- **Description**: Met à jour un ticket

### DELETE `/tickets/{ticketId}`
- **Fichier**: `UserDashboard.tsx`
- **Méthode**: DELETE
- **Headers**: `Authorization: Bearer {token}`
- **Description**: Supprime un ticket

### GET `/tickets/{ticketId}/history`
- **Fichiers**: 
  - `UserDashboard.tsx`
  - `SecretaryDashboard.tsx`
  - `TechnicianDashboard.tsx`
  - `DSIDashboard.tsx`
- **Méthode**: GET
- **Headers**: `Authorization: Bearer {token}`
- **Description**: Récupère l'historique des modifications d'un ticket

### POST `/tickets/{ticketId}/comments`
- **Fichiers**: 
  - `TechnicianDashboard.tsx`
  - `DSIDashboard.tsx`
- **Méthode**: POST
- **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer {token}`
- **Body**: 
  ```json
  {
    "ticket_id": "string",
    "content": "string",
    "type": "string" ("utilisateur" ou autre)
  }
  ```
- **Description**: Ajoute un commentaire à un ticket

### PUT `/tickets/{ticketId}/assign`
- **Fichiers**: 
  - `SecretaryDashboard.tsx`
  - `DSIDashboard.tsx`
- **Méthode**: PUT
- **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer {token}`
- **Body**: 
  ```json
  {
    "technician_id": "string"
  }
  ```
- **Description**: Assigne un ticket à un technicien

### PUT `/tickets/{ticketId}/reassign`
- **Fichiers**: 
  - `SecretaryDashboard.tsx`
  - `DSIDashboard.tsx`
- **Méthode**: PUT
- **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer {token}`
- **Body**: 
  ```json
  {
    "technician_id": "string"
  }
  ```
- **Description**: Réassigne un ticket à un autre technicien

### PUT `/tickets/{ticketId}/status`
- **Fichiers**: 
  - `SecretaryDashboard.tsx`
  - `TechnicianDashboard.tsx`
  - `DSIDashboard.tsx`
- **Méthode**: PUT
- **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer {token}`
- **Body**: 
  ```json
  {
    "status": "string"
  }
  ```
- **Description**: Change le statut d'un ticket

### PUT `/tickets/{ticketId}/validate`
- **Fichier**: `UserDashboard.tsx`
- **Méthode**: PUT
- **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer {token}`
- **Body**: 
  ```json
  {
    "validated": boolean,
    "rejection_reason": "string" (optionnel, si validated = false)
  }
  ```
- **Description**: Valide ou rejette un ticket résolu

### PUT `/tickets/{ticketId}/feedback`
- **Fichier**: `UserDashboard.tsx`
- **Méthode**: PUT
- **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer {token}`
- **Body**: 
  ```json
  {
    "score": number (1-5),
    "comment": "string"
  }
  ```
- **Description**: Ajoute un feedback à un ticket

### PUT `/tickets/{ticketId}/escalate`
- **Fichiers**: 
  - `SecretaryDashboard.tsx`
  - `DSIDashboard.tsx`
- **Méthode**: PUT
- **Headers**: `Authorization: Bearer {token}`
- **Description**: Escalade un ticket (probablement vers un niveau supérieur)

### PUT `/tickets/{ticketId}/reopen`
- **Fichiers**: 
  - `SecretaryDashboard.tsx`
  - `DSIDashboard.tsx`
- **Méthode**: PUT
- **Headers**: `Authorization: Bearer {token}`
- **Description**: Rouvre un ticket clôturé

### PUT `/tickets/{ticketId}/delegate-adjoint`
- **Fichier**: `DSIDashboard.tsx`
- **Méthode**: PUT
- **Headers**: `Authorization: Bearer {token}`
- **Description**: Délègue un ticket à un adjoint

---

## Notifications (`/notifications`)

### GET `/notifications/`
- **Fichiers**: 
  - `UserDashboard.tsx`
  - `SecretaryDashboard.tsx`
  - `TechnicianDashboard.tsx`
  - `DSIDashboard.tsx`
- **Méthode**: GET
- **Headers**: `Authorization: Bearer {token}`
- **Description**: Récupère toutes les notifications de l'utilisateur

### GET `/notifications/unread/count`
- **Fichiers**: 
  - `UserDashboard.tsx`
  - `SecretaryDashboard.tsx`
  - `TechnicianDashboard.tsx`
  - `DSIDashboard.tsx`
- **Méthode**: GET
- **Headers**: `Authorization: Bearer {token}`
- **Description**: Récupère le nombre de notifications non lues

### PUT `/notifications/{notificationId}/read`
- **Fichiers**: 
  - `UserDashboard.tsx`
  - `SecretaryDashboard.tsx`
  - `TechnicianDashboard.tsx`
  - `DSIDashboard.tsx`
- **Méthode**: PUT
- **Headers**: `Authorization: Bearer {token}`
- **Description**: Marque une notification comme lue

---

## Utilisateurs (`/users`)

### GET `/users/`
- **Fichier**: `DSIDashboard.tsx`
- **Méthode**: GET
- **Headers**: `Authorization: Bearer {token}`
- **Description**: Récupère la liste de tous les utilisateurs

### GET `/users/technicians`
- **Fichiers**: 
  - `SecretaryDashboard.tsx`
  - `DSIDashboard.tsx`
- **Méthode**: GET
- **Headers**: `Authorization: Bearer {token}`
- **Description**: Récupère la liste des techniciens

### GET `/users/technicians/{technicianId}/stats`
- **Fichier**: `DSIDashboard.tsx`
- **Méthode**: GET
- **Headers**: `Authorization: Bearer {token}`
- **Description**: Récupère les statistiques d'un technicien (tickets résolus, en cours, etc.)

### GET `/users/{userId}`
- **Fichier**: `DSIDashboard.tsx`
- **Méthode**: GET
- **Headers**: `Authorization: Bearer {token}`
- **Description**: Récupère les détails d'un utilisateur spécifique

### PUT `/users/{userId}`
- **Fichier**: `DSIDashboard.tsx`
- **Méthode**: PUT
- **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer {token}`
- **Body**: Données de l'utilisateur à mettre à jour
- **Description**: Met à jour les informations d'un utilisateur

### DELETE `/users/{userId}`
- **Fichier**: `DSIDashboard.tsx`
- **Méthode**: DELETE
- **Headers**: `Authorization: Bearer {token}`
- **Description**: Supprime un utilisateur

### PUT `/users/{userId}/reset-password`
- **Fichier**: `DSIDashboard.tsx`
- **Méthode**: PUT
- **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer {token}`
- **Body**: Probablement un nouveau mot de passe
- **Description**: Réinitialise le mot de passe d'un utilisateur

---

## Configuration des Tickets (`/ticket-config`)

### GET `/ticket-config/types`
- **Fichier**: `UserDashboard.tsx`
- **Méthode**: GET
- **Headers**: `Authorization: Bearer {token}`
- **Description**: Récupère les types de tickets configurés

### GET `/ticket-config/categories`
- **Fichier**: `UserDashboard.tsx`
- **Méthode**: GET
- **Headers**: `Authorization: Bearer {token}`
- **Description**: Récupère les catégories de tickets configurées

---

## Résumé par rôle

### Utilisateur (`UserDashboard.tsx`)
- GET `/auth/me`
- GET `/tickets/me`
- POST `/tickets/`
- PUT `/tickets/{id}`
- DELETE `/tickets/{id}`
- GET `/tickets/{id}`
- GET `/tickets/{id}/history`
- PUT `/tickets/{id}/validate`
- PUT `/tickets/{id}/feedback`
- GET `/notifications/`
- GET `/notifications/unread/count`
- PUT `/notifications/{id}/read`
- GET `/ticket-config/types`
- GET `/ticket-config/categories`

### Technicien (`TechnicianDashboard.tsx`)
- GET `/auth/me`
- GET `/tickets/assigned`
- GET `/tickets/{id}`
- GET `/tickets/{id}/history`
- PUT `/tickets/{id}/status`
- POST `/tickets/{id}/comments`
- GET `/notifications/`
- GET `/notifications/unread/count`
- PUT `/notifications/{id}/read`

### Secrétaire (`SecretaryDashboard.tsx`)
- GET `/auth/me`
- GET `/tickets/`
- GET `/tickets/{id}`
- GET `/tickets/{id}/history`
- PUT `/tickets/{id}/assign`
- PUT `/tickets/{id}/reassign`
- PUT `/tickets/{id}/status`
- PUT `/tickets/{id}/escalate`
- PUT `/tickets/{id}/reopen`
- GET `/users/technicians`
- GET `/notifications/`
- GET `/notifications/unread/count`
- PUT `/notifications/{id}/read`

### DSI (`DSIDashboard.tsx`)
- GET `/auth/me`
- GET `/auth/roles`
- GET `/tickets/`
- GET `/tickets/{id}`
- GET `/tickets/{id}/history`
- PUT `/tickets/{id}/assign`
- PUT `/tickets/{id}/reassign`
- PUT `/tickets/{id}/status`
- PUT `/tickets/{id}/escalate`
- PUT `/tickets/{id}/reopen`
- PUT `/tickets/{id}/delegate-adjoint`
- POST `/tickets/{id}/comments`
- GET `/users/`
- GET `/users/technicians`
- GET `/users/technicians/{id}/stats`
- GET `/users/{id}`
- PUT `/users/{id}`
- DELETE `/users/{id}`
- PUT `/users/{id}/reset-password`
- GET `/notifications/`
- GET `/notifications/unread/count`
- PUT `/notifications/{id}/read`

---

## Notes importantes

1. **Authentification**: Tous les appels API (sauf `/auth/token`) nécessitent un header `Authorization: Bearer {token}`

2. **Base URL**: Tous les appels utilisent `http://localhost:8000` en dur dans le code

3. **Gestion des erreurs**: 
   - Status 401: Redirection vers la page de connexion
   - Status 403: Affichage d'un message d'erreur spécifique
   - Autres erreurs: Affichage d'un message générique

4. **Rechargement automatique**: 
   - Les notifications sont rechargées automatiquement toutes les 30 secondes dans plusieurs dashboards
   - Les tickets sont parfois rechargés après certaines actions

5. **Timeout**: Les appels dans `LoginPage.tsx` utilisent un timeout de 10 secondes pour la connexion


