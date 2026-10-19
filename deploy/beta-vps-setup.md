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

## Encrypted database backups

The **Backup beta database** workflow is manual-only and must be dispatched from the `beta` branch. It reads the deployed `.env`, streams a read-only custom-format `pg_dump` to the runner, encrypts it to the supplied public age recipient, and uploads only the `.age` file for one day. It does not deploy, restart services, run Prisma, or restore/write database data.

This backup contains sensitive, production-like data. Keep the age identity and any decrypted dump in restricted local storage. Never commit either one or upload plaintext to GitHub.

GitHub registers `workflow_dispatch` workflows from the repository's default branch. If this workflow is not yet present on `main`, carry the same workflow definition to `main` without changing its `beta` branch guard; all backup runs still use the `beta` ref and environment.

1. In GitHub, open **Actions → Backup beta database → Run workflow**, select `beta`, and enter the intended public `age1...` recipient. Never enter an age private key or passphrase. The equivalent CLI command is:

   ```bash
   gh workflow run backup-beta-database.yml --ref beta \
     -f age_recipient='age1...'
   ```

2. After the run succeeds, download its one-day artifact:

   ```bash
   gh run download RUN_ID --name beta-postgres-backup-RUN_ID
   ```

3. Decrypt and validate the dump locally:

   ```bash
   umask 077
   age --decrypt \
     --identity /secure/path/beta-backup-identity.txt \
     --output beta-postgres.dump \
     beta-postgres.dump.age
   pg_restore --list beta-postgres.dump >/dev/null
   ```

4. Restore only into a disposable local PostgreSQL database. The `--clean` option is destructive to the selected database:

   ```bash
   createdb stpauls_beta_restore
   pg_restore \
     --exit-on-error \
     --single-transaction \
     --clean \
     --if-exists \
     --no-owner \
     --no-acl \
     --dbname=stpauls_beta_restore \
     beta-postgres.dump
   ```

Delete the plaintext dump as soon as validation or local restoration is complete. Secure deletion is best-effort on SSDs and hosted runners; encryption and short-lived plaintext handling remain the primary controls.
