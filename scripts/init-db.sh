#!/bin/bash

# Load environment variables
if [ -f .env.local ]; then
  export $(cat .env.local | xargs)
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
  exit 1
fi

# Run the schema setup SQL
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" << EOF
$(cat lib/schema.sql)
EOF

echo "✅ Database schema initialized successfully"
