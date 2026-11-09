#!/bin/bash
set -euo pipefail
mongosh --quiet --host 127.0.0.1 "$MONGO_INITDB_DATABASE" \
  --username "$MONGO_INITDB_ROOT_USERNAME" \
  --password "$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  --eval "db.createUser({user: '$MONGO_APP_USER', pwd: '$MONGO_APP_PASSWORD', roles: [{role: 'readWrite', db: '$MONGO_INITDB_DATABASE'}]})"