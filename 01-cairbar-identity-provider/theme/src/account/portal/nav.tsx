import type { ReactNode } from "react";
import AppsOutlinedIcon from "@mui/icons-material/AppsOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import DevicesOutlinedIcon from "@mui/icons-material/DevicesOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";

export const navItems: { to: string; label: string; icon: ReactNode }[] = [
    { to: "/", label: "Início", icon: <HomeOutlinedIcon /> },
    { to: "/meus-dados", label: "Meus dados", icon: <PersonOutlinedIcon /> },
    { to: "/carteirinha", label: "Minha carteirinha", icon: <BadgeOutlinedIcon /> },
    { to: "/seguranca", label: "Segurança", icon: <LockOutlinedIcon /> },
    { to: "/dispositivos", label: "Dispositivos e sessões", icon: <DevicesOutlinedIcon /> },
    { to: "/equipes", label: "Minhas equipes", icon: <GroupsOutlinedIcon /> },
    { to: "/aplicacoes", label: "Aplicações", icon: <AppsOutlinedIcon /> }
];
