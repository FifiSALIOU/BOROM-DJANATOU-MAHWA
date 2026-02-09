"""
Script de migration : ajoute la valeur 'retraite' au type enum ticketstatus (statut Retraité).
Un ticket a le statut Retraité lorsqu'après une relance par l'utilisateur, le technicien le résout à nouveau.
"""
from sqlalchemy import text
from app.database import engine

def migrate_database():
    """Ajoute la valeur 'retraite' à l'enum ticketstatus si elle n'existe pas."""
    try:
        print("Début de la migration (ajout statut Retraité)...")
        with engine.connect() as conn:
            # Vérifier si la valeur existe déjà (type peut être ticketstatus ou ticketstatus_)
            result = conn.execute(text("""
                SELECT 1 FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                WHERE t.typname LIKE 'ticketstatus%' AND e.enumlabel = 'retraite'
            """))
            if result.fetchone() is None:
                # Trouver le nom exact du type enum
                name_result = conn.execute(text("""
                    SELECT t.typname FROM pg_type t
                    WHERE t.typname LIKE 'ticketstatus%' LIMIT 1
                """))
                row = name_result.fetchone()
                type_name = row[0] if row else "ticketstatus"
                print(f"Ajout de la valeur 'retraite' au type '{type_name}'...")
                # ADD VALUE ne peut pas être dans une transaction sur certaines versions PG
                conn.execute(text(f"ALTER TYPE {type_name} ADD VALUE 'retraite'"))
                conn.commit()
                print("OK - Valeur 'retraite' ajoutée à l'enum ticketstatus")
            else:
                print("OK - La valeur 'retraite' existe déjà dans l'enum")

            # SQLAlchemy envoie le NOM de l'enum (RETRAITE) à PostgreSQL, pas la valeur
            result2 = conn.execute(text("""
                SELECT 1 FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                WHERE t.typname LIKE 'ticketstatus%' AND e.enumlabel = 'RETRAITE'
            """))
            if result2.fetchone() is None:
                name_result2 = conn.execute(text("""
                    SELECT t.typname FROM pg_type t
                    WHERE t.typname LIKE 'ticketstatus%' LIMIT 1
                """))
                row2 = name_result2.fetchone()
                type_name2 = row2[0] if row2 else "ticketstatus"
                print(f"Ajout de la valeur 'RETRAITE' au type '{type_name2}'...")
                conn.execute(text(f"ALTER TYPE {type_name2} ADD VALUE 'RETRAITE'"))
                conn.commit()
                print("OK - Valeur 'RETRAITE' ajoutée à l'enum ticketstatus")
            else:
                print("OK - La valeur 'RETRAITE' existe déjà dans l'enum")
        print("\nMigration terminée avec succès !")
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print("OK - La valeur existe déjà.")
        else:
            print(f"ERREUR lors de la migration: {e}")
            raise

if __name__ == "__main__":
    migrate_database()
