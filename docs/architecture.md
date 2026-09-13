# Sukh Breeze Architecture

The repository is split into an independently deployable React client and Express API server.

- `client/src`: presentation, role-specific feature areas, routing, context, API services, and shared UI.
- `server/src`: HTTP composition in `app.js`, process startup in `server.js`, and isolated domain layers.
- `server/src/config`: environment and infrastructure configuration.

Authentication and marketplace business logic are intentionally deferred.
