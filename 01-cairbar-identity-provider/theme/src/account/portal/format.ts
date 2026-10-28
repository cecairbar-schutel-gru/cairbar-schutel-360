const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" });

/** Sessões da Account API usam segundos; credenciais e consentimentos, milissegundos. */
export function formatSeconds(epochSeconds: number): string {
    return dateTime.format(new Date(epochSeconds * 1000));
}

export function formatMillis(epochMillis: number): string {
    return dateTime.format(new Date(epochMillis));
}

/** Data ISO (aaaa-mm-dd) do atributo birthDate, sem deslocamento de fuso. */
export function formatIsoDate(iso: string): string {
    const date = new Date(`${iso}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? iso : dateOnly.format(date);
}
