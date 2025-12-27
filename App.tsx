import React, { useState, useRef, useEffect, useMemo } from 'react';
import ProcessingModule from './components/ProcessingModule';
import SearchModule from './components/SearchModule';
import ChatModule from './components/ChatModule';
import { Acordao, SearchResult, ChatSession } from './types';
import { Scale, Database, Search, MessageSquareText, UploadCloud, Save, FolderUp, FileUp, Download, Briefcase, Gavel, Scale as ScaleIcon } from 'lucide-react';

// Default Social Descriptors
const DEFAULT_SOCIAL = [
"Abandono do trabalho", "Abono de viagem", "Abono para falhas", "Absolvição da instância", "Absolvição do pedido",
"Abuso de confiança", "Abuso do direito", "Acareação", "Acção de anulação e interpretação de cláusulas de CCT",
"Acção de cobrança de dívidas hospitalares", "Acção de desoneração", "Acção de impugnação judicial da regularidade e licitude do despedimento",
"Acção de impugnação da confidencialidade de informações ou da recusa da sua prestação", "Acção de impugnação de despedimento",
"Acção de impugnação de despedimento colectivo", "Acção de impugnação de sanção disciplinar", "Acção de liquidação e partilha de bens",
"Acção de reconhecimento da existência de contrato de trabalho", "Acção emergente de acidente de trabalho", "Acção de simples apreciação",
"Acção emergente de doença profissional", "Acção executiva", "Acção para cobrança de dívidas ou com idêntica finalidade",
"Acesso à carreira", "Acesso ao direito", "Acesso ao emprego e ao trabalho", "Acidente de trabalho", "Acidente de viação",
"Acidente em serviço", "Acidente in itinere", "Aclaração", "Acórdão uniformizador de jurisprudência", "Acordo",
"Acordo de empresa", "Acréscimo de actividade", "Actividade de exploração lucrativa", "Actividade de segurança privada",
"Actividade económica", "Actividade lucrativa", "Actividade sazonal", "Actividade seguradora", "Actividade sindical",
"Actividades perigosas", "Acto da secretaria", "Acto inútil", "Acto processual", "Actualização", "Actualização da pensão",
"Acumulação de funções", "Adaptabilidade grupal", "Adaptabilidade individual", "Adaptabilidade por regulamentação colectiva",
"Adopção", "Administração Pública", "Administrador", "Admissibilidade de prova testemunhal", "Admissibilidade de recurso",
"Admoestação", "Advogado", "Agente de execução", "Agente único", "Agravamento", "Agressão", "Ajudante familiar",
"Ajudas de custo", "Ajudas técnicas", "Alargamento do período experimental", "Alçada do tribunal", "Alcoolemia",
"Alegações de recurso", "Alojamento", "Alta", "Alteração da causa de pedir", "Alteração da estrutura da retribuição",
"Alteração das circunstâncias", "Alteração de Estatutos", "Alteração de funções", "Alteração do contrato",
"Alteração do horário de trabalho", "Ambiguidade", "Âmbito do recurso", "Âmbito pessoal de aplicação", "Amnistia",
"Ampliação da matéria de facto", "Ampliação do âmbito do recurso", "Ampliação do pedido", "Analogia", "Análise crítica",
"Antecedentes disciplinares", "Antiguidade", "Anuidades", "Anulabilidade", "Anulação de acórdão", "Anulação de julgamento",
"Apelação", "Apensação de processos", "Aplicação da lei no tempo", "Aplicação da lei processual no tempo",
"Aplicação de contrato colectivo de trabalho", "Aplicação de lei estrangeira", "Aplicação do direito",
"Aplicação subsidiária do Código de Processo Civil", "Apoio judiciário", "Apólice uniforme", "Arbitragem",
"Arguição de nulidades", "Articulado motivador", "Articulado superveniente", "Ascendente", "Assédio", "Assédio horizontal",
"Assistente", "Assembleia de credores", "Assessor técnico", "Assistência a menores", "Assistência a pessoas com deficiência",
"Assistência de terceira pessoa", "Assistência hospitalar", "Associações de empregadores", "Associações sindicais",
"Assunção de dívida", "Atenuação especial da coima", "Audição do arguido", "Audiência de partes", "Audiência prévia",
"Autarquia local", "Auto de advertência", "Auto de não conciliação", "Auto de notícia", "Autonomia administrativa",
"Autonomia financeira", "Autorização administrativa", "Aviso de recepção", "Aviso prévio", "Baixa de categoria",
"Baixa por doença", "Bancário", "Banco de horas", "Base instrutória", "Beneficiários", "Benefício da excussão",
"Boa fé", "Boletim de alta", "Bombeiro", "Caducidade", "Caducidade de convenção colectiva de trabalho",
"Caducidade do contrato de trabalho", "Caducidade do direito de acção", "Caducidade do direito de aplicar a sanção",
"Caducidade do procedimento disciplinar", "Caixa Geral de Aposentações", "Cálculo da indemnização", "Cálculo da pensão",
"Cantinas escolares", "Capacidade judiciária", "Capacidade restante", "Cargo de direcção", "Carreira profissional",
"Cartão de crédito", "Carteira profissional", "Cartório Notarial", "Caso julgado", "Caso julgado formal",
"Caso julgado material", "Categoria profissional", "Caução", "Causa de pedir", "Causa justificativa", "Causa prejudicial",
"Cedência ocasional de trabalhador", "Cedente", "Cessação da comissão de serviço", "Cessação da empreitada",
"Cessação do contrato de trabalho", "Cessação por acordo", "Cessão da posição contratual", "Cessão de exploração de estabelecimento",
"Cessionário", "Cinto de segurança", "Circunstâncias atenuantes", "Cisão de empresa", "Citação", "Citação de sociedade",
"Citação prévia", "CITE", "Citius", "Classificação profissional", "Cláusula adicional", "Cláusula de mobilidade geográfica",
"Cláusula de remissão", "Cláusulas contratuais gerais", "Coacção moral", "Coligação activa", "Coligação de contratos",
"Coligação passiva", "Colisão de direitos", "Cominação", "Comissão arbitral", "Comissão de serviço",
"Comissão de trabalhadores", "Comissões", "Comparticipação do Estado", "Compensação", "Compensação de créditos",
"Compensação global", "Compensação monetária", "Competência hierárquica", "Competência internacional",
"Competência material", "Competência por conexão", "Competência territorial", "Complemento de reforma",
"Complemento de subsídio de doença", "Comportamento concludente", "Comportamento extra-laboral", "Compromisso arbitral",
"Comunicação", "Comunicação da intenção de despedir", "Concausalidade", "Conciliação", "Conclusões", "Concorrência de culpas",
"Concorrência de instrumentos de regulamentação colectiva", "Concorrência desleal", "Concurso", "Condenação em multa",
"Condenação extra vel ultra petitum", "Condição resolutiva", "Condição suspensiva", "Condições de trabalho", "Condomínio",
"Confidencialidade de mensagens", "Confissão", "Confissão do pedido", "Confissão judicial", "Conflito de competência",
"Conflito de normas", "Confusão", "Conhecimento no saneador", "Conhecimento oficioso", "Cônjuges", "Consentimento do trabalhador",
"Consignação em depósito", "Constitucionalidade", "Construção civil", "Consulado português", "Consulta do processo",
"Consulta dos trabalhadores", "Consumação", "Conta de custas", "Contagem de tempo de serviço", "Contestação",
"Contra-alegações de recurso", "Contradição", "Contradita", "Contra-ordenação laboral", "Contra-ordenação muito grave",
"Contraprova", "Contratação colectiva", "Contrato administrativo", "Contrato colectivo de trabalho", "Contrato de adesão",
"Contrato de agência", "Contrato de aprendizagem", "Contrato de avença", "Contrato de empreitada", "Contrato de formação",
"Contrato de prestação de serviço", "Contrato de seguro", "Contrato de tarefa", "Contrato de trabalho",
"Contrato de trabalho a tempo parcial", "Contrato de trabalho a termo certo", "Contrato de trabalho a termo incerto",
"Contrato de trabalho a termo resolutivo", "Contrato de trabalho com entidade pública", "Contrato de trabalho de muito curta duração",
"Contrato de trabalho desportivo", "Contrato de trabalho doméstico", "Contrato de trabalho dos profissionais de espectáculos",
"Contrato de trabalho em funções públicas", "Contrato de trabalho intermitente", "Contrato de trabalho plurilocalizado",
"Contrato de trabalho temporário", "Contrato de utilização", "Contrato-promessa de trabalho", "Contratos sucessivos",
"Contribuições para a Segurança Social", "Controlo informático", "Convalidação", "Convenção colectiva de trabalho",
"Conversão da incapacidade temporária em permanente", "Conversão do contrato", "Cooperativa", "Correio electrónico",
"COVID-19", "Crédito de horas", "Crédito ilíquido", "Crédito laboral", "Crédito não reconhecido", "Crédito privilegiado",
"Crise empresarial", "Critérios de selecção", "Culpa", "Culpa concorrente de terceiro", "Culpa da empresa utilizadora",
"Culpa do empregador", "Culpa do sinistrado", "Culpa exclusiva", "Culpa grave", "Culpa in contrahendo", "Cumulação de indemnizações",
"Cumulação de pedidos", "Cúmulo jurídico", "Custas", "Custos aleatórios", "Dados pessoais", "Dano", "Danos futuros",
"Danos não patrimoniais", "Danos patrimoniais", "Decisão administrativa", "Decisão condenatória", "Decisão disciplinar",
"Decisão do Presidente do STJ", "Decisão final", "Decisão implícita", "Decisão intercalar", "Decisão prematura",
"Decisão surpresa", "Declaração de não renovação", "Declaração de renovação", "Declaração inexacta", "Declaração negocial",
"Declaração receptícia", "Declaração tácita", "Declaração unilateral", "Declarações de parte", "Dedução de rendimentos auferidos após o despedimento",
"Deficiência da gravação", "Delegação de poderes", "Delegado sindical", "Deliberação da Assembleia-Geral", "Deliberação social",
"Denúncia do contrato de trabalho", "Dependência económica", "Depoimento de parte", "Depósito bancário", "Descanso compensatório",
"Descanso diário", "Descanso semanal", "Descanso semanal complementar", "Descanso semanal obrigatório",
"Descaracterização de acidente de trabalho", "Desconsideração da personalidade colectiva", "Descontos na retribuição",
"Descontos para a Segurança Social", "Desempregado de longa duração", "Deserção do recurso", "Desfiliação",
"Deslocação em serviço", "Desmembramento de empresa", "Desobediência", "Despachante oficial", "Despacho",
"Despacho de aperfeiçoamento", "Despacho de arquivamento do inquérito", "Despacho de mero expediente", "Despacho do relator",
"Despacho homologatório", "Despacho liminar", "Despacho normativo", "Despacho saneador", "Despacho sobre a admissão de recurso",
"Despedimento", "Despedimento colectivo", "Despedimento de facto", "Despedimento ilícito", "Despedimento sem justa causa",
"Despesas de deslocação", "Despesas de funeral", "Despesas de tratamento", "Destacamento de trabalhador",
"Dever de apresentação de documentos", "Dever de assiduidade", "Dever de cooperação para a descoberta da verdade",
"Dever de custódia", "Dever de fidelidade", "Dever de gestão processual", "Dever de lealdade", "Dever de não concôrrencia",
"Dever de obediência", "Dever de ocupação efectiva", "Dever de probidade", "Dever de respeito", "Dever de urbanidade",
"Dever de zelo e diligência", "Deveres de informação", "Deveres do empregador", "Deveres laborais", "Deveres secundários",
"Difamação", "Diferenças salariais", "Dilação", "Diligência de instrução", "Diminuição da retribuição", "Directiva comunitária",
"Direito a férias", "Direito a pensão", "Direito à reforma", "Direito à retribuição", "Direito ao trabalho",
"Direito ao tratamento médico", "Direito ao trespasse", "Direito comunitário", "Direito de acção", "Direito de crítica",
"Direito de defesa", "Direito de escolha", "Direito de opção", "Direito de oposição", "Direito de regresso",
"Direito disciplinar", "Direito internacional", "Direitos de personalidade", "Direitos fundamentais", "Direitos indisponíveis",
"Dirigente sindical", "Discricionariedade", "Discriminação", "Dispensa da audiência prévia", "Dispensa para amamentação",
"Dispensa para consultas", "Dissolução de sociedade", "Diuturnidades", "Doação", "Documento", "Documento autêntico",
"Documento idóneo", "Documento particular", "Documento superveniente", "Doença profissional", "Dolo", "Dono da obra",
"Dupla conforme", "Dupla indemnização", "Duplo grau de jurisdição", "Duração do trabalho", "Efeito devolutivo",
"Efeito do recurso", "Efeito suspensivo", "Eficácia da declaração negocial", "Eficácia do acto", "Eficácia retroactiva",
"Eleição", "Eleito local", "Elemento subjectivo", "Embargos de executado", "Embargos de terceiro", "Empregador",
"Emprego-inserção", "Emprego-inserção +", "Empreitada", "Empresa de capitais privados", "Empresa de serviços de limpeza",
"Empresa de trabalho temporário", "Empresa familiar", "Empresa petrolífera", "Empresa pública", "Encerramento da empresa",
"Encerramento de estabelecimento comercial", "Enfermeiro", "Enriquecimento sem causa", "Ensino particular", "Ensino profissional",
"Ensino superior particular e cooperativo", "Entidade contratada pelo empregador", "Entidade executante", "Entidade pública empresarial",
"Entrega do capital da remição", "Equidade", "Equipamentos de trabalho", "Erro", "Erro da secretaria judicial", "Erro de julgamento",
"Erro material", "Erro na apreciação das provas", "Erro na declaração", "Erro na forma do processo", "Erro na transmissão da declaração",
"Erro sobre os motivos do negócio", "Especificação", "Estabelecimento comercial", "Estabelecimento industrial", "Estado",
"Estado de emergência", "Estado de necessidade", "Estado estrangeiro", "Estafeta", "Estágio", "Estaleiros temporários ou móveis",
"Estatuto do trabalhador cooperante", "Evento organizado pelo empregador", "Evolução salarial", "Exame médico",
"Excepção dilatória", "Excepção peremptória", "Excesso de pronúncia", "Execução", "Execução de direitos irrenunciáveis",
"Execução de sanção disciplinar", "Execução de sentença", "Execução para prestação de facto", "Execução por coima",
"Expectativa jurídica", "Expediente dilatório", "Extinção de posto de trabalho", "Extinção de sociedade",
"Extinção do contrato de trabalho", "Extinção do poder jurisdicional", "Facility Services", "Facto constitutivo",
"Facto duradouro", "Factor de bonificação 1,5", "Factos admitidos por acordo", "Factos complementares", "Factos conclusivos",
"Factos concretizadores", "Factos concretos", "Factos continuados", "Factos essenciais", "Factos instrumentais",
"Factos não alegados", "Factos não constantes da nota de culpa", "Factos notórios", "Factos pessoais", "Factos supervenientes",
"Facturas", "Falência", "Falsas declarações", "Falta da entidade responsável", "Falta de apresentação do procedimento disciplinar",
"Falta de aviso prévio", "Falta de citação", "Falta de contestação", "Falta de fundamentação", "Falta de pagamento da retribuição",
"Falta do réu", "Falta grave e indesculpável", "Faltas injustificadas", "Faltas justificadas", "Familiares do trabalhador",
"Farmácia", "Fase administrativa", "Fase conciliatória", "Fase contenciosa", "Fase de negociações", "FAT", "Férias",
"Férias judiciais", "Filiação sindical", "Fixação da incapacidade", "Fixação judicial da retribuição", "Folhas de férias",
"Fontes de direito", "Força maior", "Força probatória", "Força vinculativa", "Forma do contrato", "Forma do processo",
"Forma escrita", "Formação", "Formação profissional", "Formalidades ad probationem", "Formalidades ad substantiam",
"Formulário", "Fraude à lei", "Fundação", "Função pública", "Fundamentação", "Fundamentação de direito", "Fundamentação de facto",
"Fundo de compensação do trabalho", "Fundo de garantia de compensação do trabalho", "Fundo de pensões", "Fusão de empresas",
"Futebolista profissional", "Garantia autónoma", "Garantia bancária", "Garantia de defesa", "Garantia do pagamento",
"Garantias do trabalhador", "Genérico agrícola", "Gerente", "Gestor público", "GPS", "Graduação de créditos",
"Grandes superfícies", "Gratificação", "Gratificação extraordinária", "Gravação da audiência", "Gravação da prova",
"Gravidade da infracção", "Greve", "Grupo de empresas", "Habilitação de herdeiros", "Herança indivisa",
"Homologação de deliberação da assembleia de credores", "Honorários", "Horário de trabalho", "Horário flexível", "Hospital",
"IAS", "Igreja", "Igualdade das partes", "Ilações", "Ilicitude", "Ilisão", "Impedimento", "Impenhorabilidade",
"Imperatividade da lei", "Impossibilidade absoluta", "Impossibilidade definitiva", "Impossibilidade do cumprimento",
"Impossibilidade objectiva", "Impossibilidade superveniente", "Impossibilidade temporária", "Impugnação da matéria de facto",
"Impugnação diferida de decisões intercalares", "Imunidade jurisdicional", "Inadaptação do trabalhador", "Incapacidade funcional",
"Incapacidade grave", "Incapacidade para o exercício de outra profissão", "Incapacidade permanente absoluta",
"Incapacidade permanente absoluta para o trabalho habitual", "Incapacidade permanente parcial", "Incapacidade temporária",
"Incapacidade temporária absoluta", "Incapacidade temporária superior a dezoito meses", "Incidentes da instância",
"Incompetência absoluta", "Incompetência relativa", "Inconstitucionalidade", "Incumprimento do contrato", "Incumprimento parcial",
"Incumprimento por facto de terceiro", "Indeferimento liminar", "Indeferimento tácito", "Indemnização",
"Indemnização de antiguidade", "Indemnização por falta de aviso prévio", "Indemnização por incumprimento de obrigações laborais",
"Indeterminabilidade", "Indeterminação do objecto", "Indícios de subordinação jurídica", "Indivisibilidade",
"Ineptidão da petição inicial", "Informação e consulta", "Informação genética", "Infracção continuada", "Infracção disciplinar",
"Infracção estradal", "Início de laboração", "Inimputabilidade", "Injúrias", "Inquérito", "Inquérito prévio",
"Inquirição de testemunhas", "Insolvência", "Interpelação", "Intervalo de descanso", "Instituição Particular de Solidariedade Social",
"Instituições de crédito", "Instituto de Segurança Social", "Instituto do Emprego e Formação Profissional", "Instituto Público",
"Instrução técnica", "Instrutor", "Interesse em agir", "Interesse imaterial", "Interesse público", "Interesses de particular relevância social",
"Internet", "Interposição de recurso", "Interpretação", "Interpretação analógica", "Interpretação conforme à Constituição",
"Interpretação da declaração negocial", "Interpretação da lei", "Interpretação de convenção colectiva de trabalho",
"Interpretação de sentença", "Interpretação do negócio jurídico", "Interrupção da instância", "Interrupção da prescrição",
"Intervalo de descanso", "Intervenção acessória", "Intervenção de terceiros", "Intervenção principal",
"Inutilidade superveniente da lide", "Invalidade", "Invalidade do procedimento disciplinar", "Invalidade parcial",
"Inversão do contencioso", "Inversão do ónus da prova", "IRCT", "Irredutibilidade da retribuição", "Irregularidade",
"Irregularidade processual", "Irrevogabilidade", "IRS", "Isenção", "Isenção de horário de trabalho", "Jogador de futebol",
"Jornalista", "Juízo pericial", "Juízos Cíveis", "Juízos do Trabalho", "Julgamento", "Julgamento ampliado", "Junção de documento",
"Junção do procedimento disciplinar", "Junta médica", "Juros de mora", "Jus variandi", "Justa causa de despedimento",
"Justa causa de resolução", "Justo impedimento", "Lacuna", "Lançamento de nova actividade", "Lapso manifesto", "Lar de terceira idade",
"Lay-off", "Legitimidade", "Legitimidade activa", "Legitimidade passiva", "Lei aplicável", "Lei do Orçamento de Estado",
"Lei especial", "Lei interpretativa", "Lesão de interesses patrimoniais sérios", "Liberdade contratual",
"Liberdade de escolha de profissão", "Liberdade de expressão e de opinião", "Licença ilimitada", "Licença parental",
"Licença sem vencimento de longa duração", "Limite de idade", "Limite máximo da pena", "Limites à duração do trabalho",
"Limites da condenação", "Liquidação", "Liquidação de sentença", "Liquidatário", "Litigância de má fé", "Litisconsórcio",
"Litisconsórcio necessário", "Litisconsórcio voluntário", "Livrete individual de controlo", "Local de pagamento",
"Local de refeição", "Local de trabalho", "Má fé", "Mandato", "Mandato forense", "Massa insolvente", "Matéria de direito",
"Matéria de facto", "Mediação", "Medida da coima", "Meios de prova", "Meios de vigilância a distância", "Melhoria da aplicação do direito",
"Menor", "Microempresa", "Ministro do culto", "Mobbing", "Mobilidade funcional", "Mora", "Morte do empregador",
"Morte do trabalhador", "Motivação", "Motivo de força maior", "Motorista", "Mudança do estabelecimento", "Multa", "Músico",
"Não admissão do recurso", "Natureza jurídica", "Necessidade atendível", "Negligência consciente", "Negligência grosseira",
"Negligência médica", "Negócio formal", "Nexo de causalidade", "Nomeação de patrono", "Norma imperativa", "Nota de culpa",
"Notificação", "Notificação entre advogados", "Notificação para pagamento de multa", "Novação", "Novo julgamento", "Nulidade",
"Nulidade da estipulação do termo", "Nulidade de acórdão", "Nulidade de cláusula", "Nulidade de despacho", "Nulidade de sentença",
"Nulidade do contrato", "Nulidade insanável", "Nulidade por falta de forma", "Nulidade processual", "Objecto do contrato de seguro",
"Objecto do litígio", "Objecto do negócio", "Objecto do recurso", "Obras na residência do sinistrado", "Obrigação de indemnização",
"Obrigação fiscal", "Obrigação ilíquida", "Obrigação natural", "Obrigação voluntária", "Obrigatoriedade de pagamento",
"Obscuridade", "Ofensas à honra do trabalhador", "Oficial de justiça", "Omissão de gravação da prova", "Omissão de pronúncia",
"Ónus da prova", "Ónus de alegação", "Ónus de concluir", "Oposição", "Oposição à execução", "Oposição à liquidação",
"Oposição à reintegração", "Oposição de acórdãos", "Oposição entre os fundamentos e a decisão", "Ordem de julgamento",
"Ordem de serviço", "Ordem escrita", "Ordem legítima", "Ordem pública internacional", "Órgãos de administração", "Órgãos de fiscalização",
"Outsourcing", "Pacto de desaforamento", "Pacto de não concorrência", "Pacto de permanência", "Pacto privativo de jurisdição",
"Pagamento", "Pagamento de retribuições intercalares pelo Estado", "Pagamento em prestações", "Parecer da CITE",
"Parecer do Instituto do Emprego e Formação Profissional", "Parecer do Ministério Público", "Parecer do Sindicato", "Parecer técnico",
"Parentalidade", "Património autónomo", "Participação de acidente de trabalho", "Patrocínio oficioso", "Pedido",
"Pedido de juros", "Pedido genérico", "Pedido principal", "Pedido subsidiário", "Pedidos alternativos", "Penhora", "Pensão",
"Pensão complementar de reforma", "Pensão de reduzido montante", "Pensão de reforma", "Pensão de sobrevivência", "Pensão por incapacidade",
"Pensão por morte", "Pensão provisória", "Perda de local de trabalho", "Período de condução", "Período de repouso",
"Período de funcionamento", "Período experimental", "Período normal de trabalho", "PER", "Personalidade judiciária",
"Pessoa colectiva", "Petição deficiente", "Petição inicial", "Plataforma digital", "Pluralidade de empregadores",
"Pluralidade de entidades responsáveis", "Pluralidade subjectiva subsidiária", "Pluriemprego", "Poder de direcção",
"Poder disciplinar", "Poder discricionário", "Poderes da Relação", "Poderes de representação", "Poderes do juiz",
"Poderes do Supremo Tribunal de Justiça", "Poderes do tribunal", "Polivalência funcional", "Portaria de extensão",
"Portaria de Regulamentação do Trabalho para os trabalhadores administrativos", "Posto de trabalho", "Prática disciplinar",
"Praticante desportivo", "Prazo", "Prazo de caducidade", "Prazo de interposição do recurso", "Prazo de propositura da acção",
"Prazo judicial", "Predisposição patológica", "Preferência", "Prejuízo sério", "Prémio", "Prémio de assiduidade",
"Prémio de desempenho", "Prémio de produtividade", "Prémio fixo", "Prémio TIR", "Prémio variável", "Pré-reforma", "Prescrição",
"Prescrição da infracção", "Prescrição de créditos", "Prescrição extintiva", "Prestação suplementar", "Prestações em espécie",
"Prestações médicas e medicamentosas", "Prestações periódicas", "Prestações por doença", "Presunção de abandono",
"Presunção de aceitação do despedimento", "Presunção de culpa", "Presunção de inexistência de justa causa", "Presunção de laboralidade",
"Presunção de notificação", "Presunção juris et de jure", "Presunção juris tantum", "Presunções", "Presunções judiciais",
"Presunções legais", "Preterição do tribunal arbitral", "PREVPAP", "Primado do direito da União Europeia", "Princípio da adequação formal",
"Princípio da aquisição processual", "Princípio da concentração da defesa", "Princípio da confiança", "Princípio da cooperação",
"Princípio da economia processual", "Princípio da filiação", "Princípio da igualdade", "Princípio da indivisibilidade da confissão",
"Princípio da interpretação conforme o direito comunitário", "Princípio da irreversibilidade", "Princípio da legalidade",
"Princípio da liberdade de desvinculação", "Princípio da livre apreciação da prova", "Princípio da preclusão",
"Princípio da proporcionalidade", "Princípio da segurança no emprego", "Princípio do contraditório", "Princípio do dispositivo",
"Princípio do pedido", "Princípio do tratamento mais favorável", "Princípio geral de aproveitamento do processado",
"Privilégio creditório", "Procedimento", "Procedimento disciplinar", "Procedimento disciplinar incompleto", "Procedimento cautelar",
"Processo comum", "Processo de contra-ordenação", "Processo de insolvência", "Processo de trabalho", "Processo equitativo",
"Processo especial de recuperação de empresa", "Processo executivo", "Processo penal", "Processo urgente", "Procuração",
"Professor", "Professor universitário", "Progressão na carreira", "Progressão salarial", "Progressão na categoria",
"Proibição de discriminação", "Proibição de prova", "Proibição do lock-out", "Promessa de contrato de trabalho",
"Proporcionais de férias e de subsídios de férias e de Natal", "Propositura da acção", "Prorrogação do prazo",
"Protecção contra quedas", "Protecção da maternidade e paternidade", "Protecção de dados pessoais", "Protocolo", "Prova",
"Prova documental", "Prova gravada", "Prova pericial", "Prova plena", "Prova por confissão", "Prova por declarações de parte",
"Prova por documentos particulares", "Prova proibida", "Prova testemunhal", "Prova vinculada", "Publicidade", "Qualificação jurídica",
"Quantia exequenda", "Quantum indemnizatório", "Queda em altura", "Questão de direito", "Questão de facto", "Questão nova",
"Questão prejudicial", "Quitação", "Ratificação", "Reabilitação profissional", "Recibo de quitação", "Recidiva", "Reclamação",
"Reclamação de créditos", "Reclamação para a Conferência", "Reclamação ulterior de créditos de acidente de trabalho",
"Reclassificação", "Reconhecimento da dívida", "Reconstituição natural", "Reconvenção", "Reconversão profissional",
"Rectificação de erros materiais", "Rectificação de pensão", "Rectificação de sentença", "Recurso", "Recurso de apelação",
"Recurso de contra-ordenação", "Recurso de revisão", "Recurso de revista", "Recurso extraordinário para uniformização de jurisprudência",
"Recurso independente", "Recurso laboral", "Recurso para o Supremo Tribunal de Justiça", "Recurso per saltum", "Recurso subordinado",
"Recusa de cooperação", "Recusa de assistência médica", "Recusa de tratamento", "Redução do contrato", "Redução do período normal de trabalho",
"Reembolso de despesas", "Reembolsos à Segurança Social", "Reenvio prejudicial", "Reestruturação de empresa", "Refeições",
"REFER", "Reforma", "Reforma antecipada", "Reforma da decisão", "Reforma de acórdão", "Reforma por invalidez", "Reforma por velhice",
"Reformatio in pejus", "Regime disciplinar", "Regime geral da Segurança Social", "Regime transitório", "Registo",
"Regulamentação colectiva", "Regulamento (CE) n.º 561/2006", "Regulamento (UE) n.º 165/2014", "Regulamento interno",
"Reinserção profissional", "Reincidência", "Reintegração", "Rejeição de recurso", "Relação de emprego",
"Relação jurídica administrativa", "Relações de trabalho plurilocalizadas", "Relações entre fontes de regulação",
"Remição de pensão", "Remição facultativa", "Remição parcial", "Remissão abdicativa", "Remissão para documentos",
"Renovação da instância", "Renovação da prova", "Renovação do contrato", "Renúncia", "Repetição do julgamento", "Repouso",
"Representante", "Representante sindical", "Repristinação", "Requerimento executivo", "Requisição", "Requisitos",
"Reserva da vida privada", "Residência", "Residência ocasional", "Resolução do contrato de trabalho", "Responsabilidade",
"Responsabilidade agravada", "Responsabilidade civil", "Responsabilidade civil emergente de acidente de trabalho",
"Responsabilidade contratual", "Responsabilidade criminal", "Responsabilidade da entidade contratante", "Responsabilidade do empregador",
"Responsabilidade do trabalhador", "Responsabilidade disciplinar", "Responsabilidade extracontratual", "Responsabilidade objectiva",
"Responsabilidade pré-contratual", "Responsabilidade solidária", "Responsabilidade subsidiária", "Resposta à contestação",
"Resposta à nota de culpa", "Restrição do objecto do recurso", "Retribuição", "Retribuição de férias", "Retribuição de referência",
"Retribuição em espécie", "Retribuição ilíquida", "Retribuição líquida", "Retribuição mínima mensal garantida", "Retribuição mista",
"Retribuição variável", "Retribuição-base", "Retribuições em dívida", "Retribuições intercalares", "Revalidação do contrato nulo",
"Revelia", "Reversão", "Revisão de incapacidade", "Revisão de sentença estrangeira", "Revista excepcional", "Revogação",
"Revogação da sentença", "Revogação do contrato de trabalho", "RGPD", "Rotação de cheques", "RTP", "Sanção abusiva",
"Sanção acessória", "Sanção disciplinar", "Sanção pecuniária compulsória", "Saneador-sentença", "Sector bancário",
"Sector económico de actividade", "Sector empresarial do Estado", "Sector portuário", "Segredo comercial", "Segredo das telecomunicações",
"Segredo profissional", "Segurança e saúde no trabalho", "Segurança no emprego", "Segurança Social", "Seguro",
"Seguro de acidentes de trabalho", "Seguro de vida", "Sentença", "Sentença criminal", "Sentença homologatória",
"Serviço militar obrigatório", "Serviços consentidos pelo empregador", "Serviços de Segurança e Saúde no Trabalho",
"Serviços de vigilância e segurança", "Serviços espontâneos", "Serviços essenciais", "Serviços mínimos", "Sigilo bancário",
"Simulação", "Sindicato", "Sobrevigência", "Sociedade", "Sociedade anónima",
"Sociedades em relação de participações recíprocas, de domínio ou de grupo", "Sociedade por quotas", "Sociedade unipessoal",
"Sócio gerente", "Subcontratação", "Subempreitada", "Subordinação jurídica", "Subrogação", "Subsidiariedade",
"Subsídio de agente único", "Subsídio de alimentação", "Subsídio de desemprego", "Subsídio de deslocação", "Subsídio de disponibilidade",
"Subsídio de doença", "Subsídio de exclusividade", "Subsídio de férias", "Subsídio de função", "Subsídio de funeral",
"Subsídio de isenção de horário de trabalho", "Subsídio de Natal", "Subsídio de turno", "Subsídio para a criação de próprio emprego",
"Subsídio para readaptação da habitação", "Subsídio por elevada incapacidade permanente", "Subsídio por morte",
"Substituição do tribunal recorrido", "Substituição temporária de trabalhador", "Sucessão de instrumentos de regulamentação colectiva",
"Sucessão de leis no tempo", "Sucessão na posição contratual", "Sucumbência", "Suspensão", "Suspensão da execução da coima",
"Suspensão da instância", "Suspensão do contrato de trabalho", "Suspensão do despedimento", "Suspensão do despedimento colectivo",
"Suspensão do trabalho", "Suspensão preventiva", "Tacógrafo", "Taxa de juro", "Taxa de justiça", "Teleconferência", "Telecópia",
"Telemóvel", "Temas da prova", "Tempestividade", "Tempo de deslocação", "Tempo de disponibilidade", "Tempo de trabalho",
"Tentativa de conciliação", "Testemunha", "Testes e exames médicos", "Título executivo", "Tomador do seguro",
"Trabalhador à procura de primeiro emprego", "Trabalhador com capacidade de trabalho reduzida", "Trabalhador com deficiência",
"Trabalhador com doença crónica", "Trabalhador com responsabilidades familiares", "Trabalhador cooperante", "Trabalhador de consulado",
"Trabalhador de empresa petrolífera", "Trabalhador de seguros", "Trabalhador estudante", "Trabalhador estrangeiro",
"Trabalhador eventual", "Trabalhador independente", "Trabalhador no estrangeiro", "Trabalhador menor", "Trabalhador não sindicalizado",
"Trabalhador permanente", "Trabalhador subordinado", "Trabalhador temporário", "Trabalhadora grávida", "Trabalho a bordo",
"Trabalho ao domingo", "Trabalho aparentemente autónomo", "Trabalho de curta duração", "Trabalho efectivo", "Trabalho em dias de descanso",
"Trabalho em feriado", "Trabalho igual salário igual", "Trabalho nocturno", "Trabalho no domicílio", "Trabalho ocasional",
"Trabalho por turnos", "Trabalho portuário", "Trabalho rural", "Trabalho sazonal", "Trabalho suplementar", "Trabalho voluntário",
"Trajecto normal", "Transacção", "Transferência definitiva de trabalhador", "Transferência temporária de trabalhador",
"Trânsito em julgado", "Transmissão da posição contratual", "Transmissão de dívida", "Transmissão de estabelecimento",
"Transmissão parcial de estabelecimento", "Transporte internacional de mercadorias por estrada", "Tratamento subsequente ao acidente",
"Treinador", "Tribunal Administrativo", "Tribunal Arbitral", "Tribunal Constitucional", "Tribunal da Relação", "Tribunal de Comarca",
"Tribunal dos Conflitos", "Truck sistem", "União de facto", "União Europeia", "Unidade comercial de dimensão relevante",
"Uniformização de jurisprudência", "Usos laborais", "Valor da causa", "Valor do silêncio como meio declarativo", "Valor probatório",
"Veículo adaptado", "Veículo automóvel", "Vencimento da dívida", "Venda judicial", "Vendedor", "Vícios da vontade", "Videovigilância",
"Vinculação de pessoa colectiva", "Violação de regras de segurança", "Violação do direito a férias", "Vontade real do declarante", "Whatsapp"
];

function App() {
  const [db, setDb] = useState<Acordao[]>([]);
  const [savedSearches, setSavedSearches] = useState<SearchResult[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  
  // Categorized Descriptors
  const [descriptors, setDescriptors] = useState<{social: string[], crime: string[], civil: string[]}>({
    social: Array.from(new Set(DEFAULT_SOCIAL)).sort(),
    crime: [],
    civil: []
  });

  // Global Judges List (Relatores & Adjuntos mixed)
  const [judges, setJudges] = useState<string[]>([]);
  
  // Legal Area Selection
  const [legalArea, setLegalArea] = useState<'social' | 'crime' | 'civil' | null>(null);

  const [activeTab, setActiveTab] = useState<'process' | 'search' | 'chat'>('process');
  const [rootHandleName, setRootHandleName] = useState<string | null>(null);
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [cachedFiles, setCachedFiles] = useState<File[]>([]); // For legacy mode

  // Hidden input for loading DB
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize judges from DB changes
  useEffect(() => {
    const extracted = new Set<string>();
    db.forEach(ac => {
      if (ac.relator && ac.relator !== 'Desconhecido') extracted.add(ac.relator.trim());
      ac.adjuntos.forEach(adj => {
        if (adj) extracted.add(adj.trim());
      });
    });
    // Merge with existing manual judges if any, avoiding dupes
    setJudges(prev => {
      const combined = new Set([...prev, ...extracted]);
      return Array.from(combined).sort();
    });
  }, [db]);

  const handleSetRoot = (handle: FileSystemDirectoryHandle) => {
    setRootHandle(handle);
    setRootHandleName(handle.name);
    setActiveTab('process');
  };

  const handleCacheFiles = (files: File[]) => {
    setCachedFiles(files);
    setRootHandleName("Ficheiros Carregados (Modo Legado)");
  };

  const getPdfData = async (fileName: string): Promise<ArrayBuffer | null> => {
    if (rootHandle) {
       // Recursive search in FS API
       const findFile = async (dir: FileSystemDirectoryHandle, name: string): Promise<FileSystemFileHandle | null> => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for await (const entry of (dir as any).values()) {
             if (entry.kind === 'file' && entry.name === name) return entry;
             if (entry.kind === 'directory') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const found = await findFile(entry as any, name);
                if (found) return found;
             }
          }
          return null;
       };

       const handle = await findFile(rootHandle, fileName);
       if (handle) {
          const file = await handle.getFile();
          return await file.arrayBuffer();
       }
    } else {
       // Check cached files
       const file = cachedFiles.find(f => f.name === fileName);
       if (file) {
          return await file.arrayBuffer();
       }
    }
    return null;
  };

  const getPdfUrl = async (fileName: string): Promise<string | null> => {
      const buffer = await getPdfData(fileName);
      if (buffer) {
          const blob = new Blob([buffer], { type: 'application/pdf' });
          return URL.createObjectURL(blob);
      }
      return null;
  };

  const openPdf = async (fileName: string) => {
    const url = await getPdfUrl(fileName);
    if (url) {
      window.open(url, '_blank');
    } else {
      alert('Ficheiro não encontrado na pasta selecionada ou cache.');
    }
  };

  const handleSaveDb = () => {
    const data = {
      db,
      savedSearches,
      chatSessions,
      descriptors,
      judges
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `juris_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadDbClick = () => {
    fileInputRef.current?.click();
  };

  const handleLoadDbFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        const parsed = JSON.parse(content);
        
        if (parsed.db) {
          const existingIds = new Set(db.map(x => x.id));
          const newItems = (parsed.db as Acordao[]).filter(x => !existingIds.has(x.id));
          setDb(prev => [...prev, ...newItems]);
        }
        if (parsed.savedSearches) setSavedSearches(parsed.savedSearches);
        if (parsed.chatSessions) setChatSessions(parsed.chatSessions);
        if (parsed.descriptors) {
            setDescriptors(prev => ({
                social: Array.from(new Set([...prev.social, ...(parsed.descriptors.social || [])])).sort(),
                crime: Array.from(new Set([...prev.crime, ...(parsed.descriptors.crime || [])])).sort(),
                civil: Array.from(new Set([...prev.civil, ...(parsed.descriptors.civil || [])])).sort(),
            }));
        }
        if (parsed.judges) {
            setJudges(prev => Array.from(new Set([...prev, ...parsed.judges])).sort());
        }

        alert('Base de dados carregada/fundida com sucesso!');
        setActiveTab('search');
      } catch (err) {
        alert('Erro ao ler ficheiro JSON: ' + err);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const updateAcordao = (updated: Acordao) => {
    setDb(prev => prev.map(item => item.id === updated.id ? updated : item));
    const newJudges = [updated.relator, ...updated.adjuntos].filter(j => j && j !== 'Desconhecido');
    if (newJudges.length > 0) {
        setJudges(prev => {
            const combined = new Set([...prev, ...newJudges]);
            return Array.from(combined).sort();
        });
    }
  };

  const handleMergeJudges = (mainName: string, sourceNames: string[]) => {
      const main = mainName.trim();
      const sources = sourceNames.map(s => s.trim());

      if (!main || sources.length === 0) return;

      let count = 0;
      setDb(prev => {
          const nextDb = prev.map(acordao => {
              let changed = false;
              let newRelator = acordao.relator;
              let newAdjuntos = [...acordao.adjuntos];

              // Replace Relator
              if (sources.includes(acordao.relator.trim())) {
                  newRelator = main;
                  changed = true;
              }

              // Replace Adjuntos
              const mappedAdjuntos = newAdjuntos.map(a => {
                  if (sources.includes(a.trim())) {
                      changed = true;
                      return main;
                  }
                  return a;
              });

              if (changed) {
                  count++;
                  // Deduplicate adjuntos
                  let finalAdjuntos = Array.from(new Set(mappedAdjuntos));
                  // Ensure Relator is not in Adjuntos (promote to Relator if conflict)
                  finalAdjuntos = finalAdjuntos.filter(a => a !== newRelator);
                  
                  return { ...acordao, relator: newRelator, adjuntos: finalAdjuntos };
              }
              return acordao;
          });
          
          console.log(`Fusão concluída: ${count} acórdãos atualizados.`);
          return nextDb;
      });
      
      // Update global judges list
      setJudges(prev => {
          const filtered = prev.filter(j => !sources.includes(j.trim()));
          if (!filtered.includes(main)) filtered.push(main);
          return filtered.sort();
      });

      // Show alert after state update
      setTimeout(() => {
          alert(`Fusão concluída com sucesso.\n\n${count} acórdãos foram atualizados.\nNomes originais convertidos para "${main}".`);
      }, 200);
  };

  // Handlers for Processing Module Management
  const addDescriptors = (category: 'social' | 'crime' | 'civil', list: string[]) => {
      setDescriptors(prev => ({
          ...prev,
          [category]: Array.from(new Set([...prev[category], ...list])).sort()
      }));
  };

  const addJudges = (list: string[]) => {
      setJudges(prev => Array.from(new Set([...prev, ...list])).sort());
  };

  const filteredDescriptors = useMemo(() => {
      return legalArea ? descriptors[legalArea] : [];
  }, [descriptors, legalArea]);

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Legal Area Selection Modal */}
      {!legalArea && (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full text-center">
                  <div className="mb-6 flex justify-center">
                      <div className="p-4 bg-legal-100 rounded-full">
                          <ScaleIcon className="w-10 h-10 text-legal-700"/>
                      </div>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Bem-vindo à JurisAnalítica</h2>
                  <p className="text-gray-600 mb-8">Por favor, selecione a sua área de jurisdição preferencial. Isto irá adaptar os filtros e descritores à sua prática.</p>
                  
                  <div className="grid grid-cols-1 gap-4">
                      <button onClick={() => setLegalArea('social')} className="p-4 rounded-lg border-2 border-legal-200 hover:border-legal-600 hover:bg-legal-50 transition-all flex items-center gap-4 group text-left">
                           <Briefcase className="w-6 h-6 text-legal-500 group-hover:text-legal-700"/>
                           <div>
                               <div className="font-bold text-lg text-gray-800">Área Social / Laboral</div>
                               <div className="text-xs text-gray-500">Direito do Trabalho, Segurança Social...</div>
                           </div>
                      </button>
                      <button onClick={() => setLegalArea('crime')} className="p-4 rounded-lg border-2 border-legal-200 hover:border-legal-600 hover:bg-legal-50 transition-all flex items-center gap-4 group text-left">
                           <Gavel className="w-6 h-6 text-legal-500 group-hover:text-legal-700"/>
                           <div>
                               <div className="font-bold text-lg text-gray-800">Área Criminal</div>
                               <div className="text-xs text-gray-500">Direito Penal, Contra-ordenações...</div>
                           </div>
                      </button>
                      <button onClick={() => setLegalArea('civil')} className="p-4 rounded-lg border-2 border-legal-200 hover:border-legal-600 hover:bg-legal-50 transition-all flex items-center gap-4 group text-left">
                           <ScaleIcon className="w-6 h-6 text-legal-500 group-hover:text-legal-700"/>
                           <div>
                               <div className="font-bold text-lg text-gray-800">Área Cível</div>
                               <div className="text-xs text-gray-500">Contratos, Família, Obrigações...</div>
                           </div>
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* PERSISTENT HEADER */}
      <header className="bg-legal-900 text-white shadow-md z-50 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-8 h-8 text-legal-200" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">JurisAnalítica Local</h1>
              <div className="flex items-center gap-2">
                  <p className="text-[10px] text-legal-300 uppercase tracking-widest">Análise Jurídica Privada</p>
                  {legalArea && (
                      <span className="text-[10px] bg-legal-700 px-2 rounded-full uppercase text-white font-bold">{legalArea}</span>
                  )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="h-8 w-px bg-legal-700 mx-2"></div>
            
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleLoadDbFile}/>
            <button onClick={handleLoadDbClick} className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-legal-800 text-sm text-legal-100 transition-colors">
              <UploadCloud className="w-4 h-4" /><span className="hidden sm:inline">Carregar BD</span>
            </button>
            <button onClick={handleSaveDb} className="flex items-center gap-2 px-4 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-bold shadow-sm transition-colors">
              <Save className="w-4 h-4" /><span>Guardar BD</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* If no folder is selected yet AND empty DB, start at processing */}
        {!rootHandleName && db.length === 0 ? (
          <div className="flex-1 overflow-auto">
             <ProcessingModule 
               onDataLoaded={(newData) => setDb(prev => [...prev, ...newData])} 
               existingDB={db}
               onSetRootHandle={handleSetRoot}
               rootHandleName={rootHandleName}
               onCacheFiles={handleCacheFiles}
               onAddDescriptors={addDescriptors}
               onAddJudges={addJudges}
               onMergeJudges={handleMergeJudges}
               availableJudges={judges}
               availableDescriptors={filteredDescriptors}
             />
          </div>
        ) : (
          <>
            {/* Tabs Navigation */}
            <div className="bg-white border-b border-gray-200 px-6 pt-2 flex-shrink-0">
               <div className="flex gap-6">
                 <button onClick={() => setActiveTab('process')} className={`pb-2 px-1 flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'process' ? 'border-legal-600 text-legal-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    <FolderUp className="w-4 h-4" /> Fontes & Processamento
                 </button>
                 <button onClick={() => setActiveTab('search')} className={`pb-2 px-1 flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'search' ? 'border-legal-600 text-legal-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    <Search className="w-4 h-4" /> Pesquisa & Correção <span className="bg-gray-100 text-gray-600 px-2 rounded-full text-xs">{db.length}</span>
                 </button>
                 <button onClick={() => setActiveTab('chat')} className={`pb-2 px-1 flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'chat' ? 'border-legal-600 text-legal-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    <MessageSquareText className="w-4 h-4" /> Assistente Jurídico
                 </button>
               </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden bg-gray-50 relative">
               {activeTab === 'process' && (
                 <div className="h-full overflow-auto">
                    <ProcessingModule 
                      onDataLoaded={(newData) => setDb(prev => [...prev, ...newData])} 
                      existingDB={db}
                      onSetRootHandle={handleSetRoot}
                      rootHandleName={rootHandleName}
                      onCacheFiles={handleCacheFiles}
                      onAddDescriptors={addDescriptors}
                      onAddJudges={addJudges}
                      onMergeJudges={handleMergeJudges}
                      availableJudges={judges}
                      availableDescriptors={filteredDescriptors}
                    />
                 </div>
               )}
               
               {activeTab === 'search' && (
                 <SearchModule 
                    db={db} 
                    onSaveSearch={(s) => setSavedSearches(prev => [...prev, s])}
                    savedSearches={savedSearches}
                    onDeleteSearch={(id) => setSavedSearches(prev => prev.filter(s => s.id !== id))}
                    onUpdateSearchName={(id, name) => setSavedSearches(prev => prev.map(s => s.id === id ? {...s, name} : s))}
                    onOpenPdf={openPdf}
                    onGetPdfData={getPdfData}
                    onUpdateAcordao={updateAcordao}
                    availableDescriptors={filteredDescriptors}
                    availableJudges={judges}
                    onAddDescriptors={(list) => addDescriptors(legalArea || 'social', list)} 
                 />
               )}

               {activeTab === 'chat' && (
                 <ChatModule 
                    db={db}
                    sessions={chatSessions}
                    onSaveSession={(s) => {
                       const exists = chatSessions.find(cs => cs.id === s.id);
                       if (exists) {
                         setChatSessions(prev => prev.map(cs => cs.id === s.id ? s : cs));
                       } else {
                         setChatSessions(prev => [s, ...prev]);
                       }
                    }}
                    onDeleteSession={(id) => setChatSessions(prev => prev.filter(s => s.id !== id))}
                    onOpenPdf={openPdf}
                 />
               )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;