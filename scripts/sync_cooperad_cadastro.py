import sys
sys.path.append(r'C:\Users\ricar\.gemini\antigravity\brain\d0a9a647-986b-4b99-a158-9a93c4efd8f8')
from scratch.inspect_coop01 import execute_sql
import mysql.connector

print("=== SINCRONIZANDO RG, PIS/INSS, SEXO E BANCO 770 -> 450 ===")

# Conectar ao MySQL
mysql_conn = mysql.connector.connect(
    host='localhost',
    port=3307,
    user='root',
    password='root',
    database='centralizador_sic_db'
)
mysql_cur = mysql_conn.cursor()

# 1. Garantir colunas
for col, ty in [
    ('rg_number', 'VARCHAR(50)'),
    ('rg_issuer', 'VARCHAR(50)'),
    ('pis_number', 'VARCHAR(50)'),
    ('gender', 'VARCHAR(10)')
]:
    try:
        mysql_cur.execute(f"ALTER TABLE cooperados ADD COLUMN {col} {ty} NULL")
    except Exception:
        pass
mysql_conn.commit()

# 2. Extrair dados cadastrais de COOPERAD no SQL Server em lotes
query_sql = """
SET NOCOUNT ON;
SELECT 
    REPLACE(REPLACE(REPLACE(CPF, '.', ''), '-', ''), ' ', '') AS doc,
    ISNULL(RG, '') AS rg,
    ISNULL(ORGEMISSOR, '') AS org,
    ISNULL(NULLIF(PIS, ''), ISNULL(NRO_INSS, '')) AS pis_inss,
    ISNULL(SEXO, '') AS sexo,
    ISNULL(COD_BANCO, '') AS bco
FROM COOPERAD
WHERE CPF IS NOT NULL AND CPF <> '';
"""
print("Extraindo do SQL Server COOPERAD...")
raw_output = execute_sql(query_sql)
lines = raw_output.strip().split('\n')

updates = []
for line in lines:
    if '|' in line and not line.startswith('doc|rg') and not line.startswith('---'):
        parts = [p.strip() for p in line.split('|')]
        if len(parts) >= 6:
            doc, rg, org, pis, sexo, bco = parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]
            if len(doc) >= 11:
                updates.append((
                    rg if rg else None,
                    org if org else None,
                    pis if pis else None,
                    sexo if sexo else None,
                    doc
                ))

print(f"Total de registros a atualizar no MySQL: {len(updates)}")

# Atualizar no MySQL em lote de 1000
update_sql = """
UPDATE cooperados 
SET rg_number = %s,
    rg_issuer = %s,
    pis_number = %s,
    gender = %s
WHERE document = %s;
"""
batch_size = 1000
for i in range(0, len(updates), batch_size):
    mysql_cur.executemany(update_sql, updates[i:i+batch_size])
    mysql_conn.commit()
    print(f"Progresso: {min(i+batch_size, len(updates))}/{len(updates)}")

print("Dados cadastrais (RG, PIS/INSS, Sexo) sincronizados com sucesso!")

# 3. Tratar Banco 770 -> Máscara 450 e Nome BANCO FITBANK
print("Atualizando Banco 770 -> Código 450 / BANCO FITBANK...")
mysql_cur.execute("""
UPDATE cooperados 
SET bank_code = '450',
    bank_name = 'BANCO FITBANK'
WHERE bank_code = '770' OR bank_name LIKE '%770%';
""")
print(f"Bancos 770 convertidos para 450 / BANCO FITBANK: {mysql_cur.rowcount} cooperados.")

# Atualizar outros bancos comuns para nomes legíveis caso estejam vazios ou padrão
bancos_map = [
    ('1', 'Banco do Brasil'),
    ('104', 'Caixa Econômica Federal'),
    ('237', 'Bradesco'),
    ('260', 'Nubank'),
    ('33', 'Santander'),
    ('341', 'Itaú Unibanco'),
    ('77', 'Banco Inter'),
    ('380', 'PicPay')
]
for cod, nome in bancos_map:
    mysql_cur.execute(
        "UPDATE cooperados SET bank_name = %s WHERE bank_code = %s AND (bank_name IS NULL OR bank_name = '' OR bank_name LIKE 'Banco %');",
        (nome, cod)
    )
mysql_conn.commit()

# 4. Verificar dados finais de Ricardo (25930187800)
mysql_cur.execute("""
SELECT document, name, gender, rg_number, rg_issuer, pis_number, bank_code, bank_name
FROM cooperados
WHERE document = '25930187800';
""")
row = mysql_cur.fetchone()
print("Cooperado 25930187800 atualizado:")
print("  Nome:", row[1])
print("  Sexo:", row[2])
print("  RG:", row[3], f"({row[4]})" if row[4] else "")
print("  PIS/INSS:", row[5])
print("  Banco:", row[6], "-", row[7])

mysql_cur.close()
mysql_conn.close()
