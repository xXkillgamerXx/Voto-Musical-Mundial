# Firestore Vote Scaling

Este proyecto mantiene Firestore como base de datos unica para votaciones. El camino critico de votos usa lotes locales, shards por concursante y snapshots publicos agregados para evitar hotspots y reducir lecturas en tiempo real.

## Flujo De Escritura

1. El cliente agrupa votos por `pollId + roundId + artistId + userId` durante 1.5 segundos.
2. Cada lote descuenta puntos del usuario en una transaccion.
3. El lote incrementa un documento `voteShards/{artistId}_{shardIndex}`.
4. El lote crea un registro de auditoria en `userVoteBatches`.
5. El agregador escribe `publicResults/current` cada 1-2 segundos desde el panel admin o desde un worker dedicado.

## Shards Recomendados

| Concurrentes | Shards Por Ronda | Intervalo De Snapshot |
| --- | ---: | ---: |
| 10.000 | 128 | 1s |
| 50.000 | 512 | 1-2s |
| 100.000 | 1.024 | 2s |
| 200.000 | 2.048 | 2-5s adaptativo |

## Lecturas

- Los clientes publicos escuchan `publicResults/current`, no `votes`.
- Home usa `polls` activos con campos materializados (`totalVotes`, `leaderArtistId`, `leaderVotes`, `publicActivity`).
- Rankings usan campos materializados en `artists` (`followersCount`, `totalVotes`, `popularityScore`).
- Admin usa `publicResults/current` y `recentActivity`, no listeners completos a `votes` ni `users`.

## Operacion

- Mantener un admin monitor abierto durante una votacion activa permite refrescar `publicResults/current`.
- Para produccion de alto trafico, mover `startPublicResultsAggregator` a un worker/backend con credenciales admin y el mismo intervalo.
- Si hay picos fuertes, subir shards antes del evento y aumentar el intervalo del snapshot a 3-5 segundos.
- No volver a escribir votos directos en `contestants.votes`; esos documentos quedan como metadatos y fallback historico.

## Ahorro Esperado

- Rachas de votos del mismo usuario: 70%-90% menos transacciones.
- Resultados publicos: hasta 1.000x-2.000x menos fanout frente a emitir un cambio por voto a todos los clientes.
- Rankings/home: elimina lecturas `polls x rounds x contestants` en cada carga.
- Admin: pasa de `O(totalVotes + totalUsers)` a `O(contestants + recentActivityLimit)`.
