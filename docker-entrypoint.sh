#!/bin/sh
set -e

# The container starts as root only so it can make the mounted data volume
# writable for the unprivileged `node` user (uid 1000) — this is what makes
# bind mounts on NAS/Unraid hosts work regardless of their initial ownership.
# It then drops privileges via gosu (which exec()s without forking, so signals
# and graceful shutdown reach the Node process unchanged).
DATA_DIR="${DATA_DIR:-/data}"
mkdir -p "$DATA_DIR"
chown -R node:node "$DATA_DIR" 2>/dev/null || true

exec gosu node npm start --workspace=server
