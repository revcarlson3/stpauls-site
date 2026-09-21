# Beta VPS setup

The `beta` GitHub Actions workflow deploys source to `/var/www/mychurch`, builds it with Node 22, and restarts the `stpauls-site` systemd service. Keep the production `.env` and `storage` directory on the VPS; the workflow intentionally does not overwrite them.

## Initial Ubuntu setup

Run these commands on the VPS as an administrator, changing the deployment user and domain as needed:

```bash
sudo adduser --disabled-password --gecos "" mychurch
sudo mkdir -p /var/www/mychurch
sudo chown -R mychurch:mychurch /var/www/mychurch
```

Install Node 22 LTS, PostgreSQL, and a reverse proxy such as Nginx. Copy `.env.example` to `/var/www/mychurch/.env` and set:

```text
DATABASE_URL=postgresql://...
NEXTAUTH_URL=https://beta.example.org
NEXTAUTH_SECRET=<unique-production-secret>
```

Run the initial database setup as the deployment user:

```bash
sudo -iu mychurch
cd /var/www/mychurch
npm ci
npm run deployment:check
npm run db:generate
npm run db:push
exit
```

Install and enable the service:

```bash
sudo cp /var/www/mychurch/deploy/stpauls-site.service /etc/systemd/system/stpauls-site.service
sudo systemctl daemon-reload
sudo systemctl enable --now stpauls-site
```

Allow the deployment user to restart only this service without a password by creating `/etc/sudoers.d/stpauls-site`:

```text
mychurch ALL=(root) NOPASSWD: /usr/bin/systemctl restart stpauls-site
```

Validate the file before saving the configuration:

```bash
sudo visudo -cf /etc/sudoers.d/stpauls-site
```

## GitHub environment secrets

Create a GitHub environment named `beta` and add these secrets:

| Secret | Value |
|---|---|
| `BETA_DEPLOY_HOST` | VPS hostname or IP |
| `BETA_DEPLOY_USER` | `mychurch` |
| `BETA_DEPLOY_KEY` | Private SSH key used only by GitHub Actions |
| `BETA_DEPLOY_KNOWN_HOSTS` | Output of `ssh-keyscan -H <host>` reviewed before saving |

Optional secrets:

- `BETA_DEPLOY_PORT` — defaults to `22`
- `BETA_DEPLOY_PATH` — defaults to `/var/www/mychurch`

The matching public key must be in `/home/mychurch/.ssh/authorized_keys` on the VPS. Do not commit the private key, `.env`, database URL, or application secrets to the repository.
