import Chip, { type ChipProps } from "@mui/material/Chip";
import {
    cardStatusLabel,
    identityStatusLabel,
    type CardStatus,
    type IdentityStatus
} from "../i18n/pt-BR";

type Props =
    | { kind: "identity"; status: string | undefined; size?: ChipProps["size"] }
    | { kind: "card"; status: string | undefined; size?: ChipProps["size"] };

const color: Record<string, ChipProps["color"]> = {
    ACTIVE: "success",
    SUSPENDED: "warning",
    REVOKED: "error",
    INACTIVE: "error",
    NOT_ISSUED: "default"
};

/** Situação da identidade ou da carteirinha, sempre com texto (não depende só da cor). */
export function StatusChip(props: Props) {
    const { kind, status, size = "medium" } = props;

    if (status === undefined || status === "") {
        return <Chip size={size} variant="outlined" label="Não informada" />;
    }

    const label =
        kind === "identity"
            ? (identityStatusLabel[status as IdentityStatus] ?? status)
            : (cardStatusLabel[status as CardStatus] ?? status);

    return <Chip size={size} variant="outlined" color={color[status] ?? "default"} label={label} />;
}
