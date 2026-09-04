import sys
import os
sys.path.append(r'C:\Users\ricar\.gemini\antigravity\brain\d0a9a647-986b-4b99-a158-9a93c4efd8f8')
from scratch.inspect_coop01 import execute_sql
import mysql.connector

print("=== SINCRONIZANDO RUBRICAS ANALÍTICAS E AJUSTANDO BRUTO (VLR_CREDITO) ===")

# Conectar ao MySQL
mysql_conn = mysql.connector.connect(
    host='localhost',
    port=3307,
    user='root',
    password='root',
    database='centralizador_sic_db'
)
mysql_cur = mysql_conn.cursor()

# 1. Adicionar colunas detalhadas em easycoop_fechamentos se não existirem
for col, ty in [
    ('valor_producao', 'DECIMAL(10,2) DEFAULT 0.00'),
    ('outros_creditos', 'DECIMAL(10,2) DEFAULT 0.00'),
    ('total_descontos', 'DECIMAL(10,2) DEFAULT 0.00')
]:
    try:
        mysql_cur.execute(f"ALTER TABLE easycoop_fechamentos ADD COLUMN {col} {ty};")
    except Exception:
        pass
mysql_conn.commit()

# 2. Criar tabela easycoop_lancamento_itens
mysql_cur.execute("""
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
  INDEX idx_doc_comp (document, ano, mes, folha),
  INDEX idx_mat_comp (matricula, ano, mes, folha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
""")
mysql_conn.commit()

# 3. Atualizar easycoop_fechamentos com VLR_CREDITO real do SQL Server
print("Extraindo totais analíticos de LANCAMEN de 2023 a 2026...")
sql_fech = """
SET NOCOUNT ON;
SELECT 
    l.COD_COOPERADO,
    REPLACE(REPLACE(REPLACE(c.CPF, '.', ''), '-', ''), ' ', '') AS CPF,
    l.ANO,
    l.MES,
    l.NRO_FOLHA_MES,
    ISNULL(l.VLR_PRODUCAO, 0) AS VLR_PRODUCAO,
    ISNULL(l.VLR_CREDITO, 0) AS VLR_CREDITO,
    ISNULL(l.VLR_DEBITO, 0) AS VLR_DEBITO,
    ISNULL(l.VLR_TOT_LIQ, 0) AS VLR_TOT_LIQ
FROM LANCAMEN l
INNER JOIN COOPERAD c ON l.COD_COOPERADO = c.COD_COOPERADO
WHERE l.ANO >= 2023;
"""

output = execute_sql(sql_fech)
lines = output.strip().split('\n')
print(f"Linhas retornadas de LANCAMEN: {len(lines)}")

fech_updates = []
for line in lines:
    if '|' in line:
        parts = [p.strip() for p in line.split('|')]
        if len(parts) >= 9 and parts[0] != 'COD_COOPERADO' and not parts[0].startswith('---'):
            mat, doc, ano, mes, folha, v_prod, v_cred, v_deb, v_liq = parts[:9]
            try:
                prod = float(v_prod)
                cred = float(v_cred)
                deb = float(v_deb)
                liq = float(v_liq)
                bruto_real = cred if cred > 0 else prod
                outros = max(0.0, cred - prod)
                fech_updates.append((bruto_real, prod, outros, deb, liq, doc, int(ano), int(mes), int(folha)))
            except ValueError:
                pass

print(f"Atualizando {len(fech_updates)} fechamentos no MySQL...")
update_fech_sql = """
UPDATE easycoop_fechamentos
SET valor_bruto = %s,
    valor_producao = %s,
    outros_creditos = %s,
    total_descontos = %s,
    valor_liquido = %s
WHERE document = %s AND ano = %s AND mes = %s AND folha = %s;
"""
batch_size = 2000
for i in range(0, len(fech_updates), batch_size):
    mysql_cur.executemany(update_fech_sql, fech_updates[i:i+batch_size])
    mysql_conn.commit()
    if i % 20000 == 0 and i > 0:
        print(f"  Progresso fechamentos: {i}/{len(fech_updates)}...")

print("Fechamentos atualizados com valores contábeis exatos!")

# 4. Extrair e sincronizar rubricas detalhadas de LANCAMIT
print("Extraindo rubricas analíticas de LANCAMIT (2024 a 2026)...")
mysql_cur.execute("TRUNCATE TABLE easycoop_lancamento_itens;")
mysql_conn.commit()

sql_itens = """
SET NOCOUNT ON;
SELECT 
    li.COD_COOPERADO,
    REPLACE(REPLACE(REPLACE(c.CPF, '.', ''), '-', ''), ' ', '') AS CPF,
    li.ANO,
    li.MES,
    li.NRO_FOLHA_MES,
    ISNULL(li.COD_LANCAMENTO, 0) AS COD_LANCAMENTO,
    ISNULL(li.DESCR_LANC, 'PRODUCAO') AS DESCR_LANC,
    ISNULL(li.DEB_CRED, 'C') AS DEB_CRED,
    ISNULL(li.VLR_LANCAMENTO, 0) AS VLR_LANCAMENTO
FROM LANCAMIT li
INNER JOIN COOPERAD c ON li.COD_COOPERADO = c.COD_COOPERADO
WHERE li.ANO >= 2024 AND li.VLR_LANCAMENTO > 0;
"""

output_itens = execute_sql(sql_itens)
lines_itens = output_itens.strip().split('\n')
print(f"Linhas retornadas de LANCAMIT: {len(lines_itens)}")

insert_itens_sql = """
INSERT INTO easycoop_lancamento_itens (
    matricula, document, ano, mes, folha,
    cod_lancamento, descricao, tipo, valor
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
"""

itens_batch = []
count = 0
for line in lines_itens:
    if '|' in line:
        parts = [p.strip() for p in line.split('|')]
        if len(parts) >= 9 and parts[0] != 'COD_COOPERADO' and not parts[0].startswith('---'):
            mat, doc, ano, mes, folha, cod, desc, tipo, vlr = parts[:9]
            try:
                val = float(vlr)
                if val > 0 and len(doc) >= 11:
                    itens_batch.append((
                        mat, doc, int(ano), int(mes), int(folha),
                        cod, desc, tipo, val
                    ))
                    count += 1
                    if len(itens_batch) >= 5000:
                        mysql_cur.executemany(insert_itens_sql, itens_batch)
                        mysql_conn.commit()
                        itens_batch = []
                        if count % 50000 == 0:
                            print(f"  Progresso rubricas: {count} itens inseridos...")
            except ValueError:
                pass

if itens_batch:
    mysql_cur.executemany(insert_itens_sql, itens_batch)
    mysql_conn.commit()

print(f"Total de {count} rubricas analíticas sincronizadas em easycoop_lancamento_itens!")

# 5. Testar consulta de rubricas para Ricardo (25930187800) em 04/2025
mysql_cur.execute("""
SELECT descricao, tipo, valor
FROM easycoop_lancamento_itens
WHERE document = '25930187800' AND ano = 2025 AND mes = 4 AND folha = 1
ORDER BY tipo, valor DESC;
""")
print("Rubricas de Ricardo em 04/2025 no MySQL:")
for r in mysql_cur.fetchall():
    print(f"  [{r[1]}] {r[0]}: R$ {r[2]}")

mysql_cur.close()
mysql_conn.close()
