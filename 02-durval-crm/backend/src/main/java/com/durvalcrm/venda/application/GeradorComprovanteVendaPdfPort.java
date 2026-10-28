package com.durvalcrm.venda.application;

public interface GeradorComprovanteVendaPdfPort {

    byte[] gerar(DetalheVenda venda, LayoutComprovante layout);
}
