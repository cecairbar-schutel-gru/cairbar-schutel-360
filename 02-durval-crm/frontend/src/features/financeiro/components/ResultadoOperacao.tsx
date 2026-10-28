import { Aviso } from '../../../shared/components/Aviso'
import { LinkRota } from '../../../shared/components/LinkRota'
import type { ResultadoLancamento } from '../types'

/** Confirmação de lançamento gravado, com os avisos que não bloqueiam (ex.: banco negativo). */
export function ResultadoOperacao({ titulo, resultado, onFechar }: { titulo: string; resultado: ResultadoLancamento; onFechar(): void }) {
  return (
    <>
      <Aviso tipo="success" titulo={titulo} onFechar={onFechar}>
        <LinkRota to={`/financeiro/lancamentos/${resultado.id}`}>Ver o lançamento nº {resultado.id}</LinkRota>
      </Aviso>
      {resultado.avisos.map((a) => (
        <Aviso key={a} tipo="warning" titulo="Atenção">
          {a}
        </Aviso>
      ))}
    </>
  )
}
