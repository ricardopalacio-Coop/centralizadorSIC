import subprocess
import os
import sys
import re
import mysql.connector
from datetime import datetime

MYSQL_CONFIG = {
    "host": os.environ.get("DB_HOST", "localhost"),
    "port": int(os.environ.get("DB_PORT", "3307")),
    "user": os.environ.get("DB_USER", "root"),
    "password": os.environ.get("DB_PASSWORD", "root"),
    "database": os.environ.get("DB_NAME", "centralizador_sic_db"),
}

def clean_cpf(val):
    if not val:
        return None
    d = re.sub(r"\D", "", str(val))
    if not d:
        return None
    if len(d) < 11:
        d = d.zfill(11)
    return d[:11]

def clean_str(val):
    if val is None:
        return None
    s = str(val).strip()
    return s if s and s != "NULL" else None

def clean_date(val):
    s = clean_str(val)
    if not s:
        return None
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d").strftime("%Y-%m-%d")
    except Exception:
        return None

def clean_num(val):
    if val is None:
        return 0.0
    try:
        return float(val)
    except Exception:
        return 0.0

def run_mssql_query(sql):
    cmd = [
        "docker", "exec", "mssql_coopedu",
        "/opt/mssql-tools18/bin/sqlcmd",
        "-S", "localhost",
        "-d", "COOP01",
        "-U", "sa",
        "-P", "Coopedu@2026!Sql",
        "-C",
        "-W",
        "-s", "~",
        "-Q", f"SET NOCOUNT ON; {sql}"
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, encoding="latin1", errors="replace")
    if res.returncode != 0:
        raise RuntimeError(f"MSSQL Error: {res.stderr}")
    lines = res.stdout.strip().splitlines()
    if not lines:
        return []
    
    header_idx = -1
    for i, l in enumerate(lines):
        if "~" in l:
            header_idx = i
            break
    if header_idx != -1 and header_idx + 2 <= len(lines):
        return lines[header_idx + 2:]
    return lines

def sync_quotas_and_esocial():
    print("================================================================")
    print("SINCRONIZANDO QUOTAS-PARTE E E-SOCIAL PARA MYSQL")
    print("================================================================")

    my_conn = mysql.connector.connect(**MYSQL_CONFIG)
    my_cur = my_conn.cursor()

    # 1. Adicionar colunas de quotas em cooperados se não existirem
    print("[1/3] Adicionando colunas de Quotas-Parte em cooperados...")
    for col, ty in [
        ('quotas_concluidas', "VARCHAR(5) DEFAULT 'N'"),
        ('quotas_pagas', "INT DEFAULT 0"),
        ('quotas_valor', "DECIMAL(10,2) DEFAULT 0")
    ]:
        try:
            my_cur.execute(f"ALTER TABLE cooperados ADD COLUMN {col} {ty};")
        except Exception:
            pass
    my_conn.commit()

    # 2. Atualizar quotas dos cooperados a partir do SQL Server via tabela temporária
    print("[2/3] Calculando quotas-parte dos cooperados...")
    my_cur.execute("""
    CREATE TEMPORARY TABLE IF NOT EXISTS tmp_quotas_calc (
      document VARCHAR(20) PRIMARY KEY,
      concluiu VARCHAR(5),
      pagas INT,
      valor DECIMAL(10,2)
    ) ENGINE=InnoDB;
    """)
    my_cur.execute("TRUNCATE TABLE tmp_quotas_calc;")
    my_conn.commit()

    sql_quotas = """
    SELECT 
        REPLACE(REPLACE(REPLACE(c.CPF, '.', ''), '-', ''), ' ', '') AS cpf,
        ISNULL(c.CONCLUIU_QUOTAS, 'N') AS concluiu,
        COUNT(it.ITEM) AS parcelas_pagas,
        ISNULL(SUM(it.VLR_LANCAMENTO), 0) AS valor_total
    FROM COOPERAD c
    LEFT JOIN LANCAMIT it ON c.COD_COOPERADO = it.COD_COOPERADO AND (it.DESCR_LANC LIKE '%QUOTA%' OR it.DESCR_LANC LIKE '%COTA%')
    WHERE c.CPF IS NOT NULL AND c.CPF <> ''
    GROUP BY c.CPF, c.CONCLUIU_QUOTAS
    """
    rows = run_mssql_query(sql_quotas)
    quotas_batch = []
    for line in rows:
        parts = line.split("~")
        if len(parts) < 4:
            continue
        cpf = clean_cpf(parts[0])
        concluiu = clean_str(parts[1]) or "N"
        pagas = int(clean_num(parts[2]))
        vlr = clean_num(parts[3])

        if cpf:
            quotas_batch.append((cpf, concluiu, pagas, vlr))

        if len(quotas_batch) >= 2000:
            my_cur.executemany("""
            INSERT INTO tmp_quotas_calc (document, concluiu, pagas, valor)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE concluiu=VALUES(concluiu), pagas=VALUES(pagas), valor=VALUES(valor)
            """, quotas_batch)
            my_conn.commit()
            quotas_batch = []

    if quotas_batch:
        my_cur.executemany("""
        INSERT INTO tmp_quotas_calc (document, concluiu, pagas, valor)
        VALUES (%s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE concluiu=VALUES(concluiu), pagas=VALUES(pagas), valor=VALUES(valor)
        """, quotas_batch)
        my_conn.commit()

    my_cur.execute("""
    UPDATE cooperados c
    INNER JOIN tmp_quotas_calc t ON c.document = t.document
    SET c.quotas_concluidas = t.concluiu,
        c.quotas_pagas = t.pagas,
        c.quotas_valor = t.valor;
    """)
    my_conn.commit()
    print(" -> Quotas-parte atualizadas para todos os cooperados via join set-based.")

    # 3. Criar e sincronizar tabela easycoop_esocial
    print("[3/3] Criando tabela easycoop_esocial e carregando eventos (2024-2026)...")
    my_cur.execute("""
    CREATE TABLE IF NOT EXISTS easycoop_esocial (
      id INT PRIMARY KEY,
      document VARCHAR(20) NOT NULL,
      evento VARCHAR(50) NOT NULL,
      data_envio DATE NULL,
      hora_envio VARCHAR(10) NULL,
      ano INT NOT NULL,
      mes INT NOT NULL,
      enviado TINYINT NOT NULL DEFAULT 1,
      nro_protocolo VARCHAR(60) NULL,
      nro_recibo VARCHAR(60) NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'Aceito',
      erro_envio TEXT NULL,
      INDEX idx_doc_ano_mes (document, ano, mes),
      INDEX idx_evento (evento)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    """)
    my_conn.commit()

    my_cur.execute("TRUNCATE TABLE easycoop_esocial;")
    my_conn.commit()

    sql_esocial = """
    SELECT 
        l.ID,
        REPLACE(REPLACE(REPLACE(l.CPF, '.', ''), '-', ''), ' ', ''),
        l.TABELA,
        CONVERT(VARCHAR(10), l.DATA, 120),
        l.HORA,
        l.ANO,
        l.MES,
        l.ENVIADO,
        l.NRO_PROTOCOLO,
        l.NRO_RECIBO,
        CASE 
            WHEN l.NRO_RECIBO IS NOT NULL AND l.NRO_RECIBO <> '' THEN 'Aceito com Recibo'
            WHEN l.ERRO_ENVIO IS NOT NULL AND l.ERRO_ENVIO <> '' THEN 'Rejeitado / Erro'
            WHEN l.ENVIADO = 1 THEN 'Enviado'
            ELSE 'Pendente'
        END AS status,
        SUBSTRING(l.ERRO_ENVIO, 1, 500)
    FROM ESocial_Lote l
    WHERE l.ANO >= 2024 AND l.CPF IS NOT NULL AND l.CPF <> ''
    """
    rows = run_mssql_query(sql_esocial)
    esocial_batch = []
    print(f" -> {len(rows)} eventos eSocial extraídos de 2024-2026. Inserindo no MySQL...")

    for line in rows:
        parts = line.split("~")
        if len(parts) < 11:
            continue
        def p(idx): return parts[idx] if idx < len(parts) else None
        ev_id = int(clean_num(p(0)))
        doc = clean_cpf(p(1))
        evento = clean_str(p(2)) or "S-1200"
        dt_envio = clean_date(p(3))
        hr_envio = clean_str(p(4))
        ano = int(clean_num(p(5)))
        mes = int(clean_num(p(6)))
        env = 1 if p(7) in ["1", "True", "true"] else 0
        prot = clean_str(p(8))
        rec = clean_str(p(9))
        st = clean_str(p(10)) or "Enviado"
        err = clean_str(p(11))

        if ev_id and doc:
            esocial_batch.append((
                ev_id, doc, evento, dt_envio, hr_envio, ano, mes, env, prot, rec, st, err
            ))

        if len(esocial_batch) >= 2000:
            my_cur.executemany("""
            INSERT IGNORE INTO easycoop_esocial (
              id, document, evento, data_envio, hora_envio, ano, mes, enviado, nro_protocolo, nro_recibo, status, erro_envio
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, esocial_batch)
            my_conn.commit()
            esocial_batch = []

    if esocial_batch:
        my_cur.executemany("""
        INSERT IGNORE INTO easycoop_esocial (
          id, document, evento, data_envio, hora_envio, ano, mes, enviado, nro_protocolo, nro_recibo, status, erro_envio
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, esocial_batch)
        my_conn.commit()

    my_cur.close()
    my_conn.close()
    print("================================================================")
    print("SINCRONIZAÇÃO DE QUOTAS E E-SOCIAL CONCLUÍDA COM SUCESSO!")
    print("================================================================")

if __name__ == "__main__":
    sync_quotas_and_esocial()
