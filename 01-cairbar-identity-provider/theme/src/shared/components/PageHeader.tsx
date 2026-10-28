import type { ReactNode } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export function PageHeader(props: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
    const { title, description, action } = props;

    return (
        <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ mb: 3, alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between" }}
        >
            <div>
                <Typography variant="h1" component="h1" sx={{ fontSize: { xs: "1.5rem", sm: "2rem" } }}>
                    {title}
                </Typography>
                {description !== undefined && (
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                        {description}
                    </Typography>
                )}
            </div>
            {action}
        </Stack>
    );
}
