"""
Script de migration : crée les tables assets et asset_history

ATTENTION :
- Cette migration est NON destructive : elle ne fait que créer les tables si elles n'existent pas déjà.
- Aucune table existante n'est modifiée, aucun enregistrement n'est supprimé.
"""

from sqlalchemy import text
from app.database import engine, SessionLocal


def table_exists(conn, table_name: str) -> bool:
    """Vérifie si une table existe déjà dans la base."""
    result = conn.execute(
        text(
            """
            SELECT 1
            FROM information_schema.tables
            WHERE table_name = :table_name
            """
        ),
        {"table_name": table_name},
    )
    return result.first() is not None


def migrate_database() -> None:
    """Crée les tables assets et asset_history sans toucher aux données existantes."""
    db = SessionLocal()
    try:
        print("Début de la migration des tables d'actifs...")

        with engine.connect() as conn:
            # 1) Table principale : assets
            if not table_exists(conn, "assets"):
                print("Création de la table 'assets'...")
                conn.execute(
                    text(
                        """
                        CREATE TABLE assets (
                            id                  SERIAL PRIMARY KEY,
                            nom                 TEXT NOT NULL,
                            type                TEXT NOT NULL,
                            numero_de_serie     TEXT NOT NULL UNIQUE,
                            marque              TEXT NOT NULL,
                            modele              TEXT NOT NULL,
                            statut              TEXT NOT NULL DEFAULT 'in_stock',
                            date_d_achat        DATE NOT NULL,
                            date_de_fin_garantie DATE,
                            prix_d_achat        NUMERIC,
                            fournisseur         TEXT,
                            localisation        TEXT NOT NULL,
                            departement         TEXT NOT NULL,
                            assigned_to_user_id INTEGER REFERENCES users(id),
                            assigned_to_name    TEXT,
                            specifications      JSONB,
                            notes               TEXT,
                            qr_code             TEXT,
                            created_at          TIMESTAMPTZ DEFAULT now(),
                            updated_at          TIMESTAMPTZ DEFAULT now(),
                            created_by          INTEGER REFERENCES users(id)
                        );
                        """
                    )
                )
                conn.commit()
                print("OK - Table 'assets' créée.")
            else:
                print("OK - La table 'assets' existe déjà, aucune modification effectuée.")

            # 2) Table associée : asset_history
            if not table_exists(conn, "asset_history"):
                print("Création de la table 'asset_history'...")
                conn.execute(
                    text(
                        """
                        CREATE TABLE asset_history (
                            id           SERIAL PRIMARY KEY,
                            asset_id     INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
                            action       TEXT NOT NULL,
                            description  TEXT NOT NULL,
                            performed_by INTEGER REFERENCES users(id),
                            ticket_id    INTEGER REFERENCES tickets(id),
                            created_at   TIMESTAMPTZ DEFAULT now()
                        );
                        """
                    )
                )
                conn.commit()
                print("OK - Table 'asset_history' créée.")
            else:
                print("OK - La table 'asset_history' existe déjà, aucune modification effectuée.")

        print("\nMigration terminée avec succès (aucune donnée existante n'a été modifiée).")

    except Exception as e:
        print(f"ERREUR lors de la migration: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    migrate_database()

