# Production hosting

One-time VPS and domain configuration for the production app. GitHub Actions does not configure DNS or Nginx; it only deploys the app image on the app server.

## Current route

- Public URL: `https://phwng.site`.
- DNS A record: `phwng.site` → `103.75.183.34`.
- Nginx VPS: `103.75.183.34`; vhost file `/etc/nginx/sites-available/phwng.site`, enabled at `/etc/nginx/sites-enabled/phwng.site`.
- The vhost shares the existing Nginx listeners on ports `80` and `443`, selected by `server_name phwng.site`; it does not add another listener port.
- Port `80` serves the Let's Encrypt HTTP-01 challenge and redirects regular requests to HTTPS. Port `443` terminates TLS and proxies to `http://100.82.195.220:17443` through NetBird.
- On the app server, host port `17443` maps to the app container's `8080`. The VPS must remain connected as a NetBird peer, and the NetBird policy must permit the proxy peer to reach the app peer on TCP `17443`.
- Production `.env` on the app server has `COOKIE_SECURE=true` because the public site uses HTTPS.

## Preserve the existing VPS services

- Leave existing Nginx listeners and virtual hosts unchanged. To add a domain, add a dedicated `server_name` block that shares `80/443`; do not assign another VPS listener port to this app.
- Keep the app upstream at port `17443` unless changing both the app server Compose mapping and the Nginx `proxy_pass` together.
- Keep the ACME challenge location and `/var/www/letsencrypt` webroot. Do not remove the Let's Encrypt certificate or disable `certbot.timer`.
- Before editing, inspect listeners with `ss -lntp` and active configuration with `nginx -T`. Run `nginx -t` before `systemctl reload nginx`; reload rather than restart so other sites keep serving.

## Verify

Run on the VPS:

```sh
curl -fsS http://100.82.195.220:17443/api/health
nginx -t
curl -I http://phwng.site
curl -fsS https://phwng.site/api/health
```

The upstream and HTTPS health checks should return `{"ok":true}`; HTTP should redirect to HTTPS. If the upstream check fails, check the VPS NetBird connection and access policy before changing ports.
