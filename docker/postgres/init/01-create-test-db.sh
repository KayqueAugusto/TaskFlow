#!/bin/sh
set -eu

test_database="${POSTGRES_TEST_DB:-taskflow_test}"
if [ "$(psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1 FROM pg_database WHERE datname='${test_database}'")" != "1" ]; then
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE DATABASE \"${test_database}\""
fi
