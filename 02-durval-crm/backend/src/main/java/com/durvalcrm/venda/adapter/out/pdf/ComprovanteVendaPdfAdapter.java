package com.durvalcrm.venda.adapter.out.pdf;

import com.durvalcrm.shared.adapter.out.pdf.DocumentoPdf;
import com.durvalcrm.shared.adapter.out.pdf.DocumentoPdf.Estilo;
import com.durvalcrm.shared.adapter.out.pdf.DocumentoPdf.Linha;
import com.durvalcrm.shared.domain.TipoCartao;
import com.durvalcrm.venda.application.DetalheVenda;
import com.durvalcrm.venda.application.GeradorComprovanteVendaPdfPort;
import com.durvalcrm.venda.application.LayoutComprovante;
import com.durvalcrm.venda.domain.MeioPagamento;
import com.durvalcrm.venda.domain.PagamentoVenda;
import com.durvalcrm.venda.domain.StatusVenda;
import com.durvalcrm.venda.domain.Venda;
import java.time.Clock;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Comprovante de venda (US-SALES-008), sem valor fiscal, nos layouts A4 e térmico de 80 mm. Uma
 * venda cancelada leva a marca d'água "CANCELADA".
 */
@Component
class ComprovanteVendaPdfAdapter implements GeradorComprovanteVendaPdfPort {

    static final String SEM_VALOR_FISCAL = "Documento sem valor fiscal";
    private static final Map<MeioPagamento, String> MEIO = Map.of(
            MeioPagamento.DINHEIRO, "Dinheiro", MeioPagamento.PIX, "PIX", MeioPagamento.CARTAO, "Cartão");

    private final DateTimeFormatter dataHora;

    ComprovanteVendaPdfAdapter(Clock relogio) {
        this.dataHora = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm").withZone(relogio.getZone());
    }

    @Override
    public byte[] gerar(DetalheVenda venda, LayoutComprovante layout) {
        return DocumentoPdf.gerar(conteudo(venda), layout == LayoutComprovante.TERMICA,
                venda.status() == StatusVenda.CANCELADA ? "CANCELADA" : null, venda.organizacao().logo());
    }

    private List<Linha> conteudo(DetalheVenda v) {
        List<Linha> l = new ArrayList<>();
        l.add(Linha.de(Estilo.NEGRITO, v.organizacao().nome()));
        if (v.organizacao().cnpj() != null && !v.organizacao().cnpj().isBlank()) {
            l.add(Linha.de(Estilo.PEQUENO, "CNPJ " + v.organizacao().cnpj()));
        }
        l.add(Linha.separador());
        l.add(Linha.de(Estilo.TITULO, "Comprovante de venda"));
        l.add(Linha.de(Estilo.NEGRITO, SEM_VALOR_FISCAL));
        l.add(Linha.valor("Venda nº", String.valueOf(v.numero())));
        l.add(Linha.valor("Data/hora", dataHora.format(v.confirmadaEm())));
        l.add(Linha.separador());
        for (DetalheVenda.Item i : v.itens()) {
            l.add(Linha.de(Estilo.NORMAL, i.produtoNome()));
            l.add(new Linha(Estilo.PEQUENO, i.quantidade() + " × " + Venda.brl(i.precoUnitario()),
                    Venda.brl(i.subtotal())));
        }
        l.add(Linha.separador());
        l.add(new Linha(Estilo.NEGRITO, "Total", Venda.brl(v.total())));
        for (PagamentoVenda p : v.pagamentos()) {
            l.add(Linha.valor(p.meio() == MeioPagamento.CARTAO ? TipoCartao.meio(p.tipoCartao()) : MEIO.get(p.meio()),
                    Venda.brl(p.valor())));
        }
        l.add(Linha.separador());
        l.add(Linha.de(Estilo.PEQUENO, "Vendedor: " + (v.vendedorNome() == null ? "—" : v.vendedorNome())));
        if (v.status() == StatusVenda.CANCELADA) {
            l.add(Linha.de(Estilo.NEGRITO, "CANCELADA em " + dataHora.format(v.canceladaEm()) + ". Motivo: "
                    + v.motivoCancelamento()));
        }
        return l;
    }
}
