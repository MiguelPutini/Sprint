import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 3306)),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', 'Miguel741414@'),
    'database': os.getenv('DB_NAME', 'recarga_inteligente'),
}

def migrate():
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE reservas ADD COLUMN data_reserva DATETIME NULL;")
        conn.commit()
        print("Coluna data_reserva adicionada com sucesso!")
    except Exception as e:
        print(f"Erro ou coluna já existe: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    migrate()
