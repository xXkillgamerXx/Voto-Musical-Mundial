# new_musicmundial

Stack Docker aparte de produccion (`vote.musicmundial.com`). No toca Apache, `vote_db` ni el compose de vote.

- Noticias: `http://IP:8088/`
- Votar: `http://IP:8088/vote/`
- API: `http://IP:8088/api/health`

Noticias se conectan directo al MySQL del host: `mega` (ES) e `ingles` (EN). No se crea otra base de noticias.
PostgreSQL de vote en este stack nace vacio.
