import sys
import os
import subprocess
import mysql.connector
import time

t0 = time.time()
print("=== SINCRONIZAÇÃO DE ALTA PERFORMANCE: FECHAMENTOS E RUBRICAS ===")

# Conexão MySQL
conn = mysql.connector.connect(
    host=os.environ.get('DB_HOST', 'localhost'),
    port=int(os.environ.get('DB_PORT', '3307')),
    user=os.environ.get('DB_USER', 'root'),
    password=os.environ.get('DB_PASSWORD', 'root'),
    database=os.environ.get('DB_NAME', 'centralizador_sic_db')
)
cur = conn.cursor()

# 1. Garantir colunas em easycoop_fechamentos
for col, ty in [
    ('valor_producao', 'DECIMAL(10,2) DEFAULT 0.00'),
    ('outros_creditos', 'DECIMAL(10,2) DEFAULT 0.00'),
    ('total_descontos', 'DECIMAL(10,2) DEFAULT 0.00')
]:
    try:
        cur.execute(f"ALTER TABLE easycoop_fechamentos ADD COLUMN {col} {ty};")
    except Exception:
        pass
conn.commit()

# 2. Criar tabela de rubricas detalhadas
cur.execute("""
CREATE TABLE IF NOT EXISTS easycoop_lancamento_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  matricula VARCHAR(20),
  document VARCHAR(20),
  ano INT,
  mes INT,
  folha INT,
  cod_lancamento VARCHAR(20),
  descricao VARCHAR(255),
  tipo VARCHAR(5),
  valor DECIMAL(12,2),
  INDEX idx_doc_comp (document, ano, mes, folha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
""")
conn.commit()

# 3. Tabela temporária para atualização em lote único dos fechamentos
cur.execute("""
CREATE TEMPORARY TABLE tmp_fech_calc (
  document VARCHAR(20),
  ano INT,
  mes INT,
  folha INT,
  bruto_real DECIMAL(10,2),
  prod DECIMAL(10,2),
  outros DECIMAL(10,2),
  deb DECIMAL(10,2),
  liq DECIMAL(10,2),
  PRIMARY KEY (document, ano, mes, folha)
) ENGINE=InnoDB;
""")
conn.commit()

# Função para executar query no SQL Server via stream
def run_sqlcmd_stream(sql):
    cmd = [
        "docker", "exec", "mssql_coopedu",
        "/opt/mssql-tools18/bin/sqlcmd",
        "-S", "127.0.0.1,1433",
        "-d", "COOP01",
        "-U", "sa",
        "-P", "Coopedu@2026!Sql",
        "-C",
        "-W",
        "-s", "|",
        "-Q", sql
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8")
    return proc

# 4. Extrair LANCAMEN e carregar na tabela temporária
print("[1/2] Extraindo totais analíticos de LANCAMEN...")
sql_fech = """
SET NOCOUNT ON;
SELECT 
    REPLACE(REPLACE(REPLACE(c.CPF, '.', ''), '-', ''), ' ', '') AS doc,
    l.ANO,
    l.MES,
    l.NRO_FOLHA_MES,
    ISNULL(l.VLR_PRODUCAO, 0),
    ISNULL(l.VLR_CREDITO, 0),
    ISNULL(l.VLR_DEBITO, 0),
    ISNULL(l.VLR_TOT_LIQ, 0)
FROM LANCAMEN l
INNER JOIN COOPERAD c ON l.COD_COOPERADO = c.COD_COOPERADO;
"""

p_fech = run_sqlcmd_stream(sql_fech)
fech_batch = []
fech_count = 0
insert_tmp_sql = """
INSERT IGNORE INTO tmp_fech_calc (document, ano, mes, folha, bruto_real, prod, outros, deb, liq)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
"""

for line in p_fech.stdout:
    if '|' in line:
        parts = [p.strip() for p in line.split('|')]
        if len(parts) >= 8 and len(parts[0]) >= 11:
            doc, ano, mes, folha, v_prod, v_cred, v_deb, v_liq = parts[:8]
            try:
                prod = float(v_prod)
                cred = float(v_cred)
                deb = float(v_deb)
                liq = float(v_liq)
                bruto_real = cred if cred > 0 else prod
                outros = max(0.0, cred - prod)
                fech_batch.append((doc, int(ano), int(mes), int(folha), bruto_real, prod, outros, deb, liq))
                fech_count += 1
                if len(fech_batch) >= 10000:
                    cur.executemany(insert_tmp_sql, fech_batch)
                    conn.commit()
                    fech_batch = []
            except ValueError:
                pass

if fech_batch:
    cur.executemany(insert_tmp_sql, fech_batch)
    conn.commit()

p_fech.wait()
print(f" -> {fech_count} fechamentos carregados em memória. Executando UPDATE set-based...")

cur.execute("""
UPDATE easycoop_fechamentos f
INNER JOIN tmp_fech_calc t 
   ON f.document = t.document 
  AND f.ano = t.ano 
  AND f.mes = t.mes 
  AND f.folha = t.folha
SET f.valor_bruto = t.bruto_real,
    f.valor_producao = t.prod,
    f.outros_creditos = t.outros,
    f.total_descontos = t.deb,
    f.valor_liquido = t.liq;
""")
conn.commit()
print(f" -> Fechamentos atualizados! ({cur.rowcount} linhas modificadas)")

# 5. Extrair e sincronizar LANCAMIT
print("[2/2] Extraindo rubricas analíticas de LANCAMIT (2024 a 2026)...")
cur.execute("TRUNCATE TABLE easycoop_lancamento_itens;")
conn.commit()

sql_itens = """
SET NOCOUNT ON;
SELECT 
    li.COD_COOPERADO,
    REPLACE(REPLACE(REPLACE(c.CPF, '.', ''), '-', ''), ' ', '') AS doc,
    li.ANO,
    li.MES,
    li.NRO_FOLHA_MES,
    ISNULL(li.COD_LANCAMENTO, 0),
    ISNULL(li.DESCR_LANC, 'PRODUCAO'),
    ISNULL(li.DEB_CRED, 'C'),
    ISNULL(li.VLR_LANCAMENTO, 0)
FROM LANCAMIT li
INNER JOIN COOPERAD c ON li.COD_COOPERADO = c.COD_COOPERADO
WHERE li.VLR_LANCAMENTO > 0;
"""

p_itens = run_sqlcmd_stream(sql_itens)
itens_batch = []
itens_count = 0
insert_itens_sql = """
INSERT INTO easycoop_lancamento_itens (
    matricula, document, ano, mes, folha,
    cod_lancamento, descricao, tipo, valor
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
"""

for line in p_itens.stdout:
    if '|' in line:
        parts = [p.strip() for p in line.split('|')]
        if len(parts) >= 9 and len(parts[1]) >= 11:
            mat, doc, ano, mes, folha, cod, desc, tipo, vlr = parts[:9]
            try:
                val = float(vlr)
                if val > 0:
                    itens_batch.append((
                        mat, doc, int(ano), int(mes), int(folha),
                        cod, desc, tipo, val
                    ))
                    itens_count += 1
                    if len(itens_batch) >= 10000:
                        cur.executemany(insert_itens_sql, itens_batch)
                        conn.commit()
                        itens_batch = []
                        if itens_count % 50000 == 0:
                            print(f"  Progresso rubricas: {itens_count} itens inseridos...")
            except ValueError:
                pass

if itens_batch:
    cur.executemany(insert_itens_sql, itens_batch)
    conn.commit()

p_itens.wait()
print(f" -> {itens_count} rubricas inseridas em easycoop_lancamento_itens!")

# 6. Testar cooperado Ricardo (25930187800) em 04/2025
cur.execute("""
SELECT ano, mes, folha, valor_bruto, valor_producao, outros_creditos, total_descontos, valor_liquido
FROM easycoop_fechamentos
WHERE document = '25930187800' AND ano = 2025 AND mes = 4 AND folha = 1;
""")
row_fech = cur.fetchone()
print("\nFechamento 04/2025 Ricardo:")
print(f"  Total Bruto (Créditos): R$ {row_fech[3]}")
print(f"  Produção Base: R$ {row_fech[4]}")
print(f"  Outros Créditos (Benefícios/Bônus): R$ {row_fech[5]}")
print(f"  Total Descontos (Retenções): R$ {row_fech[6]}")
print(f"  Líquido Repassado: R$ {row_fech[7]}")

cur.execute("""
SELECT descricao, tipo, valor
FROM easycoop_lancamento_itens
WHERE document = '25930187800' AND ano = 2025 AND mes = 4 AND folha = 1
ORDER BY tipo ASC, valor DESC;
""")
print("\nRubricas detalhadas 04/2025 Ricardo:")
for r in cur.fetchall():
    print(f"  [{r[1]}] {r[0]}: R$ {r[2]}")

cur.close()
conn.close()
print(f"\nSincronização concluída em {time.time()-t0:.1f}s!")
