Briefing sobre Processamento de Transações, Controle de Concorrência e Recuperação
Resumo Executivo

Este documento sintetiza os conceitos fundamentais de processamento de transações, controle de concorrência e recuperação em Sistemas Gerenciadores de Banco de Dados (SGBD). As transações são definidas como unidades lógicas e atômicas de trabalho, cuja integridade é garantida pelas propriedades ACID (Atomicidade, Consistência, Isolamento e Durabilidade). A Atomicidade assegura que uma transação seja executada por completo ou não seja executada. A Consistência garante que o banco de dados transite de um estado válido para outro. O Isolamento impede que transações concorrentes interfiram umas nas outras. A Durabilidade assegura que, uma vez efetivadas, as alterações persistam apesar de falhas.
Para gerenciar o acesso simultâneo aos dados e manter o isolamento, são empregadas técnicas de controle de concorrência, como protocolos de bloqueio (locking), ordenação por timestamp e métodos baseados em grafos. O objetivo é garantir que os planos de execução (schedules) sejam serializáveis, ou seja, equivalentes a uma execução serial das transações, prevenindo anomalias como atualizações perdidas e leituras sujas. A linguagem SQL oferece suporte robusto para transações, incluindo comandos como COMMIT e ROLLBACK e a definição de níveis de isolamento.
Finalmente, os mecanismos de recuperação são cruciais para garantir a atomicidade e a durabilidade em face de falhas. Utilizando um log de transações, o SGBD registra todas as operações, permitindo desfazer (UNDO) transações não concluídas e refazer (REDO) transações efetivadas que não foram persistidas no disco. Estratégias como checkpoints, modificação adiada e imediata, e algoritmos avançados como o ARIES, são implementados para restaurar o banco de dados a um estado consistente após qualquer tipo de falha.
Fundamentos de Transações em Banco de Dados
Definição e Propósito
Uma transação é um programa em execução ou um processo que inclui um ou mais acessos a um banco de dados, sendo considerada uma unidade lógica e atômica de trabalho. Seu propósito fundamental é agrupar um conjunto de operações que, juntas, realizam uma tarefa coesa. O SGBD, por meio de seu gerenciador de transações, garante que todas as operações dentro de uma transação sejam concluídas com sucesso ou que nenhuma delas seja efetivada, protegendo assim a integridade dos dados.
## As transações são delimitadas por comandos específicos:

* BEGIN TRANSACTION (ou START TRANSACTION): Marca o início da unidade de trabalho.
* COMMIT: Sinaliza a finalização bem-sucedida da transação, tornando permanentes todas as suas modificações no banco de dados.
* ROLLBACK (ou ABORT): Indica que a transação terminou sem sucesso, e todas as suas modificações devem ser desfeitas, retornando o banco de dados ao estado anterior ao início da transação.

As Propriedades ACID
Para garantir a integridade e a confiabilidade das operações, as transações em um SGBD devem aderir a quatro propriedades essenciais, conhecidas pelo acrônimo ACID.
| Propriedade | Descrição | Subsistema Responsável |
|---|---|---|
| Atomicidade | Garante que a transação é uma unidade indivisível: ou todas as suas operações são executadas com sucesso ("tudo"), ou nenhuma delas é executada ("nada"). Não existe a possibilidade de uma execução parcial. | Subsistema de Recuperação |
| Consistência | Assegura que a execução correta de uma transação leva o banco de dados de um estado consistente para outro, respeitando todas as restrições de integridade definidas. | Programadores e Módulo de Restrições de Integridade |
| Isolamento | Garante que transações concorrentes não interfiram umas nas outras. O efeito da execução concorrente de um conjunto de transações deve ser o mesmo que se elas fossem executadas sequencialmente. | Subsistema de Controle de Concorrência |
| Durabilidade | Uma vez que uma transação é efetivada (commit), suas modificações se tornam permanentes e não podem ser perdidas por falhas subsequentes no sistema (como quedas de energia). | Subsistema de Recuperação, Logs de Transação e Cópias de Segurança |

Ciclo de Vida de uma Transação (Estados)
Uma transação passa por vários estados desde seu início até sua conclusão, formando um ciclo de vida gerenciado pelo SGBD.
* Ativa: O estado inicial após a operação Begin Transaction. A transação pode executar operações de leitura (Read) e escrita (Write).
* Parcialmente Efetivada: Atingido após a execução da última operação (End Transaction). Neste ponto, todas as alterações foram gravadas no log, mas podem ainda não estar armazenadas permanentemente no banco de dados. Verificações são realizadas para garantir a possibilidade de efetivação.
* Efetivada (Committed): Após a operação de COMMIT, a transação é concluída com sucesso e suas alterações são gravadas de forma permanente em armazenamento não volátil.
* Falha: Se uma verificação falha ou a transação é interrompida durante o estado ativo, ela transita para o estado de falha. As operações já executadas precisam ser revertidas.
* Encerrada: O estado final da transação, após ser efetivada ou abortada, quando ela deixa o sistema.

O Log do Sistema e Pontos de Controle
Estrutura e Propósito do Log
O log de transações (também chamado de journal) é um mecanismo de segurança fundamental para garantir a atomicidade e a durabilidade. Ele consiste em um arquivo, armazenado em disco, que registra sequencialmente todas as operações que afetam os dados.
* Propósito: Permitir a recuperação do banco de dados após falhas. Com base nos registros do log, o SGBD pode desfazer operações de transações não efetivadas ou refazer operações de transações efetivadas que não foram gravadas em disco.
* Tipos de Entradas no Log:
* [start_transaction, T]: Início da transação T.
* [write_item, T, X, old-value, new-value]: Operação de escrita no item X.
* [read_item, T, X]: Operação de leitura no item X (necessária para evitar rollback em cascata ou para fins de auditoria).
* [commit, T]: Efetivação da transação T.
* [abort, T]: Aborto da transação T.
* Operações de Recuperação:
* UNDO: Desfaz uma operação específica, restaurando o valor antigo de um item de dados.
* REDO: Refaz uma operação, aplicando o novo valor a um item de dados.
* Idempotência: Ambas as operações são idempotentes, significando que aplicá-las múltiplas vezes produz o mesmo resultado que aplicá-las uma única vez.

Ponto de Efetivação (Commit Point) e Checkpoints
* Ponto de Efetivação: Uma transação atinge seu ponto de efetivação quando todas as suas operações foram executadas com sucesso e o registro de [commit, T] foi gravado no log. A partir deste ponto, a efetivação deve ser garantida.
* Checkpoint: É um mecanismo para otimizar o processo de recuperação. Periodicamente, o SGBD realiza um checkpoint, que envolve:
1. Suspender temporariamente a execução de transações.
2. Forçar a escrita de todas as operações de modificação das transações efetivadas dos buffers de memória para o disco.
3. Escrever um registro [checkpoint] no log.
4. Forçar a escrita do log em disco.
5. Retomar a execução das transações.

O checkpoint limita a quantidade de log que precisa ser analisada durante a recuperação, reduzindo o tempo de inatividade do sistema.
Gerenciamento da Concorrência
A Necessidade do Controle de Concorrência
Em sistemas multiusuário, várias transações podem ser executadas de forma paralela (concorrente) para melhorar a eficiência. No entanto, o acesso simultâneo não controlado aos mesmos dados pode levar a inconsistências, como o problema da atualização perdida, onde a alteração de uma transação é sobrescrita pela de outra. O subsistema de controle de concorrência monitora a interação entre transações para manter o isolamento e a consistência do banco de dados.
Planos de Execução (Schedules) e Serialidade
* Plano de Execução (Schedule): É a ordem na qual as operações de múltiplas transações concorrentes são executadas de forma intercalada.
* Plano Serial: Um plano onde as operações de cada transação são executadas consecutivamente, sem qualquer intercalação. Embora garanta a correção, limita severamente o desempenho.
* Serializabilidade: Um plano não serial é considerado serializável se for equivalente (em termos de resultado, conflito ou visão) a algum plano serial das mesmas transações. A serializabilidade é o critério padrão para a correção de planos de execução concorrentes.
* Conflito: Duas operações de transações distintas entram em conflito se acessam o mesmo item de dados e pelo menos uma delas é uma operação de escrita. A ordem das operações conflitantes é crucial para o resultado final.

Protocolos Baseados em Bloqueio (Locking)
Bloqueio é a técnica de controle de concorrência mais comum. Um lock é uma variável associada a um item de dados para controlar o acesso a ele.
* Tipos de Bloqueio:
* Bloqueio Binário: Possui dois estados: bloqueado (locked) e desbloqueado (unlocked).
* Bloqueio Múltiplo: Permite maior concorrência.
* Bloqueio Compartilhado (Shared Lock / read_lock): Várias transações podem obter um bloqueio compartilhado sobre o mesmo item para leitura.
* Bloqueio Exclusivo (Exclusive Lock / write_lock): Apenas uma transação pode obter um bloqueio exclusivo sobre um item para leitura e escrita.
* Protocolo de Bloqueio em Duas Fases (2PL): Garante a serializabilidade dos planos.
* Fase de Expansão (Growing Phase): A transação pode obter bloqueios, mas não pode liberar nenhum.
* Fase de Encolhimento (Shrinking Phase): A transação pode liberar bloqueios, mas não pode obter novos.
* Variações do 2PL:
* Básico: Conforme descrito acima.
* Conservador (Estático): Bloqueia todos os itens necessários antes do início da execução. Previne deadlocks, mas reduz a concorrência.
* Estrito (Severo): Libera os bloqueios de escrita apenas após o commit ou abort. Evita reversões em cascata.
* Rigoroso: Libera todos os bloqueios (leitura e escrita) apenas após o commit ou abort. É o mais restritivo e mais fácil de implementar.

Impasses (Deadlocks), Livelocks e Starvation
* Deadlock (Impasse): Ocorre quando duas ou mais transações esperam em um ciclo, cada uma por um bloqueio mantido pela outra.
* Prevenção: Uso de protocolos como o conservador ou a imposição de uma ordem de bloqueio. Estratégias como Wait-die (transação mais antiga espera, mais nova aborta) e Wound-wait (transação mais antiga força o aborto da mais nova) são usadas para evitar impasses.
* Detecção: O sistema detecta ciclos em um grafo de espera e escolhe uma transação "vítima" para sofrer rollback.
* Livelock: Uma transação não consegue progredir porque é repetidamente preterida em favor de outras devido a um esquema de espera injusto.
* Starvation: Uma transação é repetidamente escolhida como vítima de rollback em situações de deadlock ou é constantemente adiada, nunca conseguindo ser concluída.

Outras Técnicas de Controle de Concorrência
* Ordenação por Timestamp: A cada transação é associado um timestamp único. A ordem das operações é decidida com base nos timestamps das transações envolvidas, garantindo a serializabilidade.
* Protocolos Baseados em Grafos: Requerem conhecimento prévio sobre a ordem de acesso aos itens de dados, impondo uma estrutura (como uma árvore) para o bloqueio de itens.

Suporte a Transações em SQL
O padrão SQL/ANSI define um conjunto robusto de comandos e conceitos para o gerenciamento de transações.
Comandos de Gerenciamento
| Comando | Descrição |
|---|---|
| START TRANSACTION | Inicia uma nova transação. |
| COMMIT | Termina a transação corrente com sucesso, efetivando as alterações. |
| ROLLBACK | Termina a transação corrente sem sucesso, desfazendo as alterações. |
| SAVEPOINT | Estabelece um ponto intermediário na transação para o qual um ROLLBACK parcial pode ser executado. |
| RELEASE SAVEPOINT | Remove um savepoint previamente definido. |
| SET TRANSACTION | Define propriedades da transação, como o nível de isolamento e o modo de acesso. |

Níveis de Isolamento ANSI SQL
O padrão SQL define quatro níveis de isolamento para controlar o grau de interferência entre transações concorrentes. Cada nível previne certos tipos de anomalias de leitura.
| Nível de Isolamento | Leitura Suja (Dirty Read) | Leitura Não Repetível (Non-Repeatable Read) | Registros Fantasmas (Phantom Reads) |
|---|---|---|---|
| READ UNCOMMITTED | Possível | Possível | Possível |
| READ COMMITTED | Não Possível | Possível | Possível |
| REPEATABLE READ | Não Possível | Não Possível | Possível |
| SERIALIZABLE | Não Possível | Não Possível | Não Possível |

* Leitura Suja: Uma transação lê dados modificados por outra transação que ainda não foi efetivada.
* Leitura Não Repetível: Uma transação lê o mesmo dado duas vezes e obtém valores diferentes porque outra transação o modificou e efetivou entre as leituras.
* Registros Fantasmas: Uma transação executa a mesma consulta duas vezes e obtém um conjunto diferente de linhas porque outra transação inseriu ou excluiu registros que satisfazem a condição da consulta.

Estratégias de Recuperação Após Falhas
Tipos de Falhas e Estrutura de Armazenamento
A recuperação visa restaurar o banco de dados a um estado consistente após uma falha.
* Tipos de Falhas:
* Falha de Transação: Erros lógicos (dados inválidos) ou de sistema (deadlock) que causam o aborto de uma transação.
* Queda de Sistema: Falha de hardware ou software que causa a perda do conteúdo da memória volátil (principal).
* Falha de Disco: Perda de dados em armazenamento não volátil.
* Estrutura de Armazenamento:
* Volátil: Memória principal, rápida, mas perde conteúdo em caso de queda de energia.
* Não Volátil: Disco, mais lento, mas retém dados permanentemente.

Mecanismos de Recuperação Baseados em Log
As estratégias de recuperação definem como e quando as alterações são propagadas da memória para o disco, utilizando o log de transações.
* Políticas de Escrita:
* Steal / No-Steal: Define se uma página de buffer modificada por uma transação não efetivada pode ser escrita em disco ("steal").
* Force / No-Force: Define se todas as páginas modificadas por uma transação são forçadas para o disco no momento do commit ("force").
* Estratégias de Modificação:
* Modificação Adiada (Deferred Modification - NO-UNDO/REDO): As alterações são mantidas no log e nos buffers e só são escritas no disco após o commit. Em caso de falha, apenas a operação REDO é necessária para as transações efetivadas.
* Modificação Imediata (Immediate Modification - UNDO/REDO): As alterações são escritas no disco enquanto a transação ainda está ativa. A recuperação pode exigir UNDO para transações não efetivadas e REDO para transações efetivadas.

Paginação Sombra (Shadow Paging)
É uma alternativa à recuperação baseada em log. Mantém duas tabelas de páginas: a tabela de páginas atuais e a tabela de páginas sombra (uma cópia do estado consistente anterior). As modificações são feitas em cópias das páginas de dados. No commit, a tabela de páginas atualizadas torna-se a tabela corrente.
* Vantagem: Recuperação muito rápida (não há necessidade de UNDO ou REDO).
* Desvantagens: Causa fragmentação de dados, overhead de commit e é de difícil implementação em ambientes multiusuário.

Visão Geral do Algoritmo ARIES
ARIES é um algoritmo de recuperação amplamente utilizado, projetado para trabalhar com uma abordagem "steal/no-force". Seus princípios são:

1. Registro Adiantado em Log (Write-Ahead Logging): Garante que o registro de log correspondente a uma alteração seja escrito em armazenamento estável antes que a alteração seja escrita no banco de dados.
2. Repetição de Histórico: Durante a recuperação, o ARIES refaz todas as ações (efetivadas ou não) para reconstruir o estado do sistema no momento da falha.
3. Registro de Mudanças Durante o Desfazer: As operações de UNDO são registradas no log para evitar que sejam refeitas em caso de nova falha durante a recuperação.

## O processo de recuperação em ARIES ocorre em três fases:

1. Análise: Examina o log para identificar as transações ativas e as páginas "sujas" (modificadas em memória mas não em disco) no momento da falha.
2. Refazer (REDO): Repete o histórico a partir de um ponto apropriado do log para restaurar o estado do banco de dados ao momento da falha.
3. Desfazer (UNDO): Desfaz as operações de todas as transações que estavam ativas no momento da falha.