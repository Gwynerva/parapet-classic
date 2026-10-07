# Test server

The test server runs on a VPS shared with other sites. Their Caddy runs in Docker and owns
ports 80 and 443; Parapet plugs into it without touching the other sites.

```
browser ──https──▶ Caddy (container) ──http──▶ 172.18.0.1:8787  node packages/server/src/main.ts
                                                                  ├─ /api/*  leaderboard API
                                                                  └─ /*      built client (www/)
```

- **Process:** `parapet.service` (systemd, user `parapet`) runs the server straight from its
  TypeScript sources; Node 24 strips the types. It listens only on the Docker bridge address,
  so Caddy reaches it and the internet does not.
- **Code:** `/opt/parapet/releases/<id>` (owned by root, read-only for the service), with
  `/opt/parapet/current` pointing at the live one. The five newest releases are kept.
- **Data:** `/var/lib/parapet/runs.json` and `names.json` (`DATA_DIR`), outside the releases.
- **Logs:** `journalctl -u parapet`.

## Deploying

```bash
npm run deploy
```

builds the client, packs `www/` with the server, `sim`, `protocol` and the generated game data,
uploads it over SSH to `parapet-vps` (an alias in `~/.ssh/config`; override with `DEPLOY_HOST`),
switches `current` to it, restarts the service and waits for `/api/health`. `--no-build` reuses
the existing `packages/classic/dist`.

Rollback: point `current` at an older release and restart.

```bash
ssh parapet-vps 'ls /opt/parapet/releases'
ssh parapet-vps 'ln -sfn /opt/parapet/releases/<id> /opt/parapet/current && systemctl restart parapet'
```

## One-time setup (already done)

1. DNS: an `A` record for the test domain pointing at the VPS.
2. `useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin parapet`,
   `mkdir -p /opt/parapet/releases`.
3. [`parapet.service`](parapet.service) → `/etc/systemd/system/`, then
   `systemctl daemon-reload && systemctl enable parapet`.
4. Firewall: let the Caddy container reach the port on the bridge
   (`ufw allow in on <bridge interface> from 172.18.0.0/16 to 172.18.0.1 port 8787 proto tcp`).
5. `npm run deploy` for the first release.
6. [`parapet.caddy`](parapet.caddy) → the `sites/` directory the Caddy container's Caddyfile
   imports (`import sites/*.caddy`), then validate and reload gracefully, which keeps the other sites up:

   ```bash
   docker exec <caddy container> caddy validate --config /runtime/Caddyfile --adapter caddyfile
   docker exec <caddy container> caddy reload --config /runtime/Caddyfile --adapter caddyfile
   ```

   Caddy obtains the certificate on the first request.
