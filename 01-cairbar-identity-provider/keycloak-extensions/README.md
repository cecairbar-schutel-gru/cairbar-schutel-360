# Extensões do Keycloak (realm cecairbar)

Decisão em [`docs/adr/0003-provisionamento-person-id-extensao-keycloak.md`](../docs/adr/0003-provisionamento-person-id-extensao-keycloak.md).

- `cecairbar-provisionamento` (event listener): no autocadastro e na criação pela Admin API,
  gera o `personId` (`PER-00000001`, sequência `cecairbar_person_id_seq`) e preenche
  `identityStatus`, `cardStatus`, `fullName` e, no autocadastro, `relationships=[PARTICIPANT]`.
- `META-INF/cecairbar-changelog.xml`: migrações Liquibase versionadas, aplicadas pelo Keycloak
  na inicialização. Nunca altere um changeSet aplicado: crie um novo.

```bash
mvn package   # testes + target/cecairbar-keycloak-extensions.jar (Java 21)
```

O JAR é instalado por `ansible/playbooks/keycloak.yml` (com `--ee false`). Ao trocar a versão
do Keycloak em `ansible/global_vars/main.yml`, atualize `keycloak.version` no `pom.xml`.
