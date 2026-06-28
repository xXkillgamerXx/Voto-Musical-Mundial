# Voto-Musical-Mundial

## Docker local

El backend usa Docker para levantar PostgreSQL, Redis, API, worker y Adminer.

### Levantar servicios

```bash
cd backend
docker compose up -d
```

Servicios:

- API: `http://localhost:4000/api`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Adminer: `http://localhost:8080`

### Entrar a la base con Adminer

Abrir `http://localhost:8080` y usar:

- Sistema: `PostgreSQL`
- Servidor: `postgres`
- Usuario: `votomusicamundial`
- Contraseña: `votomusicamundial`
- Base de datos: `votomusicamundial`

### Apagar servicios

```bash
cd backend
docker compose down
```

Para borrar también los datos locales de PostgreSQL/Redis:

```bash
cd backend
docker compose down -v
```

## Frontend

```bash
npm install
npm run dev
```
