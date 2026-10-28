import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function EmptyState(props: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode }) {
    const { icon, title, description, action } = props;

    return (
        <Box sx={{ textAlign: "center", py: 6, px: 2, color: "text.secondary" }}>
            {icon !== undefined && (
                <Box sx={{ fontSize: 48, color: "primary.light", mb: 1, "& svg": { fontSize: "inherit" } }} aria-hidden>
                    {icon}
                </Box>
            )}
            <Typography variant="h6" component="p" color="text.primary">
                {title}
            </Typography>
            {description !== undefined && <Typography sx={{ mt: 1 }}>{description}</Typography>}
            {action !== undefined && <Box sx={{ mt: 2 }}>{action}</Box>}
        </Box>
    );
}
