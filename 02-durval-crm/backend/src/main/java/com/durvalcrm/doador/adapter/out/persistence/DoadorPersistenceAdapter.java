package com.durvalcrm.doador.adapter.out.persistence;

import com.durvalcrm.doador.adapter.out.persistence.ConsentimentoEmbeddable.Canal;
import com.durvalcrm.doador.adapter.out.persistence.ContatoEmbeddable.Tipo;
import com.durvalcrm.doador.domain.Consentimento;
import com.durvalcrm.doador.domain.Cpf;
import com.durvalcrm.doador.domain.Doador;
import com.durvalcrm.doador.domain.DoadorRepository;
import com.durvalcrm.doador.domain.Email;
import com.durvalcrm.doador.domain.Endereco;
import com.durvalcrm.doador.domain.Telefone;
import com.durvalcrm.shared.domain.Textos;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Component;

/** Implementa {@link DoadorRepository}; o mapeamento domínio ↔ JPA fica restrito a esta classe. */
@Component
class DoadorPersistenceAdapter implements DoadorRepository {

    private static final String BASE = "select distinct d from DoadorJpaEntity d ";
    private static final String NAO_ANONIMIZADO = " d.status <> com.durvalcrm.doador.domain.StatusDoador.ANONIMIZADO ";

    private final EntityManager em;

    DoadorPersistenceAdapter(EntityManager em) {
        this.em = em;
    }

    @Override
    public Doador salvar(Doador doador) {
        DoadorJpaEntity entidade = doador.getId() == null
                ? new DoadorJpaEntity(doador.getCriadoEm())
                : em.find(DoadorJpaEntity.class, doador.getId());
        entidade.atualizar(doador.getNome(), Textos.normalizar(doador.getNome()),
                doador.getCpf().map(Cpf::digitos).orElse(null), doador.getDataNascimento(), doador.getStatus(),
                paraEmbeddable(doador.getEndereco()), contatos(doador), consentimentos(doador),
                doador.getInativadoEm(), doador.getMotivoInativacao());
        if (entidade.getId() == null) {
            em.persist(entidade);
        }
        em.flush();
        return paraDominio(entidade);
    }

    @Override
    public Optional<Doador> buscarPorId(long id) {
        return Optional.ofNullable(em.find(DoadorJpaEntity.class, id)).map(DoadorPersistenceAdapter::paraDominio);
    }

    @Override
    public List<Doador> buscarPorPartesDoNome(List<String> partes) {
        StringBuilder jpql = new StringBuilder(BASE).append("where").append(NAO_ANONIMIZADO);
        for (int i = 0; i < partes.size(); i++) {
            jpql.append("and d.nomeBusca like :p").append(i).append(" escape '\\' ");
        }
        TypedQuery<DoadorJpaEntity> query = em.createQuery(jpql.toString(), DoadorJpaEntity.class);
        for (int i = 0; i < partes.size(); i++) {
            query.setParameter("p" + i, "%" + escaparLike(partes.get(i)) + "%");
        }
        return listar(query);
    }

    @Override
    public List<Doador> buscarPorFinalDoTelefone(String digitos) {
        return porContato("c.valor like :valor escape '\\'", Tipo.TELEFONE, "%" + escaparLike(digitos));
    }

    @Override
    public List<Doador> buscarPorTrechoDoEmail(String trecho) {
        return porContato("lower(c.valor) like :valor escape '\\'", Tipo.EMAIL, "%" + escaparLike(trecho) + "%");
    }

    @Override
    public List<Doador> buscarPorTelefone(String digitos) {
        return porContato("c.valor = :valor", Tipo.TELEFONE, digitos);
    }

    @Override
    public List<Doador> buscarPorEmail(String email) {
        return porContato("lower(c.valor) = lower(:valor)", Tipo.EMAIL, email);
    }

    @Override
    public List<Doador> buscarPorNomeSimilar(String nomeNormalizado, double limite) {
        @SuppressWarnings("unchecked")
        List<Number> ids = em.createNativeQuery("""
                select id from doador
                where status <> 'ANONIMIZADO' and similarity(nome_busca, :nome) >= :limite
                order by similarity(nome_busca, :nome) desc
                limit 20""")
                .setParameter("nome", nomeNormalizado)
                .setParameter("limite", limite)
                .getResultList();
        if (ids.isEmpty()) {
            return List.of();
        }
        List<Long> chaves = ids.stream().map(Number::longValue).toList();
        Map<Long, DoadorJpaEntity> porId = new HashMap<>();
        em.createQuery("select d from DoadorJpaEntity d where d.id in :ids", DoadorJpaEntity.class)
                .setParameter("ids", chaves)
                .getResultList()
                .forEach(d -> porId.put(d.getId(), d));
        return chaves.stream().map(porId::get).map(DoadorPersistenceAdapter::paraDominio).toList();
    }

    @Override
    public boolean existeOutroComCpf(Cpf cpf, long excetoId) {
        return em.createQuery("select count(d) from DoadorJpaEntity d where d.cpf = :cpf and d.id <> :id", Long.class)
                .setParameter("cpf", cpf.digitos())
                .setParameter("id", excetoId)
                .getSingleResult() > 0;
    }

    @Override
    public List<Doador> listarAtivosNascidosNosMeses(Set<Integer> meses) {
        return listar(em.createQuery(BASE + """
                where d.status = com.durvalcrm.doador.domain.StatusDoador.ATIVO
                and d.dataNascimento is not null and extract(month from d.dataNascimento) in :meses""",
                DoadorJpaEntity.class).setParameter("meses", meses));
    }

    @Override
    public long contarAtivosSemDataNascimento() {
        return em.createQuery("""
                select count(d) from DoadorJpaEntity d
                where d.status = com.durvalcrm.doador.domain.StatusDoador.ATIVO and d.dataNascimento is null""",
                Long.class).getSingleResult();
    }

    @Override
    public long contarAtivos() {
        return em.createQuery("""
                select count(d) from DoadorJpaEntity d
                where d.status = com.durvalcrm.doador.domain.StatusDoador.ATIVO""", Long.class).getSingleResult();
    }

    @Override
    public Set<Long> anonimizados(Collection<Long> ids) {
        if (ids.isEmpty()) {
            return Set.of();
        }
        return Set.copyOf(em.createQuery("""
                select d.id from DoadorJpaEntity d
                where d.id in :ids and d.status = com.durvalcrm.doador.domain.StatusDoador.ANONIMIZADO""", Long.class)
                .setParameter("ids", ids).getResultList());
    }

    @Override
    public boolean possuiMovimentos(long id) {
        Object r = em.createNativeQuery("""
                select exists (select 1 from contribuicao where doador_id = :id)
                    or exists (select 1 from doador_nota where doador_id = :id)
                    or exists (select 1 from competencia where doador_id = :id and status <> 'PENDENTE')""")
                .setParameter("id", id).getSingleResult();
        return Boolean.TRUE.equals(r);
    }

    @Override
    public void excluirImportado(long id) {
        em.flush();
        for (String tabela : List.of("competencia", "doador_contato", "doador_consentimento")) {
            em.createNativeQuery("delete from " + tabela + " where doador_id = :id").setParameter("id", id)
                    .executeUpdate();
        }
        em.createNativeQuery("delete from doador where id = :id").setParameter("id", id).executeUpdate();
        em.clear();
    }

    @Override
    public List<Long> listarIdsAtivos() {
        return em.createQuery("""
                select d.id from DoadorJpaEntity d
                where d.status = com.durvalcrm.doador.domain.StatusDoador.ATIVO order by d.id""", Long.class)
                .getResultList();
    }

    private List<Doador> porContato(String condicao, Tipo tipo, String valor) {
        return listar(em.createQuery(BASE + "join d.contatos c where" + NAO_ANONIMIZADO + "and c.tipo = :tipo and "
                + condicao, DoadorJpaEntity.class)
                .setParameter("tipo", tipo)
                .setParameter("valor", valor));
    }

    private static List<Doador> listar(TypedQuery<DoadorJpaEntity> query) {
        return query.getResultList().stream().map(DoadorPersistenceAdapter::paraDominio).toList();
    }

    private static String escaparLike(String valor) {
        return valor.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static List<ContatoEmbeddable> contatos(Doador d) {
        List<ContatoEmbeddable> contatos = new ArrayList<>();
        d.getTelefones().forEach(t -> contatos.add(new ContatoEmbeddable(Tipo.TELEFONE, t.tipo(), t.numero(), t.principal())));
        d.getEmails().forEach(e -> contatos.add(new ContatoEmbeddable(Tipo.EMAIL, null, e.endereco(), e.principal())));
        return contatos;
    }

    private static Map<Canal, ConsentimentoEmbeddable> consentimentos(Doador d) {
        Map<Canal, ConsentimentoEmbeddable> mapa = new EnumMap<>(Canal.class);
        mapa.put(Canal.WHATSAPP, paraEmbeddable(d.getConsentimentoWhatsapp()));
        mapa.put(Canal.EMAIL, paraEmbeddable(d.getConsentimentoEmail()));
        return mapa;
    }

    private static ConsentimentoEmbeddable paraEmbeddable(Consentimento c) {
        return new ConsentimentoEmbeddable(c.valor(), c.registradoEm(), c.registradoPor());
    }

    private static EnderecoEmbeddable paraEmbeddable(Endereco e) {
        return e == null ? null
                : new EnderecoEmbeddable(e.cep(), e.logradouro(), e.numero(), e.complemento(), e.bairro(), e.cidade(), e.uf());
    }

    private static Consentimento paraDominio(ConsentimentoEmbeddable c) {
        return c == null ? Consentimento.naoInformado()
                : new Consentimento(c.getValor(), c.getRegistradoEm(), c.getRegistradoPor());
    }

    static Doador paraDominio(DoadorJpaEntity j) {
        List<Telefone> telefones = new ArrayList<>();
        List<Email> emails = new ArrayList<>();
        for (ContatoEmbeddable c : j.getContatos()) {
            if (c.getTipo() == Tipo.TELEFONE) {
                telefones.add(new Telefone(c.getTipoTelefone(), c.getValor(), c.isPrincipal()));
            } else {
                emails.add(new Email(c.getValor(), c.isPrincipal()));
            }
        }
        EnderecoEmbeddable e = j.getEndereco();
        Endereco endereco = e == null ? null
                : new Endereco(e.getCep(), e.getLogradouro(), e.getNumero(), e.getComplemento(), e.getBairro(),
                        e.getCidade(), e.getUf());
        return Doador.reconstituir(j.getId(), j.getNome(), j.getCpf() == null ? null : new Cpf(j.getCpf()),
                j.getDataNascimento(), j.getStatus(), telefones, emails, endereco,
                paraDominio(j.getConsentimentos().get(Canal.WHATSAPP)), paraDominio(j.getConsentimentos().get(Canal.EMAIL)),
                j.getCriadoEm(), j.getInativadoEm(), j.getMotivoInativacao());
    }
}
