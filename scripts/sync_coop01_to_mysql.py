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
    digits = re.sub(r"\D", "", str(val))
    if not digits:
        return None
    if len(digits) < 11:
        digits = digits.zfill(11)
    elif len(digits) > 11:
        digits = digits[:11]
    return digits

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
        dt = datetime.strptime(s[:10], "%Y-%m-%d")
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return None

def get_bank_name(code_str):
    code = clean_str(code_str)
    if not code:
        return None
    banks = {
        "770": "Banco 770",
        "1": "Banco do Brasil",
        "104": "Caixa Econômica Federal",
        "237": "Banco Bradesco",
        "260": "Nu Pagamentos (Nubank)",
        "33": "Banco Santander",
        "77": "Banco Inter",
        "341": "Banco Itaú",
        "450": "Fitbank",
        "756": "Sicoob",
        "748": "Sicredi",
    }
    return banks.get(code, f"Banco {code}")

def run_sync():
    print("================================================================")
    print("INICIANDO SINCRONIZAÇÃO DA BASE COOP01 -> CENTRALIZADOR SIC")
    print(f"Data/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("================================================================")

    # 1. Testar conexão com MySQL
    try:
        my_conn = mysql.connector.connect(**MYSQL_CONFIG)
        my_cursor = my_conn.cursor()
        my_cursor.execute("SELECT COUNT(*) FROM cooperados;")
        init_count = my_cursor.fetchone()[0]
        print(f"[MySQL] Conexão ativa em {MYSQL_CONFIG['host']}:{MYSQL_CONFIG['port']}")
        print(f"[MySQL] Total inicial de cooperados na base: {init_count}")
    except Exception as e:
        print(f"[ERRO] Falha ao conectar no MySQL: {e}")
        sys.exit(1)

    # 2. Executar extração do SQL Server COOP01 via sqlcmd
    print("[SQL Server] Extraindo cooperados da base COOP01...")
    sql_query = """
    SET NOCOUNT ON;
    SELECT 
        REPLACE(REPLACE(REPLACE(c.CPF, '.', ''), '-', ''), ' ', '') AS document,
        c.COD_COOPERADO AS registration_number,
        c.NOME AS name,
        c.NOME_MAE AS mother_name,
        c.NOME_PAI AS father_name,
        CONVERT(VARCHAR(10), c.NASCIMENTO, 120) AS birth_date,
        c.NATURALIDADE_CID AS birth_city,
        c.NATURALIDADE_UF AS birth_state,
        (SELECT TOP 1 cli.NOMEFANTASIA 
         FROM COOPCLIE cc 
         INNER JOIN CLIENTE cli ON cc.COD_CLIENTE = cli.COD_CLIENTE 
         WHERE cc.COD_COOPERADO = c.COD_COOPERADO 
         ORDER BY cc.DATA_INICIO DESC) AS contract_name,
        p.DESCRICAO AS position,
        CONVERT(VARCHAR(10), c.DATA_ASSOC, 120) AS admission_date,
        CONVERT(VARCHAR(10), c.DATA_ASSOC, 120) AS association_date,
        CONVERT(VARCHAR(10), c.DATA_DESLIG, 120) AS termination_date,
        CASE c.ATIVO_INAT 
            WHEN 'S' THEN 'Ativo' 
            WHEN 'D' THEN 'Desligado' 
            WHEN 'N' THEN 'Inativo' 
            ELSE 'Ativo' 
        END AS status,
        c.EMAIL AS email,
        CASE 
            WHEN c.TELCEL IS NOT NULL AND LEN(RTRIM(c.TELCEL)) > 0 THEN
                CONCAT(COALESCE(RTRIM(c.DDD_CEL), '84'), REPLACE(REPLACE(REPLACE(REPLACE(c.TELCEL, ' ', ''), '-', ''), '(', ''), ')', ''))
            ELSE NULL
        END AS whatsapp_number,
        CASE 
            WHEN c.TELEFONE IS NOT NULL AND LEN(RTRIM(c.TELEFONE)) > 0 THEN
                CONCAT(COALESCE(RTRIM(c.DDD_RES), '84'), REPLACE(REPLACE(REPLACE(REPLACE(c.TELEFONE, ' ', ''), '-', ''), '(', ''), ')', ''))
            ELSE NULL
        END AS secondary_phone,
        c.ENDERECO AS street,
        c.NUMERO AS number,
        c.COMPLEMENTO AS complement,
        c.BAIRRO AS neighborhood,
        c.CIDADE AS city,
        c.COD_UF AS state,
        c.CEP AS zip_code,
        c.COD_BANCO AS bank_code,
        c.NRO_AGENCIA AS agency,
        c.NRO_CONTACORR AS account_number,
        c.DIG_CONTACORR AS account_digit,
        CASE c.TIPO_CONTA_BCO 
            WHEN 'C' THEN 'Conta-Corrente' 
            WHEN 'P' THEN 'Poupança' 
            ELSE 'Conta-Corrente' 
        END AS account_type,
        c.CHAVE_PIX AS pix_key
    FROM COOPERAD c
    LEFT JOIN _CARGOS_PROFISSOES p ON c.COD_PROFISSAO = p.CODIGO
    WHERE c.CPF IS NOT NULL AND LEN(RTRIM(c.CPF)) >= 9
    ORDER BY c.COD_COOPERADO;
    """

    sql_password = os.environ.get("COOP01_SQL_PASSWORD", "Coopedu@2026!Sql")
    cmd = [
        "docker", "exec", "mssql_coopedu",
        "/opt/mssql-tools18/bin/sqlcmd",
        "-S", "localhost",
        "-d", "COOP01",
        "-U", "sa",
        "-P", sql_password,
        "-C",
        "-W",
        "-s", "~",
        "-Q", sql_query
    ]

    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, encoding="latin1", errors="replace")
    if res.returncode != 0:
        print(f"[ERRO] Falha ao extrair do SQL Server: {res.stderr}")
        sys.exit(1)

    lines = res.stdout.strip().splitlines()
    if not lines:
        print("[ERRO] Nenhuma linha retornada pelo SQL Server.")
        sys.exit(1)

    header_idx = -1
    for i, l in enumerate(lines):
        if "document~registration_number" in l or "document~" in l:
            header_idx = i
            break

    if header_idx == -1:
        data_lines = lines
    else:
        data_lines = lines[header_idx + 2:]

    print(f"[SQL Server] Total de linhas brutas recebidas: {len(data_lines)}")

    upsert_sql = """
    INSERT INTO cooperados (
        document, registration_number, name, mother_name, father_name,
        birth_date, birth_city, birth_state, contract_name, position,
        admission_date, association_date, termination_date, status,
        email, whatsapp_number, secondary_phone,
        street, number, complement, neighborhood, city, state, zip_code,
        bank_name, bank_code, agency, account_number, account_digit, account_type, pix_key
    ) VALUES (
        %s, %s, %s, %s, %s,
        %s, %s, %s, %s, %s,
        %s, %s, %s, %s,
        %s, %s, %s,
        %s, %s, %s, %s, %s, %s, %s,
        %s, %s, %s, %s, %s, %s, %s
    )
    ON DUPLICATE KEY UPDATE
        registration_number = VALUES(registration_number),
        name = VALUES(name),
        mother_name = COALESCE(VALUES(mother_name), mother_name),
        father_name = COALESCE(VALUES(father_name), father_name),
        birth_date = COALESCE(VALUES(birth_date), birth_date),
        birth_city = COALESCE(VALUES(birth_city), birth_city),
        birth_state = COALESCE(VALUES(birth_state), birth_state),
        contract_name = COALESCE(VALUES(contract_name), contract_name),
        position = COALESCE(VALUES(position), position),
        admission_date = COALESCE(VALUES(admission_date), admission_date),
        association_date = COALESCE(VALUES(association_date), association_date),
        termination_date = VALUES(termination_date),
        status = VALUES(status),
        email = COALESCE(VALUES(email), email),
        whatsapp_number = COALESCE(VALUES(whatsapp_number), whatsapp_number),
        secondary_phone = COALESCE(VALUES(secondary_phone), secondary_phone),
        street = COALESCE(VALUES(street), street),
        number = COALESCE(VALUES(number), number),
        complement = COALESCE(VALUES(complement), complement),
        neighborhood = COALESCE(VALUES(neighborhood), neighborhood),
        city = COALESCE(VALUES(city), city),
        state = COALESCE(VALUES(state), state),
        zip_code = COALESCE(VALUES(zip_code), zip_code),
        bank_name = COALESCE(VALUES(bank_name), bank_name),
        bank_code = COALESCE(VALUES(bank_code), bank_code),
        agency = COALESCE(VALUES(agency), agency),
        account_number = COALESCE(VALUES(account_number), account_number),
        account_digit = COALESCE(VALUES(account_digit), account_digit),
        account_type = COALESCE(VALUES(account_type), account_type),
        pix_key = COALESCE(VALUES(pix_key), pix_key),
        updated_at = CURRENT_TIMESTAMP;
    """

    batch = []
    batch_size = 500
    processed = 0
    errors = 0

    for line in data_lines:
        line_str = line.strip()
        if not line_str or line_str.startswith("(") and "rows affected" in line_str:
            continue
        parts = line_str.split("~")
        if len(parts) < 25:
            continue

        def get_p(idx):
            return parts[idx] if idx < len(parts) else None

        cpf = clean_cpf(get_p(0))
        if not cpf or len(cpf) != 11:
            errors += 1
            continue

        reg_num = None
        try:
            reg_num = int(re.sub(r"\D", "", get_p(1) or ""))
        except Exception:
            pass

        name = clean_str(get_p(2))
        if not name:
            continue

        mother_name = clean_str(get_p(3))
        father_name = clean_str(get_p(4))
        birth_date = clean_date(get_p(5))
        birth_city = clean_str(get_p(6))
        birth_state = clean_str(get_p(7))
        contract_name = clean_str(get_p(8))
        position = clean_str(get_p(9))
        admission_date = clean_date(get_p(10))
        association_date = clean_date(get_p(11))
        termination_date = clean_date(get_p(12))
        status = clean_str(get_p(13)) or "Ativo"
        email = clean_str(get_p(14))
        whatsapp = clean_str(get_p(15))
        secondary_phone = clean_str(get_p(16))
        street = clean_str(get_p(17))
        number = clean_str(get_p(18))
        complement = clean_str(get_p(19))
        neighborhood = clean_str(get_p(20))
        city = clean_str(get_p(21))
        state = clean_str(get_p(22))
        zip_code = clean_str(get_p(23))
        bank_code = clean_str(get_p(24))
        bank_name = get_bank_name(bank_code)
        agency = clean_str(get_p(25))
        account_number = clean_str(get_p(26))
        account_digit = clean_str(get_p(27))
        account_type = clean_str(get_p(28)) or "Conta-Corrente"
        pix_key = clean_str(get_p(29))

        record = (
            cpf, reg_num, name, mother_name, father_name,
            birth_date, birth_city, birth_state, contract_name, position,
            admission_date, association_date, termination_date, status,
            email, whatsapp, secondary_phone,
            street, number, complement, neighborhood, city, state, zip_code,
            bank_name, bank_code, agency, account_number, account_digit, account_type, pix_key
        )
        batch.append(record)

        if len(batch) >= batch_size:
            my_cursor.executemany(upsert_sql, batch)
            my_conn.commit()
            processed += len(batch)
            print(f"[Progresso] {processed} cooperados sincronizados...")
            batch = []

    if batch:
        my_cursor.executemany(upsert_sql, batch)
        my_conn.commit()
        processed += len(batch)
        print(f"[Progresso] {processed} cooperados sincronizados.")

    my_cursor.execute("SELECT COUNT(*) FROM cooperados;")
    final_count = my_cursor.fetchone()[0]

    my_cursor.close()
    my_conn.close()

    print("================================================================")
    print("SINCRONIZAÇÃO DE COOPERADOS CONCLUÍDA COM SUCESSO!")
    print(f"Total Inicial no MySQL: {init_count}")
    print(f"Total Processado:       {processed}")
    print(f"Total Final no MySQL:   {final_count}")
    print(f"Registros Inválidos/Ignorados: {errors}")
    print("================================================================")
    return {
        "init_count": init_count,
        "processed": processed,
        "final_count": final_count,
        "errors": errors
    }

if __name__ == "__main__":
    run_sync()
