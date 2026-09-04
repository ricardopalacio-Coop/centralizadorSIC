import mysql.connector

conn = mysql.connector.connect(
    host='localhost',
    port=3307,
    user='root',
    password='root',
    database='centralizador_sic_db',
    charset='utf8mb4'
)
cur = conn.cursor()
cur.execute('SET NAMES utf8mb4;')

# 1. Corrigir título de Sobras com encoding limpo
cur.execute("""
UPDATE easycoop_alocacoes 
SET contrato_descricao = 'DISTRIBUIÇÃO DE SOBRAS' 
WHERE UPPER(contrato_descricao) LIKE '%SOBRA%';
""")
print(f"Corrigidos títulos de Sobras: {cur.rowcount}")

# 2. Remover cargo e CBO de todas as alocações de descanso e sobras
cur.execute("""
UPDATE easycoop_alocacoes 
SET cargo = NULL, cbo = NULL 
WHERE UPPER(contrato_descricao) LIKE '%DESCANSO%' 
   OR UPPER(contrato_descricao) LIKE '%DAR%' 
   OR UPPER(contrato_descricao) LIKE '%SOBRA%';
""")
print(f"Removidos cargos de descanso e sobras: {cur.rowcount}")

# 3. Também corrigir em easycoop_contratos caso exista
try:
    cur.execute("""
    UPDATE easycoop_contratos 
    SET contrato_descricao = 'DISTRIBUIÇÃO DE SOBRAS' 
    WHERE UPPER(contrato_descricao) LIKE '%SOBRA%';
    """)
except Exception:
    pass

conn.commit()

# 4. Verificar alocações de Ricardo (25930187800)
cur.execute("""
SELECT contrato_descricao, status_alocacao, cargo, cbo 
FROM easycoop_alocacoes 
WHERE document = '25930187800'
ORDER BY prioridade_tipo ASC, data_inicio DESC;
""")
print("\nAlocações atualizadas de Ricardo:")
for r in cur.fetchall():
    print(f"  {r[0]} ({r[1]}): Cargo = {r[2]}")

cur.close()
conn.close()
