package com.durvalcrm.doador.application;

import java.util.List;

public record PossivelDuplicata(ResumoDoador doador, List<MotivoDuplicidade> motivos) {
}
