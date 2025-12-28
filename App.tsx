
import React, { useState, useRef, useEffect } from 'react';
import ProcessingModule from './components/ProcessingModule';
import SearchModule from './components/SearchModule';
import ChatModule from './components/ChatModule';
import { Acordao, ChatSession } from './types';
import { Scale, Save, Briefcase, Gavel, Scale as ScaleIcon, Upload, MessageSquare, Download, History, Database, Trash2, Key, ShieldCheck, AlertCircle, Info, Lock, ExternalLink, Globe, Loader2 } from 'lucide-react';

const SOCIAL_DESCRIPTORS_LIST = [
  "Abandono do trabalho", "Abono de viagem", "Abono para falhas", "Absolvição da instância", "Absolvição do pedido",
  "Abuso de confiança", "Abuso do direito", "Acareação", "Acção de anulação e interpretação de cláusulas de CCT",
  "Acção de cobrança de dívidas hospitalares", "Acção de desoneração", "Acção de impugnação judicial da regularidade e licitude do despedimento",
  "Acção de impugnação da confidencialidade de informações ou da recusa da sua prestação", "Acção de impugnação de despedimento",
  "Acção de impugnação de despedimento colectivo", "Acção de impugnação de sanção disciplinar", "Acção de liquidação e partilha de bens",
  "Acção de reconhecimento da existência de contrato de trabalho", "Acção emergente de acidente de trabalho", "Acção de simples apreciação",
  "Acção emergente de doença profissional", "Acção executiva", "Acção para cobrança de dívidas ou com idêntica finalidade",
  "Acesso à carreira", "Acesso ao direito", "Acesso ao emprego e ao trabalho", "Acidente de trabalho", "Acidente de viação",
  "Acidente em serviço", "Acidente in itinere", "Aclaração", "Acórdão uniformizador de jurisprudência", "Acordo",
  "Acordo de empresa", "Acréscimo de actividade", "Actividade de segurança privada", "Actividade económica",
  "Actividade lucrativa", "Actividade sazonal", "Actividade seguradora", "Actividade sindical", "Actividades perigosas",
  "Acto da secretaria", "Acto inútil", "Acto processual", "Actualização", "Actualização da pensão", "Acumulação de funções",
  "Adaptabilidade grupal", "Adaptabilidade individual", "Adaptabilidade por regulamentação colectiva", "Adopção",
  "Administração Pública", "Administrador", "Admissibilidade de prova testemunhal", "Admissibilidade de recurso",
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
  "Assistente", "Assembleia de credores", "Assessor técnico", "Assistência a menores", "Assistência a pessoas com distivéis",
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
  "Coligação passiva", "Colisão de direitos", "Cominação", "Comissão arbitral", "Comissão de serviço", "Comissão de trabalhadores",
  "Comissões", "Comparticipação do Estado", "Compensação", "Compensação de créditos", "Compensação global",
  "Compensação monetária", "Competência hierárquica", "Competência internacional", "Competência material",
  "Competência por conexão", "Competência territorial", "Complemento de reforma", "Complemento de subsídio de doença",
  "Comportamento concludente", "Comportamento extra-laboral", "Compromisso arbitral", "Comunicação", "Comunicação da intenção de despedir",
  "Concausalidade", "Conciliação", "Conclusões", "Concorrência de culpas", "Concorrência de instrumentos de regulamentação colectiva",
  "Concorrência desleal", "Concurso", "Condenação em multa", "Condenação extra vel ultra petitum", "Condição resolutiva",
  "Condição suspensiva", "Condições de trabalho", "Condomínio", "Confidencialidade de mensagens", "Confissão",
  "Confissão do pedido", "Confissão judicial", "Conflito de competência", "Conflito de normas", "Confusão", "Conhecimento no saneador",
  "Conhecimento oficioso", "Cônjuges", "Consentimento do trabalhador", "Consignação em depósito", "Constitucionalidade",
  "Construção civil", "Consulado português", "Consulta do processo", "Consulta dos trabalhadores", "Consumação",
  "Conta de custas", "Contagem de tempo de serviço", "Contestação", "Contra-alegações de recurso", "Contradição",
  "Contradita", "Contra-ordenação laboral", "Contra-ordenação muito grave", "Contraprova", "Contratação colectiva",
  "Contrato administrativo", "Contrato colectivo de trabalho", "Contrato de adesão", "Contrato de agência",
  "Contrato de aprendizagem", "Contrato de avença", "Contrato de empreitada", "Contrato de formação", "Contrato de prestação de serviço",
  "Contrato de seguro", "Contrato de tarefa", "Contrato de trabalho", "Contrato de trabalho a tempo parcial",
  "Contrato de trabalho a termo certo", "Contrato de trabalho a termo incerto", "Contrato de trabalho a termo resolutivo",
  "Contrato de trabalho com entidade pública", "Contrato de trabalho de muito curta duração", "Contrato de trabalho desportivo",
  "Contrato de trabalho doméstico", "Contrato de trabalho dos profissionais de espectáculos", "Contrato de trabalho em funções públicas",
  "Contrato de trabalho intermitente", "Contrato de trabalho plurilocalizado", "Contrato de trabalho temporário",
  "Contrato de utilização", "Contrato-promessa de trabalho", "Contratos sucessivos", "Contribuições para a Segurança Social",
  "Controlo informático", "Convalidação", "Convenção colectiva de trabalho", "Conversão da incapacidade temporária em permanente",
  "Conversão do contrato", "Cooperativa", "Correio electrónico", "COVID-19", "Crédito de horas", "Crédito ilíquido",
  "Crédito laboral", "Crédito não reconhecido", "Crédito privilegiado", "Crise empresarial", "Critérios de selecção", "Culpa",
  "Culpa concorrente de terceiro", "Culpa da empresa utilizadora", "Culpa do empregador", "Culpa do sinistrado", "Culpa exclusiva",
  "Culpa grave", "Culpa in contrahendo", "Cumulação de indemnizações", "Cumulação de pedidos", "Cúmulo jurídico", "Custas",
  "Custos aleatórios", "Dados pessoais", "Dano", "Danos patrimoniais", "Danos não patrimoniais", "Decisão administrativa",
  "Decisão condenatória", "Decisão disciplinar", "Decisão do Presidente do STJ", "Decisão final", "Decisão implícita",
  "Decisão intercalar", "Decisão prematura", "Decisão surpresa", "Declaração de não renovação", "Declaração de renovação",
  "Declaração inexacta", "Declaração receptícia", "Declaração tácita", "Declaração unilateral",
  "Declarações de parte", "Dedução de rendimentos auferidos após o despedimento", "Deficiência da gravação",
  "Delegação de poderes", "Delegado sindical", "Deliberação da Assembleia-Geral", "Deliberação social", "Denúncia do contrato de trabalho",
  "Dependência económica", "Depoimento de parte", "Depósito bancário", "Descanso compensatório", "Descanso diário",
  "Descanso semanal", "Descanso semanal complementar", "Descanso semanal obrigatório", "Desccaracterização de acidente de trabalho",
  "Desconsideração da personalidade colectiva", "Descontos na retribuição", "Descontos para a Segurança Social",
  "Desprezo pelas regras de segurança", "Deserção do recurso", "Desfiliação", "Deslocação em serviço", "Desmembramento de empresa",
  "Desobediência", "Despachante oficial", "Despacho", "Despacho de aperfeiçoamento", "Despacho de arquivamento do inquérito",
  "Despacho de mero expediente", "Despacho do relator", "Despacho homologatório", "Despacho liminar", "Despacho normativo",
  "Despacho saneador", "Despacho sobre a admissão de recurso", "Despedimento", "Despedimento colectivo", "Despedimento de facto",
  "Despedimento ilícito", "Despedimento sem justa causa", "Despesas de deslocação", "Despesas de funeral", "Despesas de tratamento",
  "Destacamento de trabalhador", "Dever de apresentação de documentos", "Dever de assiduidade",
  "Dever de cooperação para a descoberta da verdade", "Dever de custódia", "Dever de fidelidade", "Dever de gestão processual",
  "Dever de lealdade", "Dever de não concorrência", "Dever de obediência", "Dever de ocupação efectiva", "Dever de probidade",
  "Dever de respeito", "Dever de urbanidade", "Dever de zelo e diligência", "Deveres de informação", "Deveres do empregador",
  "Deveres laborais", "Deveres secundários", "Difamação", "Diferenças salariais", "Dilação", "Diligência de instrução",
  "Diminuição da retribuição", "Directiva comunitária", "Direito a férias", "Direito a pensão", "Direito à reforma",
  "Direito à retribuição", "Direito ao trabalho", "Direito ao tratamento médico", "Direito ao trespasse", "Direito comunitário",
  "Direito de acção", "Direito de crítica", "Direito de defesa", "Direito de escolha", "Direito de opção", "Direito de oposição",
  "Direito de regresso", "Direito disciplinar", "Direito internacional", "Direitos de personalidade", "Direitos fundamentais",
  "Direitos indisponíveis", "Dirigente sindical", "Discricionariedade", "Discriminação", "Dispensa da audiência prévia",
  "Dispensa para amamentação", "Dispensa para consultas", "Dissolução de sociedade", "Diuturnidades", "Doação", "Documento",
  "Documento autêntico", "Documento idóneo", "Documento particular", "Documento superveniente", "Doença profissional",
  "Dolo", "Dono da obra", "Dupla conforme", "Dupla indemnização", "Duplo grau de jurisdição", "Duração do trabalho", "Efeito devolutivo",
  "Efeito do recurso", "Efeito suspensivo", "Eficácia da declaração negocial", "Eficácia do acto", "Eficácia retroactiva",
  "Eleição", "Eleito local", "Elemento subjectivo", "Embargos de executado", "Embargos de terceiro", "Empregador",
  "Emprego-inserção", "Emprego-inserção +", "Empreitada", "Empresa de capitais privados", "Empresa de serviços de limpeza",
  "Empresa de trabalho temporário", "Empresa familiar", "Empresa petrolífera", "Empresa pública", "Encerramento da empresa",
  "Encerramento de estabelecimento comercial", "Enfermeiro", "Enriquecimento sem causa", "Ensino particular", "Ensino profissional",
  "Ensino superior particular e cooperativo", "Entidade contratada pelo empregador", "Entidade executante",
  "Entidade pública empresarial", "Entrega do capital da remição", "Equidade", "Equipamentos de trabalho", "Erro",
  "Erro da secretaria judicial", "Erro de julgamento", "Erro material", "Erro na appreciation das provas", "Erro na declaração",
  "Erro na forma do processo", "Erro na transmissão da declaração", "Erro sobre os motivos do negócio", "Especificação",
  "Estabelecimento comercial", "Estabelecimento industrial", "Estado", "Estado de emergência", "Estado de necessidade",
  "Estado estrangeiro", "Estafeta", "Estágio", "Estaleiros temporários ou móveis", "Estatuto do trabalhador cooperante",
  "Evento organizado pelo empregador", "Evolução salarial", "Exame médico", "Excepção dilatória", "Excepção peremptória",
  "Excesso de pronúncia", "Execução", "Execução de direitos irrenunciáveis", "Execução de sanção disciplinar",
  "Execução de sentença", "Execução para prestação de facto", "Execução por coima", "Expectativa jurídica", "Expediente dilatório",
  "Extinção de posto de trabalho", "Extinção de sociedade", "Extinção do contrato de trabalho", "Extinção do poder jurisdicional",
  "Facility Services", "Facto constitutivo", "Facto duradouro", "Factor de bonificação 1,5", "Factos admitidos por acordo",
  "Factos complementares", "Factos conclusivos", "Factos concretizadores", "Factos continuados", "Factos essenciais",
  "Factos instrumentais", "Factos não alegados", "Factos não constantes da nota de culpa", "Factos notórios", "Factos pessoal",
  "Factos supervenientes", "Facturas", "Falência", "Falsas declarações", "Falta da entidade responsável",
  "Falta de apresentação do procedimento disciplinar", "Falta de aviso prévio", "Falta de citação", "Falta de contestação",
  "Falta de fundamentação", "Falta de pagamento da retribuição", "Falta do réu", "Falta grave e indesculpável",
  "Faltas injustificadas", "Faltas justificadas", "Familiares do trabalhador", "Farmácia", "Fase administrativa",
  "Fase conciliatória", "Fase contenciosa", "Fase de negociações", "FAT", "Férias", "Férias judiciais", "Filiação sindical",
  "Fixação da incapacidade", "Fixação judicial da retribuição", "Folhas de férias", "Fontes de direito", "Força maior",
  "Força probatória", "Força vinculativa", "Forma do contrato", "Forma do processo", "Forma escrita", "Formação", "Formação profissional",
  "Formalidades ad probationem", "Formalidades ad substantiam", "Formulário", "Fraude à lei", "Fundação", "Função pública",
  "Fundamentação", "Fundamentação de direito", "Fundamentação de facto", "Fundo de compensação do trabalho",
  "Fundo de garantia de compensação do trabalho", "Fundo de pensões", "Fusão de empresas", "Futebolista profissional",
  "Garantia autónoma", "Garantia bancária", "Garantia de defesa", "Garantia do pagamento", "Garantias do trabalhador",
  "Genérico agrícola", "Gerente", "Gestor público", "GPS", "Graduação de créditos", "Grandes superfícies", "Gratificação",
  "Gratificação extraordinária", "Gravação da audiência", "Gravação da prova", "Gravidade da infracção", "Greve",
  "Grupo de empresas", "Habilitação de herdeiros", "Herança indivisa", "Homologação de deliberação da assembleia de credores",
  "Honorários", "Horário de trabalho", "Horário flexível", "Hospital", "IAS", "Igreja", "Igualdade das partes", "Ilações",
  "Ilicitude", "Ilisão", "Impedimento", "Impenhorabilidade", "Imperatividade da lei", "Impossibilidade absoluta",
  "Impossibilidade definitiva", "Impossibilidade do cumprimento", "Impossibilidade objectiva", "Impossibilidade superveniente",
  "Impossibilidade temporária", "Impugnação da matéria de facto", "Impugnação diferida de decisões intercalares",
  "Imunidade jurisdicional", "Inadaptação do trabalhador", "Incompetência absoluta", "Incompetência relativa",
  "Inconstitucionalidade", "Incumprimento do contrato",
  "Incumprimento parcial", "Incumprimento por facto de terceiro", "Indeferimento liminar", "Indeferimento tácito",
  "Indemnização", "Indemnização de antiguidade", "Indemnização por falta de aviso prévio",
  "Indemnização por incumprimento de obrigações laborais", "Indeterminabilidade", "Indeterminação do objecto",
  "Indícios de subordinação jurídica", "Indivisibilidade", "Ineptidão da petição inicial", "Informação e consulta",
  "Informação genética", "Infracção continuada", "Infracção disciplinar", "Infracção estradal", "Início de laboração",
  "Inimputabilidade", "Injúrias", "Inquérito", "Inquérito prévio", "Inquirição de testemunhas", "Insolvência", "Interpelação",
  "Intervalo de descanso", "Instituição Particular de Solidariedade Social", "Instituições de crédito",
  "Instituto de Segurança Social", "Instituto do Emprego e Formação Profimplamentaional", "Parecer do Ministério Público", "Parecer do Sindicato",
  "Parecer técnico", "Parentalidade", "Património autónomo", "Participação de acidente de trabalho", "Patrocínio oficioso",
  "Pedido", "Pedido de juros", "Pedido genérico", "Pedido principal", "Pedido subsidiário", "Pedidos alternativos", "Penhora",
  "Pensão", "Pensão complementar de reforma", "Pensão de reduzido montante", "Pensão de reforma", "Pensão de sobrevivência",
  "Pensão por incapacidade", "Pensão por morte", "Pensão provisória", "Perda de local de trabalho", "Período de condução",
  "Período de repouso", "Período de funcionamento", "Período experimental", "Período normal de trabalho", "PER",
  "Personalidade judiciária", "Pessoa colectiva", "Petição deficiente", "Petição inicial", "Plataforma digital",
  "Pluralidade de empregadores", "Pluralidade de entidades responsáveis", "Pluralidade subjectiva subsidiária", "Pluriemprego",
  "Poder de direção", "Poder disciplinar", "Poder discricionário", "Poderes da Relação", "Poderes de representação",
  "Poderes do juiz", "Poderes do Supremo Tribunal de Justiça", "Poderes do tribunal", "Polivalência funcional",
  "Portaria de extensão", "Portaria de Regulamentação do Trabalho para os trabalhadores administrativos", "Posto de trabalho",
  "Prática disciplinar", "Praticante desportivo", "Prazo", "Prazo de caducidade", "Prazo de interposição do recurso",
  "Prazo de propositura da acção", "Prazo judicial", "Predisposição patológica", "Preferência", "Prejuízo sério", "Prémio",
  "Prémio de assiduidade", "Prémio de desempenho", "Prémio de produtividade", "Prémio fixo", "Prémio TIR", "Prémio variável",
  "Pré-reforma", "Prescrição", "Prescrição da infracção", "Prescrição de créditos", "Prescrição extintiva",
  "Prestação suplementar", "Prestações em espécie", "Prestações médicas e medicamentosas", "Prestações periódicas",
  "Prestações por doença", "Presunção de abandono", "Presunção de aceitação do despedimento", "Presunção de culpa",
  "Presunção de inexistência de justa causa", "Presunção de laboralidade", "Presunção de notificação", "Presunção juris et de jure",
  "Presunção juris tantum", "Presunções", "Presunções judiciais", "Presunções legais", "Preterição do tribunal arbitral",
  "PREVPAP", "Primado do direito da União Europeia", "Princípio da adequação formal", "Princípio da aquisição processual",
  "Princípio da concentração da defesa", "Princípio da confiança", "Princípio da cooperação", "Princípio da economia processual",
  "Princípio da filiação", "Princípio da igualdade", "Princípio da indivisibilidade da confissão",
  "Princípio da interpretação conforme o direito comunitário", "Princípio da irreversibilidade", "Princípio da legalidade",
  "Princípio da liberdade de desvinculação", "Princípio da livre apreciação da prova", "Princípio da preclusão",
  "Princípio da proporcionalidade", "Princípio da segurança no emprego", "Princípio do contraditório", "Princípio do dispositivo",
  "Princípio do pedido", "Princípio do tratamento mais favorável", "Princípio geral de aproveitamento do processado",
  "Privilégio creditório", "Procedimento", "Procedimento disciplinar", "Procedimento disciplinar incompleto",
  "Procedimento cautelar", "Processo comum", "Processo de contra-ordenação", "Processo de insolvência", "Processo de trabalho",
  "Processo equitativo", "Processo especial de recuperação de empresa", "Processo executivo", "Processo penal",
  "Processo urgente", "Procuração", "Professor", "Professor universitário", "Progressão na carreira", "Progressão salarial",
  "Progressão na categoria", "Proibição de discrimininação", "Proibição de prova", "Proibição do lock-out",
  "Promessa de contrato de trabalho", "Proporcionais de férias e de subsídios de férias e de Natal", "Propositura da acção",
  "Prorrogação do prazo", "Protecção contra quedas", "Protecção da maternidade e paternidade", "Protecção de dados pessoais",
  "Protocolo", "Prova", "Prova documental", "Prova gravada", "Prova pericial", "Prova plena", "Prova por confissão",
  "Prova por declarações de parte", "Prova por documentos particulares", "Prova proibida", "Prova testemunhal",
  "Prova vinculada", "Publicidade", "Qualificação jurídica", "Quantia exequenda", "Quantum indemnizatório", "Queda em altura",
  "Questão de direito", "Questão de facto", "Questão nova", "Questão prejudicial", "Quitação", "Ratificação",
  "Reabilitação profissional", "Recibo de quitação", "Recidiva", "Reclamação", "Reclamação de créditos",
  "Reclamação para a Conferência", "Reclamação ulterior de créditos de acidente de trabalho", "Reclassificação",
  "Reconhecimento da dívida", "Reconstituição natural", "Reconvenção", "Reconversão profissional", "Rectificação de erros materiais",
  "Rectificação de pensão", "Rectificação de sentença", "Recurso", "Recurso de apelação", "Recurso de contra-ordenação",
  "Recurso de revisão", "Recurso de revista", "Recurso extraordinário para uniformização de jurisprudência", "Recurso independente",
  "Recurso laboral", "Recurso para o Supremo Tribunal de Justiça", "Recurso per saltum", "Recurso subordinado", "Recusa de cooperação",
  "Recusa de assistência médica", "Recusa de tratamento", "Redução do contrato", "Redução do período normal de trabalho",
  "Reembolso de despesas", "Reembolsos à Segurança Social", "Reenvio prejudicial", "Reestruturação de empresa", "Refeições",
  "REFER", "Reforma", "Reforma antecipada", "Reforma da decisão", "Reforma de acórdão", "Reforma por invalidez",
  "Reforma por velhice", "Reformatio in pejus", "Regime disciplinar", "Regime geral da Segurança Social", "Regime transitório",
  "Registo", "Regulamentação colectiva", "Regulamento (CE) n.º 561/2006", "Regulamento (UE) n.º 165/2014", "Regulamento interno",
  "Reinserção profissional", "Reincidência", "Reintegração", "Rejeição de recurso", "Relação de emprego",
  "Relação jurídica administrativa", "Relações de trabalho plurilocalizadas", "Relações entre fontes de regulação",
  "Remição de pensão", "Remição facultativa", "Remição parcial", "Remissão abdicativa", "Remissão para documentos",
  "Renovação da instância", "Renovação da prova", "Renovação do contrato", "Renúncia", "Repetição do julgamento", "Repouso",
  "Representante", "Representante sindical", "Repristinação", "Requerimento executivo", "Requisição", "Requisitos",
  "Reserva da vida privada", "Residência", "Residência ocasional", "Resolução do contrato de trabalho", "Responsabilidade",
  "Responsabilidade agravada", "Responsabilidade civil", "Responsabilidade civil emergente de acidente de trabalho",
  "Responsabilidade contratual", "Responsabilidade criminal", "Responsabilidade da entidade contratante",
  "Responsabilidade do empregador", "Responsabilidade do trabalhador", "Responsabilidade disciplinar",
  "Responsabilidade extracontratual", "Responsabilidade objectiva", "Responsabilidade pré-contratual", "Responsabilidade solidária",
  "Responsabilidade subsidiária", "Resposta à contestação", "Resposta à nota de culpa", "Restrição do objecto do recurso",
  "Retribuição", "Retribuição de férias", "Retribuição de referência", "Retribuição em espécie", "Retribuição ilíquida",
  "Retribuição líquida", "Retribuição mínima mensal garantida", "Retribuição mista", "Retribuição variável", "Retribuição-base",
  "Retribuições em dívida", "Retribuições intercalares", "Revalidação do contrato nulo", "Revelia", "Reversão",
  "Revisão de incapacidade", "Revisão de sentença estrangeira", "Revista excepcional", "Revogação", "Revogação da sentença",
  "Revogação do contrato de trabalho", "RGPD", "Rotação de cheques", "RTP", "Sanção abusiva", "Sanção acessória",
  "Sanção disciplinar", "Sanção pecuniária compulsória", "Saneador-sentença", "Sector bancário", "Sector económico de atividade",
  "Sector empresarial do Estado", "Sector portuário", "Segredo comercial", "Segredo das telecomunicações", "Segredo profissional",
  "Segurança e saúde no trabalho", "Segurança no emprego", "Segurança Social", "Seguro", "Seguro de acidentes de trabalho",
  "Seguro de vida", "Sentença", "Sentença criminal", "Sentença homologatória", "Serviço militar obrigatório",
  "Serviços consentidos pelo empregador", "Serviços de Segurança e Saúde no Trabalho", "Serviços de vigilância e segurança",
  "Serviços espontâneos", "Serviços essenciais", "Serviços mínimos", "Sigilo bancário", "Simulação", "Sindicato", "Sobrevigência",
  "Sociedade", "Sociedade anónima", "Sociedades em relação de participações recíprocas, de domínio ou de grupo",
  "Sociedade por quotas", "Sociedade unipessoal", "Sócio gerente", "Subcontratação", "Subempreitada", "Subordinação jurídica",
  "Subrogação", "Subsidiariedade", "Subsídio de agente único", "Subsídio de alimentação", "Subsídio de desemprego",
  "Subsídio de deslocação", "Subsídio de disponibilidade", "Subsídio de doença", "Subsídio de exclusividade", "Subsídio de férias",
  "Subsídio de função", "Subsídio de funeral", "Subsídio de isenção de horário de trabalho", "Subsídio de Natal",
  "Subsídio de turno", "Subsídio para a criação de próprio emprego", "Subsídio para readaptação da habitação",
  "Subsídio por elevada incapacidade permanente", "Subsídio por morte", "Substituição do tribunal recorrido",
  "Substituição temporária de trabalhador", "Sucessão de instrumentos de regulamentação colectiva", "Sucessão de leis no tempo",
  "Sucessão na posição contratual", "Sucumbência", "Suspensão", "Suspensão da execução da coima", "Suspensão da instância",
  "Suspensão do contrato de trabalho", "Suspensão do despedimento", "Suspensão do despedimento colectivo",
  "Suspensão do trabalho", "Suspensão preventiva", "Tacógrafo", "Taxa de juro", "Taxa de justiça", "Teleconferência",
  "Telecópia", "Telemóvel", "Temas da prova", "Tempestividade", "Tempo de deslocação", "Tempo de disponibilidade",
  "Tempo de trabalho", "Tentativa de conciliação", "Testemunha", "Testes e exames médicos", "Título executivo", "Tomador do seguro",
  "Trabalhador à procura de primeiro emprego", "Trabalhador com capacidade de trabalho reduzida", "Trabalhador com deficiência",
  "Trabalhador com doença crónica", "Trabalhador com responsabilidades familiares", "Trabalhador cooperante",
  "Trabalhador de consulado", "Trabalhador de empresa petrolífera", "Trabalhador de seguros", "Trabalhador estudante",
  "Trabalhador estrangeiro", "Trabalhador eventual", "Trabalhador independente", "Trabalhador no estrangeiro", "Trabalhador menor",
  "Trabalhador não sindicalizado", "Trabalhador permanente", "Trabalhador subordinado", "Trabalhador temporário",
  "Trabalhadora grávida", "Trabalho a bordo", "Trabalho ao domingo", "Trabalho aparentemente autónomo", "Trabalho de curta duração",
  "Trabalho efectivo", "Trabalho em dias de descanso", "Trabalho em feriado", "Trabalho igual salário igual", "Trabalho nocturno",
  "Trabalho no domicílio", "Trabalho ocasional", "Trabalho por turnos", "Trabalho portuário", "Trabalho rural", "Trabalho sazonal",
  "Trabalho suplementar", "Trabalho voluntário", "Trajecto normal", "Transacção", "Transferência definitiva de trabalhador",
  "Transferência temporária de trabalhador", "Trânsito em julgado", "Transmissão da posição contratual", "Transmissão de dívida",
  "Transmissão de estabelecimento", "Transmissão parcial de estabelecimento", "Transporte internacional de mercadorias por estrada",
  "Tratamento subsequente ao acidente", "Treinador", "Tribunal Administrativo", "Tribunal Arbitral", "Tribunal Constitucional",
  "Tribunal da Relação", "Tribunal de Comarca", "Tribunal dos Conflitos", "Truck sistem", "União de facto", "União Europeia",
  "Unidade comercial de dimensão relevante", "Uniformização de jurisprudência", "Usos laborais", "Valor da causa",
  "Valor do silêncio como meio declarativo", "Valor probatório", "Veículo automóvel", "Vencimento da dívida",
  "Venda judicial", "Vendedor", "Vícios da vontade", "Videovigilância", "Vinculação de pessoa colectiva",
  "Violação de regras de segurança", "Violação do direito a férias", "Vontade real do declarante", "Whatsapp"
];

function App() {
  const [db, setDb] = useState<Acordao[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [descriptors, setDescriptors] = useState<{social: string[], crime: string[], civil: string[]}>({
    social: Array.from(new Set(SOCIAL_DESCRIPTORS_LIST)).sort(),
    crime: [],
    civil: []
  });
  const [judges, setJudges] = useState<string[]>([]);
  const [legalArea, setLegalArea] = useState<'social' | 'crime' | 'civil' | null>(null);
  const [activeTab, setActiveTab] = useState<'process' | 'search' | 'chat'>('process');
  const [rootHandleName, setRootHandleName] = useState<string | null>(null);
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null);
  
  const [isAiConfigured, setIsAiConfigured] = useState<boolean>(false);
  const [isAiConnecting, setIsAiConnecting] = useState<boolean>(false);
  
  const [onboardingStep, setOnboardingStep] = useState<'key' | 'area' | 'app'>('key');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const selectLegalArea = (area: 'social' | 'crime' | 'civil') => {
    setLegalArea(area);
    setOnboardingStep('app');
  };

  useEffect(() => {
    const checkAiKey = async () => {
      if (window.aistudio) {
        try {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          setIsAiConfigured(hasKey);
          if (hasKey && onboardingStep === 'key') {
             setOnboardingStep('area');
          }
        } catch (e) {
          console.debug("AI Studio context not yet ready");
        }
      }
    };
    checkAiKey();
  }, [onboardingStep]);

  const handleOpenAiKeyDialog = async () => {
    if (!window.aistudio) {
        alert("O sistema de faturamento do AI Studio não está acessível neste ambiente.");
        return;
    }

    try {
      setIsAiConnecting(true);
      // Rules: Add a button which calls await window.aistudio.openSelectKey()
      await window.aistudio.openSelectKey();
      
      // Rules: Race condition: A race condition can occur where hasSelectedApiKey() 
      // may not immediately return true after the user selects a key with openSelectKey(). 
      // To mitigate this, you MUST assume the key selection was successful 
      // after triggering openSelectKey() and proceed to the app.
      setIsAiConfigured(true);
      if (onboardingStep === 'key') {
          setOnboardingStep('area');
      }
    } catch (e) {
      console.error("Falha ao abrir seletor de chaves:", e);
      alert("Ocorreu um erro ao tentar ligar a sua conta Google.");
    } finally {
      setIsAiConnecting(false);
    }
  };

  useEffect(() => {
    const extracted = new Set<string>();
    db.forEach(ac => {
      if (ac.relator && ac.relator !== 'Desconhecido') extracted.add(ac.relator.trim());
      ac.adjuntos.forEach(adj => { 
        if (adj && adj !== 'Nenhum' && adj.trim().length > 0) extracted.add(adj.trim()); 
      });
    });
    setJudges(Array.from(extracted).sort((a, b) => a.localeCompare(b, 'pt-PT')));
  }, [db]);

  const handleMergeJudges = (main: string, others: string[]) => {
    const mainClean = main.trim();
    const othersLower = others.map(o => o.trim().toLowerCase());

    setDb(currentDb => {
      return currentDb.map(ac => {
        let changed = false;
        let newRelator = ac.relator.trim();
        if (othersLower.includes(newRelator.toLowerCase())) {
          newRelator = mainClean;
          changed = true;
        }
        const newAdjuntos = ac.adjuntos.map(adj => {
          const adjTrimmed = adj.trim();
          if (othersLower.includes(adjTrimmed.toLowerCase())) {
            changed = true;
            return mainClean;
          }
          return adjTrimmed;
        });

        if (changed) {
            const uniqueAdjuntos = Array.from(new Set(newAdjuntos))
              .filter(a => a.toLowerCase() !== newRelator.toLowerCase() && a !== 'Nenhum' && a.length > 0);
            return { ...ac, relator: newRelator, adjuntos: uniqueAdjuntos };
        }
        return ac;
      });
    });
  };

  const handleSetRoot = (handle: FileSystemDirectoryHandle) => {
    setRootHandle(handle);
    setRootHandleName(handle.name);
    setActiveTab('process');
  };

  const handleAddAcordaos = (incoming: Acordao[]) => {
    setDb(currentDb => {
        const dbMap = new Map<string, Acordao>();
        currentDb.forEach(a => dbMap.set(a.processo.toLowerCase().trim(), a));
        incoming.forEach(newA => {
            const procKey = newA.processo.toLowerCase().trim();
            if (!dbMap.has(procKey)) dbMap.set(procKey, newA);
        });
        return Array.from(dbMap.values());
    });
  };

  const openPdf = async (fileName: string) => {
    if (rootHandle) {
       const findFile = async (dir: FileSystemDirectoryHandle, name: string): Promise<FileSystemFileHandle | null> => {
          for await (const entry of (dir as any).values()) {
             if (entry.kind === 'file' && entry.name === name) return entry;
             if (entry.kind === 'directory') {
                const found = await findFile(entry as any, name);
                if (found) return found;
             }
          }
          return null;
       };
       const handle = await findFile(rootHandle, fileName);
       if (handle) {
          const file = await handle.getFile();
          window.open(URL.createObjectURL(file), '_blank');
       } else {
           alert("Ficheiro não encontrado na pasta selecionada.");
       }
    } else {
        alert("Por favor, selecione a pasta de acórdãos no separador Processamento.");
    }
  };

  const handleSaveDb = () => {
    const json = JSON.stringify({ db, descriptors, judges }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `juris_backup_legal_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  const handleSaveChats = () => {
    const json = JSON.stringify({ chatSessions }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `juris_chats_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  const handleLoadDbFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed.db) handleAddAcordaos(parsed.db);
        if (parsed.descriptors) {
            const merged = { ...descriptors };
            if (parsed.descriptors.social) merged.social = Array.from(new Set([...descriptors.social, ...parsed.descriptors.social])).sort();
            if (parsed.descriptors.crime) merged.crime = Array.from(new Set([...descriptors.crime, ...parsed.descriptors.crime])).sort();
            if (parsed.descriptors.civil) merged.civil = Array.from(new Set([...descriptors.civil, ...parsed.descriptors.civil])).sort();
            setDescriptors(merged);
        }
        if (onboardingStep !== 'key') setOnboardingStep('app');
      } catch (err) {
        alert("Erro ao ler ficheiro de backup jurídico.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const handleLoadChatFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed.chatSessions) {
            setChatSessions(current => {
                const existingIds = new Set(current.map(s => s.id));
                const filteredNew = parsed.chatSessions.filter((s: ChatSession) => !existingIds.has(s.id));
                return [...filteredNew, ...current];
            });
            alert("Base de dados de chat carregada e fundida com sucesso.");
        }
      } catch (err) {
        alert("Erro ao ler ficheiro de chat.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (onboardingStep === 'key') {
    return (
      <div className="fixed inset-0 bg-slate-950 z-[100] flex items-center justify-center p-4">
        <div className="bg-slate-900 rounded-[32px] shadow-2xl p-12 max-w-[600px] w-full text-center border border-slate-800 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-sky-400 to-blue-600"></div>
            <div className="mb-10 flex justify-center">
              <div className="p-8 bg-blue-500/10 rounded-full border border-blue-500/20">
                <ShieldCheck className="w-12 h-12 text-blue-400"/>
              </div>
            </div>
            <h2 className="text-3xl font-black mb-4 tracking-tighter text-white uppercase">Ligação Segura à IA</h2>
            <p className="text-slate-400 mb-8 text-sm leading-relaxed">
                Esta aplicação funciona no modelo <strong>Faturamento Individual (BYOK)</strong>. 
                Os seus documentos nunca saem deste browser, mas para que a IA os analise, 
                precisa de ligar a sua própria conta paga da Google Cloud/AI Studio.
            </p>
            <div className="space-y-4">
                <button 
                    onClick={handleOpenAiKeyDialog} 
                    disabled={isAiConnecting}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white p-6 rounded-[20px] font-black uppercase text-xs tracking-widest transition-all shadow-xl shadow-blue-900/20 active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                    {isAiConnecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Globe className="w-5 h-5"/>}
                    {isAiConnecting ? 'A abrir diálogo...' : 'Ligar a minha Conta Google (IA Studio)'}
                </button>
                <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-2xl text-left border border-slate-700/50">
                    <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                        Ao clicar, será aberto um diálogo oficial da Google. Pode revogar este acesso a qualquer momento.
                        <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-blue-500 ml-1 underline flex items-center gap-1 mt-1">
                            Consultar Custos da Google <ExternalLink className="w-3 h-3"/>
                        </a>
                    </p>
                </div>
            </div>
        </div>
      </div>
    );
  }

  const mainContent = onboardingStep === 'app' ? (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-legal-900 text-white shadow-xl z-50 flex-shrink-0">
        <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ScaleIcon className="w-8 h-8 text-legal-100" />
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">JurisAnalítica</h1>
              <p className="text-[9px] text-legal-400 uppercase tracking-widest font-black mt-1">Área {legalArea}</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            
            <button 
                onClick={handleOpenAiKeyDialog}
                disabled={isAiConnecting}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all border ${isAiConfigured ? 'bg-green-500/10 border-green-500/20 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.15)]' : 'bg-orange-500/10 border-orange-500/20 text-orange-400'} disabled:opacity-50`}
                title="Sua chave pessoal Google AI Studio"
            >
                {isAiConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : isAiConfigured ? <ShieldCheck className="w-4 h-4" /> : <Key className="w-4 h-4" />}
                {isAiConnecting ? 'Ligando...' : isAiConfigured ? 'Faturamento Pessoal Ativo' : 'Ligar IA Pessoal'}
            </button>

            <div className="h-10 w-px bg-legal-800 mx-2 self-center"></div>
            
            <div className="flex gap-1 items-center bg-legal-800/40 p-1 rounded-2xl border border-legal-700">
                <button onClick={() => chatInputRef.current?.click()} className="p-2.5 text-legal-300 hover:text-white hover:bg-legal-700 rounded-xl transition-all" title="Importar Histórico de Chat">
                    <History className="w-4 h-4" />
                </button>
                <button onClick={handleSaveChats} className="flex items-center gap-2 px-4 py-2 bg-legal-700 hover:bg-legal-600 rounded-xl text-[9px] font-black uppercase transition-all" title="Backup Base de Dados de Chat">
                    <Download className="w-4 h-4" /> Chats
                </button>
            </div>

            <div className="flex gap-1 items-center bg-legal-800/40 p-1 rounded-2xl border border-legal-700 ml-2">
                <button onClick={() => fileInputRef.current?.click()} className="p-2.5 text-legal-300 hover:text-white hover:bg-legal-700 rounded-xl transition-all" title="Importar Acórdãos/Backup Geral">
                    <Upload className="w-4 h-4" />
                </button>
                <button onClick={handleSaveDb} className="flex items-center gap-2 px-4 py-2 bg-white text-legal-900 hover:bg-legal-50 rounded-xl text-[9px] font-black uppercase transition-all" title="Backup Base de Dados Jurídica">
                    <Save className="w-4 h-4" /> Acórdãos
                </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="bg-white border-b px-8 pt-4 flex gap-8 flex-shrink-0 shadow-sm z-10">
            {['process', 'search', 'chat'].map((tab: any) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-4 px-2 text-[11px] font-black uppercase tracking-[0.15em] border-b-[3px] transition-all ${activeTab === tab ? 'border-legal-600 text-legal-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                {tab === 'process' ? 'Processamento' : tab === 'search' ? 'Biblioteca' : 'Consultoria IA'}
              </button>
            ))}
        </div>
        <div className="flex-1 overflow-hidden bg-gray-50 relative">
            {activeTab === 'process' && legalArea && (
              <ProcessingModule 
                onDataLoaded={handleAddAcordaos} 
                existingDB={db} 
                onSetRootHandle={handleSetRoot} 
                rootHandleName={rootHandleName} 
                onCacheFiles={() => {}} 
                onAddDescriptors={(cat, l) => setDescriptors(p=>({...p, [cat]:l}))} 
                onAddJudges={setJudges} 
                onMergeJudges={handleMergeJudges}
                availableJudges={judges} 
                availableDescriptors={descriptors[legalArea]}
                legalArea={legalArea}
                onUpdateDb={setDb}
                onSaveDb={handleSaveDb}
              />
            )}
            {activeTab === 'search' && (
              <SearchModule 
                db={db} 
                onOpenPdf={openPdf} 
                onUpdateAcordao={u => setDb(p => p.map(x=>x.id===u.id?u:x))} 
                availableDescriptors={legalArea?descriptors[legalArea]:[]} 
                availableJudges={judges} 
                onSaveDb={handleSaveDb}
              />
            )}
            {activeTab === 'chat' && (
              <ChatModule 
                db={db} 
                sessions={chatSessions} 
                onSaveSession={s => setChatSessions(p => {
                    const idx = p.findIndex(x => x.id === s.id);
                    if (idx > -1) {
                        const next = [...p];
                        next[idx] = s;
                        return next;
                    }
                    return [s, ...p];
                })} 
                onDeleteSession={(id) => setChatSessions(p => p.filter(s => s.id !== id))} 
                onOpenPdf={openPdf}
              />
            )}
        </div>
      </div>
    </div>
  ) : (
    <div className="fixed inset-0 bg-[#0f172a] z-[100] flex items-center justify-center p-4">
      <div className="bg-[#1e293b] rounded-[32px] shadow-2xl p-10 max-w-[500px] w-full text-center border border-slate-700/50 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-legal-400 to-blue-500"></div>
          
          <div className="mb-10 flex justify-center">
            <div className="p-8 bg-blue-600/10 rounded-full border border-blue-600/20">
              <ScaleIcon className="w-12 h-12 text-blue-500"/>
            </div>
          </div>
          <h2 className="text-3xl font-black mb-2 tracking-tighter text-white uppercase">JurisAnalítica</h2>
          <p className="text-slate-400 mb-10 text-sm">Selecione a jurisdição ou importe uma base existente.</p>
          <div className="grid grid-cols-1 gap-4">
            {['social', 'crime', 'civil'].map((area: any) => (
              <button 
                key={area} 
                onClick={() => selectLegalArea(area)} 
                className="group p-6 rounded-[24px] border border-slate-700 bg-slate-800/50 hover:border-blue-500 hover:bg-slate-800 transition-all flex items-center gap-6 text-left active:scale-95 shadow-sm"
              >
                <div className="p-4 bg-slate-700 rounded-2xl group-hover:bg-blue-900/20 transition-all">
                  {area === 'social' ? <Briefcase className="w-8 h-8 text-blue-400"/> : area === 'crime' ? <Gavel className="w-8 h-8 text-blue-400"/> : <ScaleIcon className="w-8 h-8 text-blue-400"/>}
                </div>
                <div>
                    <div className="capitalize font-black text-xl text-white tracking-tighter">Área {area}</div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Sessão Limpa</div>
                </div>
              </button>
            ))}
            <div className="h-px bg-slate-700/50 my-6"></div>
            <div className="grid grid-cols-2 gap-3">
                <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border border-dashed border-slate-600 text-slate-400 hover:text-white hover:border-blue-500 transition-all font-bold text-[9px] uppercase tracking-widest group">
                    <Database className="w-5 h-5 group-hover:scale-110 transition-transform text-blue-500"/> Acórdãos
                </button>
                <button onClick={() => chatInputRef.current?.click()} className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border border-dashed border-slate-600 text-slate-400 hover:text-white hover:border-blue-500 transition-all font-bold text-[9px] uppercase tracking-widest group">
                    <MessageSquare className="w-5 h-5 group-hover:scale-110 transition-transform text-green-500"/> Histórico Chat
                </button>
            </div>
          </div>
      </div>
    </div>
  );

  return (
    <>
      {mainContent}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".json" 
        onChange={handleLoadDbFile}
      />
      <input 
        type="file" 
        ref={chatInputRef} 
        className="hidden" 
        accept=".json" 
        onChange={handleLoadChatFile}
      />
    </>
  );
}

export default App;
