namespace Finance.Infrastructure.Persistence;

internal static class PostgresSchema
{
    public const string Initialize = """
        CREATE COLLATION IF NOT EXISTS finance_tr (provider = icu, locale = 'tr-u-kn-true');
        CREATE TABLE IF NOT EXISTS "Users" (
            "Id" uuid PRIMARY KEY,
            "Username" text NOT NULL,
            "NormalizedUsername" text NOT NULL UNIQUE,
            "PasswordHash" text NOT NULL,
            "IsOwner" boolean NOT NULL
        );
        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "TourStarted" boolean NOT NULL DEFAULT true;
        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "CredentialEpoch" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "BootstrapPasswordHash" text;
        CREATE TABLE IF NOT EXISTS "Ledgers" (
            "UserId" uuid PRIMARY KEY REFERENCES "Users" ("Id") ON DELETE CASCADE,
            "Json" text NOT NULL,
            "Version" integer NOT NULL
        );
        CREATE TABLE IF NOT EXISTS "Sessions" (
            "Id" uuid PRIMARY KEY,
            "UserId" uuid NOT NULL REFERENCES "Users" ("Id") ON DELETE CASCADE,
            "ExpiresAt" bigint NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_sessions_user ON "Sessions" ("UserId");
        CREATE INDEX IF NOT EXISTS ix_sessions_expires ON "Sessions" ("ExpiresAt");
        CREATE TABLE IF NOT EXISTS finance_entries (
            user_id uuid NOT NULL REFERENCES "Ledgers" ("UserId") ON DELETE CASCADE,
            collection text NOT NULL,
            ordinal bigint NOT NULL,
            payload jsonb NOT NULL,
            PRIMARY KEY (user_id, collection, ordinal)
        );
        CREATE INDEX IF NOT EXISTS ix_finance_entries_date ON finance_entries
            (user_id, collection, (coalesce(payload->>'date', payload->>'start', payload->>'firstDate')));
        CREATE INDEX IF NOT EXISTS ix_finance_entries_category ON finance_entries
            (user_id, collection, (payload->>'categoryId'));
        CREATE INDEX IF NOT EXISTS ix_finance_entries_card ON finance_entries
            (user_id, collection, (payload->>'cardId'));
        CREATE INDEX IF NOT EXISTS ix_finance_entries_id ON finance_entries
            (user_id, collection, (payload->>'id'));

        CREATE OR REPLACE FUNCTION finance_project_entries() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            INSERT INTO finance_entries (user_id, collection, ordinal, payload)
            SELECT NEW."UserId", fields.key, items.ordinal, items.payload
            FROM jsonb_each(NEW."Json"::jsonb) fields
            CROSS JOIN LATERAL jsonb_array_elements(
                CASE WHEN jsonb_typeof(fields.value) = 'array' THEN fields.value ELSE '[]'::jsonb END
            ) WITH ORDINALITY items(payload, ordinal)
            WHERE fields.key IN ('expenses','incomes','subscriptions','installments','categories','cards','payments','cashPayments')
            ON CONFLICT (user_id, collection, ordinal) DO UPDATE
            SET payload = EXCLUDED.payload WHERE finance_entries.payload IS DISTINCT FROM EXCLUDED.payload;

            DELETE FROM finance_entries e
            WHERE e.user_id = NEW."UserId"
              AND e.ordinal > CASE WHEN jsonb_typeof(NEW."Json"::jsonb -> e.collection) = 'array'
                  THEN jsonb_array_length(NEW."Json"::jsonb -> e.collection) ELSE 0 END;
            RETURN NEW;
        END $$;

        CREATE OR REPLACE TRIGGER project_finance_entries
            AFTER INSERT OR UPDATE OF "Json" ON "Ledgers"
            FOR EACH ROW EXECUTE FUNCTION finance_project_entries();
        """;
}
