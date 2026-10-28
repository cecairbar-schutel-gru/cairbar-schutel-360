import type { Meta, StoryObj } from "@storybook/react";
import { createMockAccountApi, mockProfile } from "./mocks";
import { Portal } from "./Portal";

const meta = {
    title: "account/Comunidade Cairbar",
    component: Portal,
    parameters: { layout: "fullscreen" },
    args: { api: createMockAccountApi(), basename: "", initialPath: "/" }
} satisfies Meta<typeof Portal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inicio: Story = {};

export const IdentidadeSuspensa: Story = {
    args: {
        api: createMockAccountApi({
            profile: mockProfile({ identityStatus: ["SUSPENDED"], cardStatus: ["SUSPENDED"], relationships: [] })
        })
    }
};

export const MeusDados: Story = { args: { initialPath: "/meus-dados" } };

export const Carteirinha: Story = { args: { initialPath: "/carteirinha" } };

export const CarteirinhaNaoEmitida: Story = {
    args: { initialPath: "/carteirinha", api: createMockAccountApi({ profile: mockProfile({ cardStatus: ["NOT_ISSUED"] }) }) }
};

export const CarteirinhaGoogleIndisponivel: Story = {
    args: {
        initialPath: "/carteirinha",
        api: createMockAccountApi({ profile: mockProfile({ cardStatus: ["NOT_ISSUED"] }), cardError: "GOOGLE_WALLET_UNAVAILABLE" })
    }
};

export const CarteirinhaRevogada: Story = {
    args: { initialPath: "/carteirinha", api: createMockAccountApi({ profile: mockProfile({ cardStatus: ["REVOKED"] }) }) }
};

export const Seguranca: Story = { args: { initialPath: "/seguranca" } };

export const Dispositivos: Story = { args: { initialPath: "/dispositivos" } };

export const Equipes: Story = { args: { initialPath: "/equipes" } };

export const EquipesVazio: Story = { args: { initialPath: "/equipes", api: createMockAccountApi({ empty: true }) } };

export const Aplicacoes: Story = { args: { initialPath: "/aplicacoes" } };

export const ErroDeCarregamento: Story = { args: { api: createMockAccountApi({ failing: true }) } };
