import { Alert, MenuItem, Table, TableBody, TableContainer, TableCell, TableFooter, TableHead, TableRow, TextField, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { LinhaAcoes, Pilha, TextoSuave } from '../../../shared/components/layout'
import { formatarData, hoje, paraIsoData } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { BotaoImprimir, CabecalhoDocumento, EstiloImpressao } from '../components/Impressao'
import { relatorioService } from '../../relatorios/services'
import { BotaoExportar } from '../../../shared/components/BotaoExportar'
import { TabelaObrigacoes } from '../components/TabelaObrigacoes'
import { TabelaPagamentos } from '../components/TabelaPagamentos'
import { deslocarMes, nomeDoMes } from '../regras'
import { editoraService } from '../services'

const somar = (valores: number[]) => valores.reduce((s, v) => s + v, 0)

function LinhaValor({ rotulo, valor, sinal, forte }: { rotulo: string; valor: number; sinal?: '+' | '−' | '='; forte?: boolean }) {
  return (
    <TableRow>
      <TableCell sx={{ fontWeight: forte ? 'bold' : undefined }}>
        {sinal && `${sinal} `}
        {rotulo}
      </TableCell>
      <TableCell align="right" sx={{ fontWeight: forte ? 'bold' : undefined }}>
        {formatarMoeda(valor)}
      </TableCell>
    </TableRow>
  )
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Pilha spacing={1}>
      <Typography variant="h6" component="h3">
        {titulo}
      </Typography>
      {children}
    </Pilha>
  )
}

/**
 * Apuração mensal por editora (US-PUBLISHER-007), para as duas partes concordarem antes do
 * pagamento: seção financeira, seção de estoque por remessa e título, e as linhas de detalhe.
 * O saldo transferido do mês anterior (US-PUBLISHER-010) aparece no saldo inicial.
 */
export function ApuracaoPage() {
  const editoraId = Number(useParams().id)
  const [parametros, setParametros] = useSearchParams()
  const atual = paraIsoData(hoje()).slice(0, 7)
  const mes = /^\d{4}-\d{2}$/.test(parametros.get('mes') ?? '') ? parametros.get('mes')! : atual
  const { dados: a, carregando, erro } = useCarregamento(() => editoraService.apuracao(editoraId, mes), [editoraId, mes])
  const meses = Array.from({ length: 12 }, (_, i) => deslocarMes(atual, -i))

  return (
    <Pilha component="section" aria-label={`Apuração de ${nomeDoMes(mes)}`}>
      <EstiloImpressao />
      <LinhaAcoes data-nao-imprimir sx={{ justifyContent: 'space-between' }}>
        <LinkRota to={`/editoras/${editoraId}/saldo`}>Voltar ao saldo da editora</LinkRota>
        <LinhaAcoes>
          <TextField select size="small" label="Mês" value={mes} onChange={(e) => setParametros({ mes: e.target.value }, { replace: true })}>
            {(meses.includes(mes) ? meses : [mes, ...meses]).map((m) => (
              <MenuItem key={m} value={m}>
                {nomeDoMes(m)}
              </MenuItem>
            ))}
          </TextField>
          <BotaoImprimir />
          <BotaoExportar exportar={(formato) => relatorioService.exportar('apuracao-editora', formato, { editoraId, mes })} />
        </LinhaAcoes>
      </LinhaAcoes>
      {carregando && <Carregando linhas={6} />}
      {erro && <Aviso tipo="error" titulo="Erro">{erro}</Aviso>}
      {a && !carregando && (
        <>
          <CabecalhoDocumento organizacao={a.organizacao} titulo={`Apuração mensal — ${nomeDoMes(a.mes)}`} editoraNome={a.editora.nome} editoraCnpj={a.editora.cnpj} />
          <TextoSuave>
            {[a.editora.contatoNome, a.editora.email, a.editora.chavePix && `PIX ${a.editora.chavePix}`]
              .filter(Boolean)
              .join(' · ')}
          </TextoSuave>

          <Secao titulo="Valores">
            {a.transferenciaAnterior && (
              <Alert severity="info" variant="outlined">
                Saldo de {formatarMoeda(a.transferenciaAnterior.valor)} transferido de {nomeDoMes(a.transferenciaAnterior.mes)} por{' '}
                {a.transferenciaAnterior.usuarioNome}: “{a.transferenciaAnterior.nota}”.
              </Alert>
            )}
            <Table size="small" aria-label="Seção financeira">
              <TableBody>
                <LinhaValor rotulo={a.transferenciaAnterior ? 'Saldo inicial (inclui o saldo transferido)' : 'Saldo inicial'} valor={a.saldoInicial} />
                <LinhaValor sinal="+" rotulo="Obrigações por vendas" valor={a.obrigacoesVendas} />
                <LinhaValor sinal="+" rotulo="Obrigações por dano ou extravio" valor={a.obrigacoesBaixas} />
                <LinhaValor sinal="−" rotulo="Estornos (vendas canceladas)" valor={a.estornos} />
                <LinhaValor sinal="−" rotulo="Pagamentos" valor={a.pagamentos} />
                <LinhaValor sinal="=" rotulo="Saldo final" valor={a.saldoFinal} forte />
              </TableBody>
            </Table>
          </Secao>

          <Secao titulo="Estoque consignado">
            {a.estoque.length === 0 ? (
              <TextoSuave>Sem unidades consignadas desta editora no mês.</TextoSuave>
            ) : (
              <TableContainer>
                <Table size="small" aria-label="Seção de estoque">
                  <TableHead>
                    <TableRow>
                      <TableCell>Remessa</TableCell>
                      <TableCell>Título</TableCell>
                      <TableCell align="right">Início</TableCell>
                      <TableCell align="right">Recebidas</TableCell>
                      <TableCell align="right">Vendidas</TableCell>
                      <TableCell align="right">Devolvidas</TableCell>
                      <TableCell align="right">Baixadas</TableCell>
                      <TableCell align="right">Outros</TableCell>
                      <TableCell align="right">Fim</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {a.estoque.map((e) => (
                      <TableRow key={`${e.remessaId}-${e.produtoId}`}>
                        <TableCell>{e.remessaCodigo}</TableCell>
                        <TableCell>{e.titulo}</TableCell>
                        <TableCell align="right">{e.inicial}</TableCell>
                        <TableCell align="right">{e.recebida}</TableCell>
                        <TableCell align="right">{e.vendida}</TableCell>
                        <TableCell align="right">{e.devolvida}</TableCell>
                        <TableCell align="right">{e.baixada}</TableCell>
                        <TableCell align="right">{e.outros}</TableCell>
                        <TableCell align="right">{e.fim}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2}>Total</TableCell>
                      {(['inicial', 'recebida', 'vendida', 'devolvida', 'baixada', 'outros', 'fim'] as const).map((c) => (
                        <TableCell key={c} align="right">
                          {somar(a.estoque.map((e) => e[c]))}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableFooter>
                </Table>
              </TableContainer>
            )}
          </Secao>

          <Secao titulo="Vendas">
            {a.vendas.length === 0 ? <TextoSuave>Nenhuma venda no mês.</TextoSuave> : <TabelaObrigacoes obrigacoes={a.vendas} rotulo="Vendas do mês" />}
          </Secao>
          <Secao titulo="Baixas por dano ou extravio">
            {a.baixas.length === 0 ? <TextoSuave>Nenhuma baixa no mês.</TextoSuave> : <TabelaObrigacoes obrigacoes={a.baixas} rotulo="Baixas do mês" />}
          </Secao>
          {a.estornadas.length > 0 && (
            <Secao titulo="Estornos">
              <TabelaObrigacoes obrigacoes={a.estornadas} rotulo="Estornos do mês" />
            </Secao>
          )}
          <Secao titulo="Devoluções">
            {a.devolucoes.length === 0 ? (
              <TextoSuave>Nenhuma devolução no mês.</TextoSuave>
            ) : (
              <Table size="small" aria-label="Devoluções do mês">
                <TableHead>
                  <TableRow>
                    <TableCell>Data</TableCell>
                    <TableCell>Remessa</TableCell>
                    <TableCell>Título</TableCell>
                    <TableCell align="right">Quantidade</TableCell>
                    <TableCell>Observação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {a.devolucoes.map((d) => (
                    <TableRow key={`${d.devolucaoId}-${d.titulo}`}>
                      <TableCell>{formatarData(d.data)}</TableCell>
                      <TableCell>{d.remessaCodigo}</TableCell>
                      <TableCell>{d.titulo}</TableCell>
                      <TableCell align="right">{d.quantidade}</TableCell>
                      <TableCell>{d.observacao ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Secao>
          <Secao titulo="Pagamentos">
            {a.linhasPagamentos.length === 0 ? (
              <TextoSuave>Nenhum pagamento no mês.</TextoSuave>
            ) : (
              <TabelaPagamentos pagamentos={a.linhasPagamentos} rotulo="Pagamentos do mês" />
            )}
          </Secao>
          <TextoSuave>Exportação em PDF e Excel pelos relatórios (US-REPORT-021); use Imprimir para o layout de papel.</TextoSuave>
        </>
      )}
    </Pilha>
  )
}
