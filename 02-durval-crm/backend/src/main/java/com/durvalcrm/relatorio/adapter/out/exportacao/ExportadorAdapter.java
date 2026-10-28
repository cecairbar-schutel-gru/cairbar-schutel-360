package com.durvalcrm.relatorio.adapter.out.exportacao;

import com.durvalcrm.relatorio.application.DocumentoExportacao;
import com.durvalcrm.relatorio.application.ExportadorPort;
import org.springframework.stereotype.Component;

@Component
class ExportadorAdapter implements ExportadorPort {

    @Override
    public byte[] pdf(DocumentoExportacao documento, Emissao emissao) {
        return RelatorioPdf.gerar(documento, emissao);
    }

    @Override
    public byte[] planilha(DocumentoExportacao documento, Emissao emissao) {
        return PlanilhaXlsx.gerar(documento, emissao);
    }
}
