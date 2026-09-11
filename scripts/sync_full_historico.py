import sys
import os
import subprocess
import mysql.connector
import time
import re

print("================================================================================")
print("  SINCRONIZAÇÃO COMPLETA DA BASE HISTÓRICA DO EASYCOOP (COOP01 -> MYSQL VPS)   ")
print("================================================================================")

t_start = time.time()

# 1. Abrir Túnel SSH para o VPS
SSH_PORT = 3308
print(f"[1/4] Abrindo túnel SSH seguro (Local :{SSH_PORT} -> VPS 127.0.0.1:3307)...")
ssh_cmd = [
    "ssh",
    "-i", "chavehelpdesk",
    "-o", "StrictHostKeyChecking=no",
    "-N",
    "-L", f"{SSH_PORT}:127.0.0.1:3307",
    "helpdesk@34.31.226.186"
]
ssh_proc = subprocess.Popen(ssh_cmd)
time.sleep(3)

try:
    # 2. Conectar ao MySQL do VPS
    print("[2/4] Conectando ao MySQL do VPS via túnel...")
    conn = mysql.connector.connect(
        host="127.0.0.1",
        port=SSH_PORT,
        user="root",
        password=os.environ.get("DB_PASSWORD", "yu1TPfqXtW8iUc305FM46DlC7EB9Qd2s"),
        database="centralizador_sic_db"
    )
    cur = conn.cursor()

    # Garantir colunas
    for col, ty in [
        ('valor_producao', 'DECIMAL(10,2) DEFAULT 0.00'),
        ('outros_creditos', 'DECIMAL(10,2) DEFAULT 0.00'),
        ('total_descontos', 'DECIMAL(10,2) DEFAULT 0.00')
    ]:
        try:
            cur.execute(f"ALTER TABLE easycoop_fechamentos ADD COLUMN {col} {ty};")
            conn.commit()
        except Exception:
            pass

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

    # 3. Sincronizar Fechamentos (LANCAMEN - Todos os Anos)
    print("\n[3/4] Extraindo e inserindo 100% dos Fechamentos (LANCAMEN)...")
    cur.execute("TRUNCATE TABLE easycoop_fechamentos;")
    conn.commit()

    sql_fech = """
    SET NOCOUNT ON;
    SELECT 
        l.COD_COOPERADO,
        REPLACE(REPLACE(REPLACE(c.CPF, '.', ''), '-', ''), ' ', '') AS doc,
        l.ANO,
        l.MES,
        l.NRO_FOLHA_MES,
        ISNULL(cli.NOMEFANTASIA, 'COOPEDU') AS tomador,
        ISNULL(l.VLR_PRODUCAO, 0),
        ISNULL(l.VLR_AJCUSTO, 0),
        ISNULL(l.VLR_TOT_INSS, 0),
        ISNULL(l.VLR_IRRF, 0),
        ISNULL(l.VLR_TOT_TX_ADM, 0),
        ISNULL(l.VLR_TOT_LIQ, 0),
        CONVERT(VARCHAR(10), l.PAGTO_DATA, 120),
        ISNULL(l.PAGTO_NRODOC, ''),
        ISNULL(l.VLR_CREDITO, 0),
        ISNULL(l.VLR_DEBITO, 0)
    FROM LANCAMEN l
    INNER JOIN COOPERAD c ON l.COD_COOPERADO = c.COD_COOPERADO
    LEFT JOIN CLIENTE cli ON l.COD_CLIENTE = cli.COD_CLIENTE;
    """

    cmd_fech = [
        "docker", "exec", "mssql_coopedu",
        "/opt/mssql-tools18/bin/sqlcmd",
        "-S", "127.0.0.1,1433",
        "-d", "COOP01",
        "-U", "sa",
        "-P", "Coopedu@2026!Sql",
        "-C",
        "-W",
        "-s", "~",
        "-Q", sql_fech
    ]

    p_fech = subprocess.Popen(cmd_fech, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="latin1", errors="replace")

    insert_fech_sql = """
    INSERT INTO easycoop_fechamentos (
      matricula, document, ano, mes, folha, tomador,
      valor_bruto, ajuda_custo, inss, irrf, taxa_adm, valor_liquido,
      data_pagamento, comprovante_doc,
      valor_producao, outros_creditos, total_descontos
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
    """

    fech_batch = []
    fech_total = 0

    for line in p_fech.stdout:
        line = line.strip()
        if not line or line.startswith("---") or "COD_COOPERADO" in line:
            continue
        parts = line.split("~")
        if len(parts) >= 16:
            mat = parts[0].strip()
            doc = re.sub(r"\D", "", parts[1].strip())
            if not doc:
                continue
            if len(doc) < 11:
                doc = doc.zfill(11)
            doc = doc[:11]

            try:
                ano = int(float(parts[2].strip()))
                mes = int(float(parts[3].strip()))
                folha = int(float(parts[4].strip())) or 1
                tom = parts[5].strip() or "COOPEDU"
                v_prod = float(parts[6].strip() or 0.0)
                ajuda = float(parts[7].strip() or 0.0)
                inss = float(parts[8].strip() or 0.0)
                irrf = float(parts[9].strip() or 0.0)
                taxa = float(parts[10].strip() or 0.0)
                v_liq = float(parts[11].strip() or 0.0)
                dt_pg = parts[12].strip() if parts[12].strip() and parts[12].strip() != "NULL" else None
                nro_doc = parts[13].strip() if parts[13].strip() and parts[13].strip() != "NULL" else None
                v_cred = float(parts[14].strip() or 0.0)
                v_deb = float(parts[15].strip() or 0.0)

                bruto = v_cred if v_cred > 0 else v_prod
                outros = max(0.0, v_cred - v_prod)

                fech_batch.append((
                    mat, doc, ano, mes, folha, tom,
                    bruto, ajuda, inss, irrf, taxa, v_liq,
                    dt_pg, nro_doc,
                    v_prod, outros, v_deb
                ))
                fech_total += 1

                if len(fech_batch) >= 5000:
                    cur.executemany(insert_fech_sql, fech_batch)
                    conn.commit()
                    fech_batch = []
                    print(f"  -> {fech_total} fechamentos inseridos...")
            except Exception as e:
                continue

    if fech_batch:
        cur.executemany(insert_fech_sql, fech_batch)
        conn.commit()
        fech_batch = []

    p_fech.wait()
    print(f" -> SUCESSO: Total de {fech_total} fechamentos históricos inseridos em easycoop_fechamentos!")

    # 4. Sincronizar Rubricas Analíticas (LANCAMIT - Todos os Anos)
    print("\n[4/4] Extraindo e inserindo 100% das Rubricas Analíticas (LANCAMIT)...")
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

    cmd_itens = [
        "docker", "exec", "mssql_coopedu",
        "/opt/mssql-tools18/bin/sqlcmd",
        "-S", "127.0.0.1,1433",
        "-d", "COOP01",
        "-U", "sa",
        "-P", "Coopedu@2026!Sql",
        "-C",
        "-W",
        "-s", "~",
        "-Q", sql_itens
    ]

    p_itens = subprocess.Popen(cmd_itens, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="latin1", errors="replace")

    insert_itens_sql = """
    INSERT INTO easycoop_lancamento_itens (
        matricula, document, ano, mes, folha,
        cod_lancamento, descricao, tipo, valor
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
    """

    itens_batch = []
    itens_total = 0

    for line in p_itens.stdout:
        line = line.strip()
        if not line or line.startswith("---") or "COD_COOPERADO" in line:
            continue
        parts = line.split("~")
        if len(parts) >= 9:
            mat = parts[0].strip()
            doc = re.sub(r"\D", "", parts[1].strip())
            if not doc:
                continue
            if len(doc) < 11:
                doc = doc.zfill(11)
            doc = doc[:11]

            try:
                ano = int(float(parts[2].strip()))
                mes = int(float(parts[3].strip()))
                folha = int(float(parts[4].strip())) or 1
                cod = parts[5].strip()
                desc = parts[6].strip()
                tipo = parts[7].strip()
                vlr = float(parts[8].strip() or 0.0)

                itens_batch.append((mat, doc, ano, mes, folha, cod, desc, tipo, vlr))
                itens_total += 1

                if len(itens_batch) >= 10000:
                    cur.executemany(insert_itens_sql, itens_batch)
                    conn.commit()
                    itens_batch = []
                    print(f"  -> {itens_total} rubricas inseridas...")
            except Exception as e:
                continue

    if itens_batch:
        cur.executemany(insert_itens_sql, itens_batch)
        conn.commit()
        itens_batch = []

    p_itens.wait()
    print(f" -> SUCESSO: Total de {itens_total} rubricas analíticas inseridas em easycoop_lancamento_itens!")

    cur.close()
    conn.close()

    elapsed = round(time.time() - t_start, 1)
    print(f"\n================================================================================")
    print(f"  SINCRONIZAÇÃO COMPLETA FINALIZADA COM SUCESSO EM {elapsed}s!  ")
    print(f"================================================================================")

finally:
    print("Fechando túnel SSH...")
    ssh_proc.terminate()
