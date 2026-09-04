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
    
    # Pular cabeçalho
    header_idx = -1
    for i, l in enumerate(lines):
        if "~" in l:
            header_idx = i
            break
    if header_idx != -1 and header_idx + 2 <= len(lines):
        return lines[header_idx + 2:]
    return lines

def sync_modules():
    print("================================================================")
    print("SINCRONIZANDO MÓDULOS EASYCOOP PARA MYSQL (CENTRALIZADOR SIC)")
    print("================================================================")

    my_conn = mysql.connector.connect(**MYSQL_CONFIG)
    my_cur = my_conn.cursor()

    # 1. Criar tabelas se não existirem
    print("[1/5] Criando/Verificando tabelas no MySQL...")
    my_cur.execute("""
    CREATE TABLE IF NOT EXISTS easycoop_contratos (
      cliente_id INT NOT NULL,
      contrato_id INT NOT NULL,
      numero_doc VARCHAR(50) NULL,
      tomador_nome VARCHAR(255) NOT NULL,
      tomador_razao VARCHAR(255) NULL,
      tomador_cnpj VARCHAR(20) NULL,
      contrato_descricao VARCHAR(255) NULL,
      endereco VARCHAR(255) NULL,
      bairro VARCHAR(100) NULL,
      cidade VARCHAR(100) NULL,
      uf VARCHAR(10) NULL,
      cep VARCHAR(20) NULL,
      telefone VARCHAR(50) NULL,
      contato_responsavel VARCHAR(100) NULL,
      data_inicio DATE NULL,
      data_fim DATE NULL,
      status VARCHAR(10) NOT NULL DEFAULT 'S',
      perc_taxa_adm DECIMAL(10,2) NULL,
      valor_taxa_adm DECIMAL(10,2) NULL,
      dia_pagamento INT NULL,
      centro_custo VARCHAR(50) NULL,
      total_cooperados INT NOT NULL DEFAULT 0,
      cooperados_ativos INT NOT NULL DEFAULT 0,
      PRIMARY KEY (cliente_id, contrato_id),
      INDEX idx_tomador (tomador_nome),
      INDEX idx_num_doc (numero_doc)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    """)

    my_cur.execute("""
    CREATE TABLE IF NOT EXISTS easycoop_alocacoes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      matricula VARCHAR(20) NOT NULL,
      document VARCHAR(20) NOT NULL,
      nome VARCHAR(255) NOT NULL,
      cliente_id INT NOT NULL,
      contrato_id INT NOT NULL,
      tomador_nome VARCHAR(255) NULL,
      contrato_descricao VARCHAR(255) NULL,
      contrato_numero VARCHAR(50) NULL,
      cargo VARCHAR(255) NULL,
      cbo VARCHAR(50) NULL,
      valor_base DECIMAL(10,2) NULL,
      horas VARCHAR(50) NULL,
      data_inicio DATE NULL,
      data_fim DATE NULL,
      status_alocacao VARCHAR(20) NOT NULL DEFAULT 'Ativo',
      INDEX idx_doc (document),
      INDEX idx_matricula (matricula),
      INDEX idx_contrato (cliente_id, contrato_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    """)

    my_cur.execute("""
    CREATE TABLE IF NOT EXISTS easycoop_dependentes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      matricula VARCHAR(20) NOT NULL,
      document VARCHAR(20) NOT NULL,
      nome VARCHAR(255) NOT NULL,
      cpf VARCHAR(20) NULL,
      sexo VARCHAR(5) NULL,
      data_nascimento DATE NULL,
      deduz_irrf VARCHAR(5) NULL,
      tem_convenio VARCHAR(5) NULL,
      INDEX idx_doc (document),
      INDEX idx_matricula (matricula)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    """)

    my_cur.execute("""
    CREATE TABLE IF NOT EXISTS easycoop_documentos (
      id INT PRIMARY KEY,
      matricula VARCHAR(20) NOT NULL,
      document VARCHAR(20) NOT NULL,
      tipo_documento VARCHAR(255) NOT NULL,
      status VARCHAR(100) NULL,
      data_criacao DATE NULL,
      data_assinatura VARCHAR(50) NULL,
      finalizado TINYINT(1) NOT NULL DEFAULT 0,
      INDEX idx_doc (document),
      INDEX idx_matricula (matricula)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    """)

    my_cur.execute("""
    CREATE TABLE IF NOT EXISTS easycoop_fechamentos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      matricula VARCHAR(20) NOT NULL,
      document VARCHAR(20) NOT NULL,
      ano INT NOT NULL,
      mes INT NOT NULL,
      folha INT NOT NULL DEFAULT 1,
      tomador VARCHAR(255) NULL,
      valor_bruto DECIMAL(10,2) NOT NULL DEFAULT 0,
      ajuda_custo DECIMAL(10,2) NOT NULL DEFAULT 0,
      inss DECIMAL(10,2) NOT NULL DEFAULT 0,
      irrf DECIMAL(10,2) NOT NULL DEFAULT 0,
      taxa_adm DECIMAL(10,2) NOT NULL DEFAULT 0,
      valor_liquido DECIMAL(10,2) NOT NULL DEFAULT 0,
      data_pagamento DATE NULL,
      comprovante_doc VARCHAR(50) NULL,
      INDEX idx_doc_ano_mes (document, ano, mes),
      INDEX idx_matricula (matricula)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    """)
    my_conn.commit()

    # 2. Sincronizar Contratos (CLICONTR)
    print("[2/5] Sincronizando Contratos de Tomadores...")
    sql_contratos = """
    SELECT 
        contr.COD_CLIENTE,
        contr.COD_INTERNO,
        contr.NUM_DOC,
        cli.NOMEFANTASIA,
        cli.RAZAOSOCIAL,
        cli.CGC,
        contr.DESCRICAO,
        contr.ENDERECO,
        contr.BAIRRO,
        contr.CIDADE,
        contr.COD_UF,
        contr.CEP,
        contr.FONE1,
        contr.CONTATO,
        CONVERT(VARCHAR(10), contr.DATA_INICIAL, 120),
        CONVERT(VARCHAR(10), contr.DATA_FINAL, 120),
        contr.FLG_ATIVO,
        contr.PER_TAXA_ADM,
        contr.VAL_TAXA_ADM,
        contr.DIA_PAGTO,
        contr.COD_CCUSTO,
        (SELECT COUNT(DISTINCT cc.COD_COOPERADO) FROM COOPCLIE cc WHERE cc.COD_CLIENTE = contr.COD_CLIENTE AND cc.COD_CONTRATO = contr.COD_INTERNO),
        (SELECT COUNT(DISTINCT cc.COD_COOPERADO) FROM COOPCLIE cc WHERE cc.COD_CLIENTE = contr.COD_CLIENTE AND cc.COD_CONTRATO = contr.COD_INTERNO AND cc.ATIVO_INAT = 'A')
    FROM CLICONTR contr
    INNER JOIN CLIENTE cli ON contr.COD_CLIENTE = cli.COD_CLIENTE
    """
    rows = run_mssql_query(sql_contratos)
    contratos_batch = []
    for line in rows:
        parts = line.split("~")
        if len(parts) < 22:
            continue
        def p(idx): return parts[idx] if idx < len(parts) else None
        c_id = int(p(0) or 0)
        ct_id = int(p(1) or 0)
        num_doc = clean_str(p(2))
        tom_nome = clean_str(p(3)) or "Tomador"
        tom_razao = clean_str(p(4))
        tom_cnpj = clean_str(p(5))
        ct_desc = clean_str(p(6))
        end = clean_str(p(7))
        bairro = clean_str(p(8))
        cidade = clean_str(p(9))
        uf = clean_str(p(10))
        cep = clean_str(p(11))
        tel = clean_str(p(12))
        contato = clean_str(p(13))
        dt_ini = clean_date(p(14))
        dt_fim = clean_date(p(15))
        st = clean_str(p(16)) or "S"
        p_taxa = clean_num(p(17))
        v_taxa = clean_num(p(18))
        dia_pg = int(clean_num(p(19)))
        cc = clean_str(p(20))
        tot_coop = int(clean_num(p(21)))
        tot_ativos = int(clean_num(p(22)))

        contratos_batch.append((
            c_id, ct_id, num_doc, tom_nome, tom_razao, tom_cnpj, ct_desc,
            end, bairro, cidade, uf, cep, tel, contato,
            dt_ini, dt_fim, st, p_taxa, v_taxa, dia_pg, cc, tot_coop, tot_ativos
        ))

    my_cur.execute("TRUNCATE TABLE easycoop_contratos;")
    my_cur.executemany("""
    INSERT INTO easycoop_contratos (
      cliente_id, contrato_id, numero_doc, tomador_nome, tomador_razao, tomador_cnpj, contrato_descricao,
      endereco, bairro, cidade, uf, cep, telefone, contato_responsavel,
      data_inicio, data_fim, status, perc_taxa_adm, valor_taxa_adm, dia_pagamento, centro_custo,
      total_cooperados, cooperados_ativos
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, contratos_batch)
    my_conn.commit()
    print(f" -> {len(contratos_batch)} contratos sincronizados.")

    # 3. Sincronizar Alocações (COOPCLIE)
    print("[3/5] Sincronizando Alocações de Cooperados nos Contratos...")
    sql_alocacoes = """
    SELECT 
        cc.COD_COOPERADO,
        REPLACE(REPLACE(REPLACE(c.CPF, '.', ''), '-', ''), ' ', ''),
        c.NOME,
        cc.COD_CLIENTE,
        cc.COD_CONTRATO,
        cli.NOMEFANTASIA,
        contr.DESCRICAO,
        contr.NUM_DOC,
        p.DESCRICAO,
        p.CBO,
        cc.VALOR_BASE,
        cc.NUM_HORAS_TRAB,
        CONVERT(VARCHAR(10), cc.DATA_INICIO, 120),
        CONVERT(VARCHAR(10), cc.DATA_FINAL, 120),
        CASE cc.ATIVO_INAT WHEN 'A' THEN 'Ativo' WHEN 'I' THEN 'Inativo' ELSE cc.ATIVO_INAT END
    FROM COOPCLIE cc
    INNER JOIN COOPERAD c ON cc.COD_COOPERADO = c.COD_COOPERADO
    LEFT JOIN CLIENTE cli ON cc.COD_CLIENTE = cli.COD_CLIENTE
    LEFT JOIN CLICONTR contr ON cc.COD_CLIENTE = contr.COD_CLIENTE AND cc.COD_CONTRATO = contr.COD_INTERNO
    LEFT JOIN _CARGOS_PROFISSOES p ON cc.COD_PROFISSAO = p.CODIGO
    """
    rows = run_mssql_query(sql_alocacoes)
    aloc_batch = []
    my_cur.execute("TRUNCATE TABLE easycoop_alocacoes;")

    for line in rows:
        parts = line.split("~")
        if len(parts) < 14:
            continue
        def p(idx): return parts[idx] if idx < len(parts) else None
        mat = clean_str(p(0))
        cpf = clean_cpf(p(1))
        nome = clean_str(p(2))
        c_id = int(clean_num(p(3)))
        ct_id = int(clean_num(p(4)))
        tom_nome = clean_str(p(5))
        ct_desc = clean_str(p(6))
        ct_num = clean_str(p(7))
        cargo = clean_str(p(8))
        cbo = clean_str(p(9))
        vlr = clean_num(p(10))
        hrs = clean_str(p(11))
        dt_ini = clean_date(p(12))
        dt_fim = clean_date(p(13))
        st = clean_str(p(14)) or "Ativo"

        if cpf and mat:
            aloc_batch.append((
                mat, cpf, nome, c_id, ct_id, tom_nome, ct_desc, ct_num,
                cargo, cbo, vlr, hrs, dt_ini, dt_fim, st
            ))

        if len(aloc_batch) >= 1000:
            my_cur.executemany("""
            INSERT INTO easycoop_alocacoes (
              matricula, document, nome, cliente_id, contrato_id, tomador_nome, contrato_descricao, contrato_numero,
              cargo, cbo, valor_base, horas, data_inicio, data_fim, status_alocacao
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, aloc_batch)
            my_conn.commit()
            aloc_batch = []

    if aloc_batch:
        my_cur.executemany("""
        INSERT INTO easycoop_alocacoes (
          matricula, document, nome, cliente_id, contrato_id, tomador_nome, contrato_descricao, contrato_numero,
          cargo, cbo, valor_base, horas, data_inicio, data_fim, status_alocacao
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, aloc_batch)
        my_conn.commit()
    print(" -> Alocações sincronizadas.")

    # 4. Sincronizar Dependentes (COOPDEPE)
    print("[4/5] Sincronizando Dependentes...")
    sql_dep = """
    SELECT 
        d.COD_COOPERADO,
        REPLACE(REPLACE(REPLACE(c.CPF, '.', ''), '-', ''), ' ', ''),
        d.DEPENDENTE,
        d.CPF,
        d.SEXO,
        CONVERT(VARCHAR(10), d.NASCIMENTO, 120),
        d.FLG_INCLUI_IRRF,
        d.FLG_INCLUI_CONV
    FROM COOPDEPE d
    INNER JOIN COOPERAD c ON d.COD_COOPERADO = c.COD_COOPERADO
    """
    rows = run_mssql_query(sql_dep)
    dep_batch = []
    my_cur.execute("TRUNCATE TABLE easycoop_dependentes;")
    for line in rows:
        parts = line.split("~")
        if len(parts) < 7:
            continue
        def p(idx): return parts[idx] if idx < len(parts) else None
        mat = clean_str(p(0))
        doc = clean_cpf(p(1))
        nome = clean_str(p(2))
        cpf_dep = clean_cpf(p(3))
        sexo = clean_str(p(4))
        dt_nasc = clean_date(p(5))
        irrf = clean_str(p(6))
        conv = clean_str(p(7))
        if doc and nome:
            dep_batch.append((mat, doc, nome, cpf_dep, sexo, dt_nasc, irrf, conv))

    if dep_batch:
        my_cur.executemany("""
        INSERT INTO easycoop_dependentes (
          matricula, document, nome, cpf, sexo, data_nascimento, deduz_irrf, tem_convenio
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, dep_batch)
        my_conn.commit()
    print(f" -> {len(dep_batch)} dependentes sincronizados.")

    # 5. Sincronizar Fechamentos Financeiros Recentes (LANCAMEN de 2023 a 2026)
    print("[5/5] Sincronizando Fechamentos Financeiros dos Cooperados...")
    sql_fech = """
    SELECT 
        l.COD_COOPERADO,
        REPLACE(REPLACE(REPLACE(c.CPF, '.', ''), '-', ''), ' ', ''),
        l.ANO,
        l.MES,
        l.NRO_FOLHA_MES,
        cli.NOMEFANTASIA,
        l.VLR_PRODUCAO,
        l.VLR_AJCUSTO,
        l.VLR_TOT_INSS,
        l.VLR_IRRF,
        l.VLR_TOT_TX_ADM,
        l.VLR_TOT_LIQ,
        CONVERT(VARCHAR(10), l.PAGTO_DATA, 120),
        l.PAGTO_NRODOC
    FROM LANCAMEN l
    INNER JOIN COOPERAD c ON l.COD_COOPERADO = c.COD_COOPERADO
    LEFT JOIN CLIENTE cli ON l.COD_CLIENTE = cli.COD_CLIENTE
    WHERE l.ANO >= 2023
    """
    rows = run_mssql_query(sql_fech)
    fech_batch = []
    my_cur.execute("TRUNCATE TABLE easycoop_fechamentos;")

    for line in rows:
        parts = line.split("~")
        if len(parts) < 13:
            continue
        def p(idx): return parts[idx] if idx < len(parts) else None
        mat = clean_str(p(0))
        doc = clean_cpf(p(1))
        ano = int(clean_num(p(2)))
        mes = int(clean_num(p(3)))
        folha = int(clean_num(p(4))) or 1
        tom = clean_str(p(5)) or "Coopedu Sede"
        bruto = clean_num(p(6))
        ajuda = clean_num(p(7))
        inss = clean_num(p(8))
        irrf = clean_num(p(9))
        taxa = clean_num(p(10))
        liq = clean_num(p(11))
        dt_pg = clean_date(p(12))
        nro_doc = clean_str(p(13))

        if doc and mat:
            fech_batch.append((
                mat, doc, ano, mes, folha, tom, bruto, ajuda, inss, irrf, taxa, liq, dt_pg, nro_doc
            ))

        if len(fech_batch) >= 1000:
            my_cur.executemany("""
            INSERT INTO easycoop_fechamentos (
              matricula, document, ano, mes, folha, tomador, valor_bruto, ajuda_custo, inss, irrf, taxa_adm, valor_liquido, data_pagamento, comprovante_doc
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, fech_batch)
            my_conn.commit()
            fech_batch = []

    if fech_batch:
        my_cur.executemany("""
        INSERT INTO easycoop_fechamentos (
          matricula, document, ano, mes, folha, tomador, valor_bruto, ajuda_custo, inss, irrf, taxa_adm, valor_liquido, data_pagamento, comprovante_doc
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, fech_batch)
        my_conn.commit()
    print(" -> Fechamentos financeiros sincronizados.")

    my_cur.close()
    my_conn.close()
    print("================================================================")
    print("SINCRONIZAÇÃO DOS MÓDULOS EASYCOOP CONCLUÍDA!")
    print("================================================================")

if __name__ == "__main__":
    sync_modules()
