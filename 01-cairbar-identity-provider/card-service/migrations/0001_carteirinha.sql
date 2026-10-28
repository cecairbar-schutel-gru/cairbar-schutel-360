-- Modelo inicial do Serviço de Carteirinha (seção 17.2). Só referências (personId) e dados
-- técnicos do ciclo de vida do passe: o perfil continua no Keycloak (regra 1).

CREATE TABLE digital_card (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id    text NOT NULL UNIQUE CHECK (person_id ~ '^PER-[0-9]{8}$'),
    status       text NOT NULL CHECK (status IN ('NOT_ISSUED', 'ACTIVE', 'SUSPENDED', 'REVOKED')),
    version      integer NOT NULL DEFAULT 1 CHECK (version > 0),
    issued_at    timestamptz,
    suspended_at timestamptz,
    revoked_at   timestamptz,
    created_by   text NOT NULL,
    updated_by   text NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wallet_credential (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    digital_card_id    uuid NOT NULL REFERENCES digital_card (id),
    provider           text NOT NULL CHECK (provider IN ('APPLE', 'GOOGLE')),
    provider_object_id text NOT NULL UNIQUE,
    status             text NOT NULL CHECK (status IN ('ACTIVE', 'REVOKED', 'ERROR')),
    issued_at          timestamptz NOT NULL DEFAULT now(),
    last_updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX wallet_credential_card_idx ON wallet_credential (digital_card_id);

-- Auditoria (RF-013): metadata nunca leva PII, tokens ou o perfil.
CREATE TABLE audit_event (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id       text NOT NULL,
    action         text NOT NULL,
    target_type    text NOT NULL,
    target_id      text NOT NULL,
    result         text NOT NULL CHECK (result IN ('SUCCESS', 'FAILURE')),
    correlation_id text,
    occurred_at    timestamptz NOT NULL DEFAULT now(),
    metadata       jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX audit_event_target_idx ON audit_event (target_type, target_id, occurred_at);
