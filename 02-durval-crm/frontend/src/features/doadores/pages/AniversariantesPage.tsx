import {
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import {
  LinhaAcoes,
  Pilha,
  TextoSuave,
  TituloPagina,
} from '../../../shared/components/layout'
import { formatarDiaMes, hoje } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { useModeloMensagem } from '../../administracao/hooks/useModeloMensagem'
import {
  linkEmail,
  linkWhatsApp,
  preencherModelo,
} from '../../../shared/text/mensagens'
import {
  intervaloDoFiltro,
  ROTULO_FILTRO_ANIVERSARIO,
  type FiltroAniversario,
} from '../aniversarios'
import { doadorService } from '../services'
import type { Aniversariante } from '../types'

const FILTROS: FiltroAniversario[] = ['HOJE', 'SEMANA', 'MES', 'PROXIMO_MES']

function AcoesSaudacao({ a }: { a: Aniversariante }) {
  // US-ADMIN-003: texto do modelo "Felicitação de aniversário" configurado pelo Administrador.
  const { modelo, organizacao } = useModeloMensagem('ANIVERSARIO')
  const variaveis = {
    nome: a.nome.split(' ')[0],
    data: formatarDiaMes(a.dataAniversario),
    organizacao,
  }
  const whatsapp = a.consentimentoWhatsapp === 'SIM' && a.telefonePrincipal
  const email = a.consentimentoEmail === 'SIM' && a.emailPrincipal
  if (!whatsapp && !email) {
    return <TextoSuave>Sem canal com consentimento</TextoSuave>
  }
  return (
    <LinhaAcoes>
      {whatsapp && (
        <Button
          size="small"
          variant="outlined"
          href={linkWhatsApp(
            a.telefonePrincipal!,
            preencherModelo(modelo.whatsapp, variaveis),
          )}
          target="_blank"
          rel="noopener noreferrer"
        >
          Preparar saudação por WhatsApp
        </Button>
      )}
      {email && (
        <Button
          size="small"
          variant="outlined"
          href={linkEmail(
            a.emailPrincipal!,
            preencherModelo(modelo.emailAssunto, variaveis),
            preencherModelo(modelo.emailCorpo, variaveis),
          )}
        >
          Preparar saudação por e-mail
        </Button>
      )}
    </LinhaAcoes>
  )
}

export function AniversariantesPage() {
  const [filtro, setFiltro] = useState<FiltroAniversario>('MES')
  const intervalo = useMemo(() => intervaloDoFiltro(filtro, hoje()), [filtro])
  const { dados, carregando, erro } = useCarregamento(
    () => doadorService.listarAniversariantes(intervalo.de, intervalo.ate),
    [intervalo.de, intervalo.ate],
  )

  return (
    <Pilha component="section" aria-labelledby="titulo-aniversariantes">
      <TituloPagina id="titulo-aniversariantes">Aniversariantes</TituloPagina>
      <ToggleButtonGroup
        exclusive
        color="primary"
        value={filtro}
        onChange={(_, valor: FiltroAniversario | null) =>
          valor && setFiltro(valor)
        }
        aria-label="Período"
      >
        {FILTROS.map((f) => (
          <ToggleButton key={f} value={f}>
            {ROTULO_FILTRO_ANIVERSARIO[f]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {carregando && <Carregando />}
      {erro && (
        <Aviso tipo="error" titulo="Erro">
          {erro}
        </Aviso>
      )}
      {dados && (
        <>
          <TextoSuave role="status">
            {dados.semDataNascimento}{' '}
            {dados.semDataNascimento === 1
              ? 'doador ativo não tem'
              : 'doadores ativos não têm'}{' '}
            data de nascimento cadastrada.
          </TextoSuave>
          {dados.itens.length === 0 ? (
            <Typography>Nenhum aniversariante no período.</Typography>
          ) : (
            <Table aria-label="Aniversariantes do período">
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Dia/mês</TableCell>
                  <TableCell>Idade a completar</TableCell>
                  <TableCell>Canais com consentimento</TableCell>
                  <TableCell>Saudação</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dados.itens.map((a) => (
                  <TableRow key={`${a.doadorId}-${a.dataAniversario}`}>
                    <TableCell>
                      <LinkRota to={`/doadores/${a.doadorId}`}>
                        {a.nome}
                      </LinkRota>
                    </TableCell>
                    <TableCell>{formatarDiaMes(a.dataAniversario)}</TableCell>
                    <TableCell>{a.idadeACompletar}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        {a.consentimentoWhatsapp === 'SIM' && (
                          <Chip size="small" color="success" label="WhatsApp" />
                        )}
                        {a.consentimentoEmail === 'SIM' && (
                          <Chip size="small" color="info" label="E-mail" />
                        )}
                        {a.consentimentoWhatsapp !== 'SIM' &&
                          a.consentimentoEmail !== 'SIM' &&
                          '—'}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <AcoesSaudacao a={a} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </Pilha>
  )
}
