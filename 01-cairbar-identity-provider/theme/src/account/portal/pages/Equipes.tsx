import Card from "@mui/material/Card";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { groupLabel, portal } from "../../../shared/i18n/pt-BR";
import { useAccountApi, type Group } from "../api";
import { LoadError, LoadingCards } from "../Feedback";
import { useAsync } from "../useAsync";

/** "/voluntarios/biblioteca" → "Voluntários › Biblioteca" */
function breadcrumb(group: Group): string {
    const parts = group.path.split("/").filter(Boolean);
    return parts.map((_, i) => groupLabel["/" + parts.slice(0, i + 1).join("/")] ?? parts[i]).join(" › ");
}

export default function Equipes() {
    const api = useAccountApi();
    const { data, error, loading, reload } = useAsync(signal => api.getGroups(signal));
    const groups = [...(data ?? [])].sort((a, b) => a.path.localeCompare(b.path));

    return (
        <>
            <PageHeader title="Minhas equipes" description="Equipes e áreas da organização das quais você participa." />
            {error !== undefined ? (
                <LoadError onRetry={reload} />
            ) : loading && data === undefined ? (
                <LoadingCards count={1} />
            ) : groups.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={<GroupsOutlinedIcon />}
                        title="Você ainda não faz parte de nenhuma equipe."
                        description={`Para participar, ${portal.correctionHint.charAt(0).toLowerCase()}${portal.correctionHint.slice(1)}`}
                    />
                </Card>
            ) : (
                <Card>
                    <List aria-label="Equipes">
                        {groups.map(group => (
                            <ListItem key={group.path}>
                                <ListItemIcon>
                                    <GroupsOutlinedIcon color="primary" />
                                </ListItemIcon>
                                <ListItemText primary={groupLabel[group.path] ?? group.name} secondary={breadcrumb(group)} />
                            </ListItem>
                        ))}
                    </List>
                </Card>
            )}
        </>
    );
}
