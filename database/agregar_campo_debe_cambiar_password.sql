-- Agregar campo debe_cambiar_password a la tabla usuarios
-- Ejecutar este script en tu base de datos MySQL mediante DBeaver o Laragon

-- Método 1: Para MySQL 5.7+ (usa IF NOT EXISTS)
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS debe_cambiar_password TINYINT(1) DEFAULT 0 
AFTER password;

-- Método 2: Si el método anterior no funciona (MySQL más antiguo), comentar el anterior y descomentar este:
-- ALTER TABLE usuarios ADD COLUMN debe_cambiar_password TINYINT(1) DEFAULT 0 AFTER password;

-- Verificar que el campo se agregó correctamente
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'usuarios' 
  AND COLUMN_NAME = 'debe_cambiar_password';

-- Si la consulta anterior retorna una fila, ¡el campo se agregó exitosamente!
