const { pool } = require('../dist/server/db');

async function updateDb() {
  console.log('Atualizando cargo de Adamiles no MySQL...');
  await pool.query(
    "UPDATE easycoop_alocacoes SET cargo = 'PROFESSOR POLIVALENTE', cbo = '331205' WHERE document = '05474677456' AND tomador_nome LIKE '%ESPIRITO SANTO%';"
  );
  await pool.query(
    "UPDATE cooperados SET position = 'PROFESSOR POLIVALENTE', contract_name = 'PREF ESPIRITO SANTO' WHERE document = '05474677456';"
  );
  await pool.query(
    "UPDATE easycoop_alocacoes SET cargo = NULL, cbo = NULL WHERE UPPER(contrato_descricao) LIKE '%DESCANSO%' OR UPPER(contrato_descricao) LIKE '%DAR%' OR UPPER(contrato_descricao) LIKE '%SOBRA%';"
  );
  console.log('✅ Dados atualizados com sucesso no MySQL!');
  process.exit(0);
}

updateDb().catch(err => {
  console.error('Erro ao atualizar banco:', err);
  process.exit(1);
});
