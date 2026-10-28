import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "@mui/material/Link";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import { BrandLogo } from "../../shared/components/BrandLogo";
import { portal } from "../../shared/i18n/pt-BR";
import { brand } from "../../shared/theme";
import { useAccountApi } from "./api";
import { navItems } from "./nav";
import { displayName, initials } from "./profile";
import { useProfile } from "./ProfileContext";

const drawerWidth = 264;

/** Texto só para leitores de tela. */
const visuallyHidden = {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
    border: 0
} as const;

export function PortalLayout() {
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
    const [mobileOpen, setMobileOpen] = useState(false);
    const location = useLocation();

    useEffect(() => {
        setMobileOpen(false);
        const current = navItems.find(item => item.to === location.pathname);
        document.title = current === undefined || current.to === "/" ? portal.productName : `${current.label} · ${portal.productName}`;
    }, [location.pathname]);

    const navigation = (
        <Box component="nav" aria-label="Menu do portal">
            <List sx={{ px: 1 }}>
                {navItems.map(item => (
                    <ListItem key={item.to} disablePadding sx={{ mb: 0.5 }}>
                        <ListItemButton
                            component={NavLink}
                            to={item.to}
                            end={item.to === "/"}
                            sx={{
                                borderRadius: 2,
                                "&.active": {
                                    bgcolor: "action.selected",
                                    color: "primary.dark",
                                    fontWeight: 500,
                                    "& .MuiListItemIcon-root": { color: "primary.main" }
                                }
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                            <ListItemText primary={item.label} />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        </Box>
    );

    return (
        <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
            <Link
                href="#conteudo"
                sx={{
                    position: "absolute",
                    left: 8,
                    top: -48,
                    zIndex: theme.zIndex.tooltip,
                    bgcolor: "background.paper",
                    p: 1,
                    "&:focus": { top: 8 }
                }}
            >
                Pular para o conteúdo
            </Link>

            <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
                <Box sx={{ height: 4, bgcolor: brand.stripe }} aria-hidden />
                <Toolbar sx={{ gap: 1 }}>
                    {!isDesktop && (
                        <IconButton
                            edge="start"
                            aria-label="Abrir menu"
                            aria-expanded={mobileOpen}
                            onClick={() => setMobileOpen(true)}
                        >
                            <MenuIcon />
                        </IconButton>
                    )}
                    {isDesktop ? <BrandLogo height={36} /> : <BrandLogo variant="symbol" height={32} />}
                    <Divider orientation="vertical" flexItem sx={{ mx: 1, my: 1.5, display: { xs: "none", sm: "block" } }} />
                    <Typography variant="h6" component="p" sx={{ flex: 1, fontSize: { xs: "1rem", sm: "1.125rem" } }} noWrap>
                        {portal.productName}
                    </Typography>
                    <UserMenu />
                </Toolbar>
            </AppBar>

            <Drawer
                variant={isDesktop ? "permanent" : "temporary"}
                open={isDesktop || mobileOpen}
                onClose={() => setMobileOpen(false)}
                ModalProps={{ keepMounted: true }}
                sx={{
                    width: { md: drawerWidth },
                    flexShrink: 0,
                    "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box" }
                }}
            >
                <Toolbar sx={{ mt: "4px" }} />
                {navigation}
            </Drawer>

            <Box
                component="main"
                id="conteudo"
                tabIndex={-1}
                sx={{ flexGrow: 1, minWidth: 0, outline: "none", px: { xs: 2, sm: 3, md: 4 }, pb: 6 }}
            >
                <Toolbar sx={{ mt: "4px", mb: 3 }} />
                <Box sx={{ maxWidth: 1080, mx: "auto" }}>
                    <Suspense fallback={<LinearProgress aria-label="Carregando" />}>
                        <Outlet />
                    </Suspense>
                </Box>
            </Box>
        </Box>
    );
}

function UserMenu() {
    const api = useAccountApi();
    const { data: profile } = useProfile();
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const name = profile === undefined ? "" : displayName(profile);

    return (
        <>
            <Button
                color="inherit"
                onClick={event => setAnchor(event.currentTarget)}
                aria-haspopup="menu"
                aria-expanded={anchor !== null}
                aria-controls={anchor !== null ? "menu-usuario" : undefined}
                startIcon={
                    <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main", fontSize: "0.875rem" }} aria-hidden>
                        {initials(name)}
                    </Avatar>
                }
                sx={{ minWidth: 0 }}
            >
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                    {name}
                </Box>
                <Box component="span" sx={visuallyHidden}>
                    menu do usuário
                </Box>
            </Button>
            <Menu id="menu-usuario" anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
                <MenuItem onClick={() => void api.logout()}>
                    <ListItemIcon>
                        <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    {portal.signOut}
                </MenuItem>
            </Menu>
        </>
    );
}
