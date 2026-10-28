package com.durvalcrm.contribuicao.application;

public interface GeradorReciboPdfPort {

    byte[] gerar(Recibo recibo, LayoutRecibo layout);
}
