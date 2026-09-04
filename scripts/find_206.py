import subprocess

sql = """
SET NOCOUNT ON;
DECLARE @sql NVARCHAR(MAX) = N'';

SELECT @sql = @sql + N'IF EXISTS (SELECT 1 FROM [' + t.name + N'] WHERE [' + c.name + N'] = 206) PRINT ''' + t.name + N'.' + c.name + N''';' + CHAR(10)
FROM sys.tables t
JOIN sys.columns c ON t.object_id = c.object_id
JOIN sys.types ty ON c.user_type_id = ty.user_type_id
WHERE ty.name IN ('int', 'smallint', 'tinyint', 'bigint')
  AND t.name NOT IN ('_CARGOS_PROFISSOES');

EXEC sp_executesql @sql;
"""

cmd = [
    'docker', 'exec', 'mssql_coopedu',
    '/opt/mssql-tools18/bin/sqlcmd',
    '-S', 'localhost',
    '-d', 'COOP01',
    '-U', 'sa',
    '-P', 'Coopedu@2026!Sql',
    '-C', '-W',
    '-Q', sql
]

res = subprocess.run(cmd, capture_output=True, text=True)
print("RESULTS FOR 206:")
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)
