#!/bin/sh
set -e

# If running as root, fix permissions then try to drop to UID 1000 and exec qdrant
if [ "$(id -u)" = "0" ]; then
    chown -R 1000:1000 /qdrant/storage 2>/dev/null || true
    chown -R 1000:1000 /qdrant 2>/dev/null || true

    # Find a username associated with UID 1000 (if any) and use it to drop privileges
    username=$(awk -F: '$3==1000{print $1; exit}' /etc/passwd 2>/dev/null || true)
    if [ -n "$username" ]; then
        exec su -s /bin/sh "$username" -c "/qdrant/qdrant \"$@\""
    else
        # No username found for UID 1000; start as root (best-effort fallback)
        exec /qdrant/qdrant "$@"
    fi
else
    # Not root: assume permissions already correct and exec directly
    exec /qdrant/qdrant "$@"
fi
