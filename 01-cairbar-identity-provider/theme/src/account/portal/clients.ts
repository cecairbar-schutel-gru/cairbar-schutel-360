/** Nomes amigáveis dos clientes internos do Keycloak (o clientName deles vem como ${chave}). */
const builtInClients: Record<string, string> = {
    "account-console": "Comunidade Cairbar",
    account: "Conta (Keycloak)",
    "security-admin-console": "Console de administração"
};

export function clientLabel(client: { clientId: string; clientName?: string }): string {
    const name = client.clientName;
    if (name && !name.startsWith("${")) return name;
    return builtInClients[client.clientId] ?? client.clientId;
}
