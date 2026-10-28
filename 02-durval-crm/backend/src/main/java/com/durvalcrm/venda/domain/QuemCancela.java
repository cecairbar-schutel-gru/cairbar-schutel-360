package com.durvalcrm.venda.domain;

import com.durvalcrm.shared.domain.RegraDeNegocioException;
import java.util.Objects;

/**
 * Quem pode cancelar cada venda (US-SALES-009 e US-SALES-022): o Administrador cancela qualquer uma;
 * o Tesoureiro, as do PDV da cantina; o Vendedor, as que fez; o perfil PDV, só a última venda que ele
 * mesmo registrou, sem prazo. Se essa última já estiver cancelada, não há o que cancelar: a anterior
 * não passa a ser cancelável, para não se cancelar em cadeia.
 *
 * @param ultimaDoUsuarioId id da venda mais recente registrada pelo usuário, qualquer que seja a
 *        situação; {@code null} se ele nunca vendeu (só consultado para o perfil PDV)
 */
public record QuemCancela(String subject, boolean administrador, boolean tesoureiro, boolean vendedor, boolean pdv,
        Long ultimaDoUsuarioId) {

    public void exigirQuePodeCancelar(Venda venda) {
        if (administrador || (tesoureiro && venda.isPdv())) {
            return;
        }
        boolean propria = subject.equals(venda.getVendedorSubject());
        if (vendedor && propria) {
            return;
        }
        if (pdv && propria && venda.isPdv()) {
            if (Objects.equals(ultimaDoUsuarioId, venda.getId())) {
                return;
            }
            throw new RegraDeNegocioException("NAO_E_ULTIMA_VENDA_PDV",
                    "No PDV só a última venda registrada por você pode ser cancelada.");
        }
        throw new RegraDeNegocioException("VENDA_DE_OUTRO_VENDEDOR", "Esta venda foi feita por outro vendedor.");
    }
}
