import mysql.connector

conn = mysql.connector.connect(
    host='localhost',
    port=3307,
    user='root',
    password='root',
    database='centralizador_sic_db'
)
cur = conn.cursor()

cur.execute("""
UPDATE easycoop_lancamento_itens 
SET descricao = CASE 
    WHEN cod_lancamento = '314' OR descricao LIKE 'AUXILIO ALIMENTA%' THEN 'AUXÍLIO ALIMENTAÇÃO'
    WHEN cod_lancamento = '315' OR descricao LIKE 'AUXILIO HABITA%' THEN 'AUXÍLIO HABITAÇÃO'
    WHEN cod_lancamento = '318' OR descricao LIKE '%TARIFA BANC%' THEN 'BÔNUS TARIFA BANCÁRIA'
    WHEN cod_lancamento = '321' OR descricao LIKE '%BONUS D.E%' THEN 'BÔNUS D.E.'
    WHEN cod_lancamento = '313' OR descricao LIKE 'AJUSTE PERCAPTA%' THEN 'AJUSTE PER CAPITA / SAÚDE'
    WHEN cod_lancamento = '316' OR descricao LIKE 'PERCAPTA SAUDE%' THEN 'PER CAPITA SAÚDE SUPLEMENTAR'
    WHEN cod_lancamento = '197' OR descricao LIKE 'DISTRIBUI%SOBRAS%' THEN 'DISTRIBUIÇÃO DE SOBRAS'
    WHEN cod_lancamento = '100' OR descricao LIKE 'PRODU%' THEN 'PRODUÇÃO MENSAL'
    WHEN cod_lancamento = '200' OR descricao = 'INSS' THEN 'INSS - PREVIDÊNCIA SOCIAL'
    WHEN cod_lancamento = '201' OR descricao = 'IRRF' THEN 'IRRF - IMPOSTO DE RENDA'
    ELSE descricao
END
WHERE cod_lancamento IN ('100', '197', '200', '201', '313', '314', '315', '316', '318', '321')
   OR descricao LIKE '%AUXILIO%'
   OR descricao LIKE '%SOBRAS%'
   OR descricao LIKE '%PERCAPTA%';
""")
print(f"Atualizadas rubricas: {cur.rowcount}")
conn.commit()

# Testar Ricardo
cur.execute("""
SELECT descricao, tipo, valor
FROM easycoop_lancamento_itens
WHERE document = '25930187800' AND ano = 2025 AND mes = 4 AND folha = 1
ORDER BY tipo ASC, valor DESC;
""")
print("\nRubricas 04/2025 Ricardo:")
for r in cur.fetchall():
    print(f"  [{r[1]}] {r[0]}: R$ {r[2]}")

cur.close()
conn.close()
