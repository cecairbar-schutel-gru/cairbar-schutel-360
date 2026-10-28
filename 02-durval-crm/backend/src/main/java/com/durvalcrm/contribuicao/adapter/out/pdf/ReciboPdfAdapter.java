package com.durvalcrm.contribuicao.adapter.out.pdf;

import com.durvalcrm.contribuicao.application.GeradorReciboPdfPort;
import com.durvalcrm.contribuicao.application.LayoutRecibo;
import com.durvalcrm.contribuicao.application.Recibo;
import com.durvalcrm.contribuicao.domain.CompetenciaPaga;
import com.durvalcrm.contribuicao.domain.MeioPagamento;
import com.durvalcrm.contribuicao.domain.Pagamento;
import com.durvalcrm.contribuicao.domain.StatusContribuicao;
import com.durvalcrm.contribuicao.domain.TipoContribuicao;
import com.durvalcrm.contribuicao.domain.Valores;
import com.durvalcrm.shared.adapter.out.pdf.DocumentoPdf;
import com.durvalcrm.shared.adapter.out.pdf.DocumentoPdf.Estilo;
import com.durvalcrm.shared.adapter.out.pdf.DocumentoPdf.Linha;
import com.durvalcrm.shared.domain.TipoCartao;
import java.time.Clock;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Recibo em PDF (US-CONTRIB-009) nos layouts A4 e térmico de 80 mm. Um recibo cancelado leva a
 * marca d'água "CANCELADO".
 */
@Component
class ReciboPdfAdapter implements GeradorReciboPdfPort {

    private static final Map<MeioPagamento, String> MEIO = Map.of(
            MeioPagamento.DINHEIRO, "Dinheiro", MeioPagamento.PIX, "PIX", MeioPagamento.CARTAO, "Cartão");

    private final Clock relogio;
    private final DateTimeFormatter dataHora;

    ReciboPdfAdapter(Clock relogio) {
        this.relogio = relogio;
        this.dataHora = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm").withZone(relogio.getZone());
    }

    @Override
    public byte[] gerar(Recibo recibo, LayoutRecibo layout) {
        return DocumentoPdf.gerar(conteudo(recibo), layout == LayoutRecibo.TERMICA,
                recibo.status() == StatusContribuicao.CANCELADA ? "CANCELADO" : null, recibo.organizacao().logo());
    }

    private List<Linha> conteudo(Recibo r) {
        List<Linha> l = new ArrayList<>();
        l.add(Linha.de(Estilo.NEGRITO, r.organizacao().nome()));
        if (r.organizacao().cnpj() != null && !r.organizacao().cnpj().isBlank()) {
            l.add(Linha.de(Estilo.PEQUENO, "CNPJ " + r.organizacao().cnpj()));
        }
        if (r.organizacao().endereco() != null && !r.organizacao().endereco().isBlank()) {
            l.add(Linha.de(Estilo.PEQUENO, r.organizacao().endereco()));
        }
        l.add(Linha.separador());
        l.add(Linha.de(Estilo.TITULO, "Recibo de contribuição"));
        l.add(Linha.valor("Nº", r.numero()));
        l.add(Linha.valor("Data/hora", dataHora.format(r.recebidaEm())));
        if (r.segundaVia()) {
            l.add(Linha.de(Estilo.NEGRITO, "2ª via, emitida em " + dataHora.format(Instant.now(relogio))
                    + ". Original de " + dataHora.format(r.recebidaEm()) + "."));
        }
        l.add(Linha.valor("Doador", r.doadorNome()));
        l.add(Linha.separador());

        if (!r.competencias().isEmpty()) {
            l.add(Linha.de(Estilo.NEGRITO, "Competências pagas"));
            for (CompetenciaPaga c : r.competencias()) {
                l.add(Linha.valor(String.format("%02d/%d", c.mes().getMonthValue(), c.mes().getYear()),
                        Valores.brl(c.valor())));
            }
        }
        if (r.valorDoacao().signum() > 0) {
            l.add(Linha.valor(r.tipo() == TipoContribuicao.DOACAO_ANONIMA ? "Doação anônima" : "Doação extraordinária",
                    Valores.brl(r.valorDoacao())));
        }
        l.add(Linha.separador());
        l.add(Linha.de(Estilo.NEGRITO, "Formas de pagamento"));
        for (Pagamento p : r.pagamentos()) {
            String meio = p.meio() == MeioPagamento.CARTAO ? TipoCartao.meio(p.tipoCartao()) : MEIO.get(p.meio());
            l.add(Linha.valor(meio + " (" + p.contaNome() + ")", Valores.brl(p.valor())));
        }
        l.add(new Linha(Estilo.NEGRITO, "Total", Valores.brl(r.total())));
        l.add(Linha.separador());
        if (r.observacao() != null) {
            l.add(Linha.de(Estilo.PEQUENO, "Observação: " + r.observacao()));
        }
        l.add(Linha.de(Estilo.PEQUENO, "Operador: " + r.operadorNome()));
        if (r.status() == StatusContribuicao.CANCELADA) {
            l.add(Linha.de(Estilo.NEGRITO, "CANCELADO em " + dataHora.format(r.canceladaEm()) + ". Motivo: "
                    + r.motivoCancelamento()));
        }
        if (r.organizacao().rodape() != null && !r.organizacao().rodape().isBlank()) {
            l.add(Linha.de(Estilo.PEQUENO, r.organizacao().rodape()));
        }
        return l;
    }
}
