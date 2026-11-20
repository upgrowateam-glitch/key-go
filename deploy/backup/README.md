# KeyGo backups (Google Drive, encrypted)

Every night the VPS backs up KeyGo to the Google Drive folder **KeyGo-Backups**, encrypted:

| What | How | Kept |
|---|---|---|
| Database (`keygo-db`) | Full compressed dump every night | 7 days on the VPS (`/opt/keygo-backups/db`), 14 days in Drive |
| Uploaded files (photos, documents, signatures) | Only new / changed files are uploaded | Always; deleted files stay 14 more days |
| GPS data (Traccar) | Same as files | Same as files |

Only KeyGo's containers and volumes are read. Other apps on the VPS are not touched.
Google sees only scrambled names and contents. **Without the two encryption passwords the backups cannot be opened.**

---

## One-time setup

### 1. Install rclone (on the VPS)

```bash
curl -fsSL https://rclone.org/install.sh | sudo bash
rclone version
```

### 2. Connect the Google account (opens Google in your computer's browser)

From **your computer**, open a second SSH connection with a tunnel (replace the IP if needed):

```bash
ssh -L 53682:localhost:53682 root@200.234.40.193
```

In that SSH window run `rclone config` and answer:

| Question | Answer |
|---|---|
| `n/s/q>` | `n` (new remote) |
| `name>` | `keygo-gdrive` |
| `Storage>` | `drive` |
| `client_id>` / `client_secret>` | press Enter (leave empty) |
| `scope>` | `3` (drive.file — rclone can only see the files it creates) |
| `service_account_file>` | press Enter |
| `Edit advanced config?` | `n` |
| `Use web browser to automatically authenticate?` | `y` |

rclone prints a link like `http://127.0.0.1:53682/auth?state=…`. Open it **in your computer's browser**,
sign in with the **backup Google account**, and click **Allow**. Then answer `n` to "shared drive" and `y` to keep the remote.

### 3. Add encryption

Still in `rclone config`:

| Question | Answer |
|---|---|
| `n/s/q>` | `n` |
| `name>` | `keygo-backup` |
| `Storage>` | `crypt` |
| `remote>` | `keygo-gdrive:KeyGo-Backups` |
| `filename_encryption>` | `1` (standard) |
| `directory_name_encryption>` | `1` (true) |
| `y/g/n>` (password) | `g` then `1024`, then `y` to use it |
| `y/g/n>` (salt / password2) | `g` then `1024`, then `y` |
| `Edit advanced config?` | `n` |
| Keep this remote? | `y`, then `q` to quit |

**Write both generated passwords down and keep them safe (not on the VPS only).**
To see them again later: `rclone config show keygo-backup` (they are shown obscured; keep your own copy).

### 4. Test once by hand

```bash
bash /opt/keygo/deploy/backup/keygo-backup.sh
rclone ls keygo-backup: | head
```

The last line of the first command should be `Backup finished.` In Google Drive you will see a folder **KeyGo-Backups** with scrambled names.

### 5. Run it every night

```bash
echo '30 20 * * * root bash /opt/keygo/deploy/backup/keygo-backup.sh >> /var/log/keygo-backup.log 2>&1' | sudo tee /etc/cron.d/keygo-backup
```

`30 20` is 20:30 UTC = **2:00 AM India time** (check the VPS clock with `timedatectl`).

---

## Everyday checks

```bash
tail -n 20 /var/log/keygo-backup.log      # last run: should end with "Backup finished."
rclone ls keygo-backup:db                 # database copies in Drive
rclone about keygo-gdrive:                # Google Drive space used / free
```

---

## Restore (only when something went wrong)

**Database** — newest local dump, or download one from Drive first:

```bash
ls -lt /opt/keygo-backups/db | head                       # or: rclone copy keygo-backup:db/<name>.dump /opt/keygo-backups/db
cd /opt/keygo/deploy && docker compose stop api
docker exec -i -e PGPASSWORD="$(grep ^DB_PASSWORD= .env | cut -d= -f2-)" keygo-db \
  pg_restore -h 127.0.0.1 -p "$(grep ^DB_PORT= .env | cut -d= -f2-)" -U keygo -d keygo --clean --if-exists < /opt/keygo-backups/db/<name>.dump
docker compose start api
```

**Uploaded files:**

```bash
rclone copy keygo-backup:files "$(docker volume inspect -f '{{ .Mountpoint }}' keygo_keygo-storage)"
```

Never use `docker compose down -v` — the `-v` deletes KeyGo's data volumes.

**Then check the identity documents open:**

```bash
docker exec keygo-api npm run keys:verify
```

It should end with "Everything opens." If it says a key is missing, see the next section.

## The encryption key (read this once)

ID cards, licences, face photos and Aadhaar numbers are encrypted by the KeyGo server with `DATA_ENCRYPTION_KEY`
(in `/opt/keygo/deploy/.env`). The backups contain the encrypted files and the database, **but not this key** —
on purpose, so a stolen backup cannot be read. That means:

- **Keep a copy of `DATA_ENCRYPTION_KEY` outside the server**: in a password manager, and/or written on paper kept
  safe. Also keep the rclone encryption passwords from step 3 the same way.
- **To restore** on this or a new server: restore the database and files (above), put the same
  `DATA_ENCRYPTION_KEY` in `.env`, start KeyGo, then run `docker exec keygo-api npm run keys:verify`.
- **Never just change the key.** To replace it: put the old key in `DATA_ENCRYPTION_OLD_KEYS=` (comma separated if
  there are several), the new one in `DATA_ENCRYPTION_KEY=`, then `docker compose up -d api`. On start-up the
  server re-encrypts everything with the new key. Run `keys:verify`; once it says "Everything opens" and the new
  key is safely stored, the old key can be removed from `DATA_ENCRYPTION_OLD_KEYS`.
- Every encrypted item records a short fingerprint of the key that made it (e.g. `3f9a12bc04`), so `keys:verify`
  and the server log say exactly which key is needed. The fingerprint does not reveal the key.
- If the server starts with the wrong key, it does not lose anything: it refuses to open or add identity documents
  and logs which key it needs, until the right key is back.
